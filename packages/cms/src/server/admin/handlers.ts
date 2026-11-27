import 'server-only';
import { cookies, draftMode } from 'next/headers';
import type { AutosaveInput, AutosaveResult, EntryInput, PreviewResult, ReferenceSchemaResult, SaveResult } from '../../api.js';
import { initialValues, plainDef, previewPath, referenceTargets } from '../../schema/define.js';
import {
  checkPassword,
  clearFailures,
  clientIp,
  isAdmin,
  lockedFor,
  recordFailure,
  sessionVersion,
  signOutEverywhere,
  type PasswordAuth,
} from '../auth/auth.js';
import { agentTokens } from '../mcp/tokens.js';
import { runBulk } from '../content/bulk.js';
import { createContentService, previewTarget, validate } from '../content/content.js';
import type { Context } from '../context.js';
import { createMcpHandler } from '../mcp/server.js';
import { SESSION_COOKIE, sessionCookieOptions } from '../auth/session.js';
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '../media/media.js';
import { loadRefOptions } from '../content/ref-options.js';
import { PREVIEW_COOKIE } from '../content/store.js';
import { createLimiter } from '../search/limit.js';
import type { AssistantInput, AssistantTurn } from '../../api.js';
import { parseTurns } from '../../assistant-turns.js';
import { after } from 'next/server';
import { MAX_CHARS, MAX_MESSAGES } from '../ai/limits.js';

// One route handler for everything the admin does: mount it at <apiPath>/[...route].
//   POST: login · logout · logout-all · save · autosave · discard · bulk · delete · preview · preview/exit · references · reference/schema · ai/chat (assistant, only with `ai`) · upload · media/list · media/delete · request · tokens/create · tokens/revoke · mcp
//   GET:  media/<key> (uploaded images, public) · preview/open (admins only) · search (public, only with `search: { route: true }`) · ai/chats (admins only, only with an assistant `store` that has `turns`)

const MEDIA_KEY = /^[\w.\-/]+$/;
/** The most files one `media/delete` call takes. */
const MAX_BULK_DELETE = 100;

const json = (data: unknown, status = 200) => Response.json(data, { status });
const unauthorized = () => json({ ok: false, message: 'Unauthorized', errors: {} }, 401);

/** Browsers send Origin on POST; refuse cross-site requests (CSRF). Non-browser callers still need the session. */
function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === (request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
  } catch {
    return false;
  }
}

export function createHandlers(ctx: Context) {
  const { store, adminPath } = ctx;
  const content = createContentService(ctx);
  const mcp = ctx.options.mcp ? createMcpHandler(ctx, content) : null;
  const tokens = ctx.options.mcp?.adminTokens ? agentTokens(ctx) : null;

  // Public and it may spend embedding credits: 30 searches a minute per client, and 300 in all (a client that sends a
  // different x-forwarded-for each time still hits the second limit). Both are per server instance.
  const searchLimit = createLimiter({ max: 30, windowMs: 60_000 });
  const searchLimitAll = createLimiter({ max: 300, windowMs: 60_000 });
  // The assistant spends the site's model credits: 20 questions a minute per client, admins only. Per server instance.
  const aiLimit = createLimiter({ max: 20, windowMs: 60_000 });
  const MAX_BODY = 400_000;
  async function aiChat(request: Request) {
    if (!ctx.ai) return json({ error: 'Not found' }, 404);
    if (!(await isAdmin(ctx))) return unauthorized();
    const wait = aiLimit(clientIp(request));
    if (wait > 0)
      return Response.json(
        { ok: false, message: `Too many questions. Try again in ${wait} seconds.` },
        { status: 429, headers: { 'Retry-After': String(wait) } },
      );
    // Refuse a big body before reading it.
    if (Number(request.headers.get('content-length')) > MAX_BODY) return json({ ok: false, message: 'That request is too large.' }, 413);
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ ok: false, message: 'That request is too large.' }, 413);
    let input: AssistantInput;
    try {
      input = JSON.parse(raw) as AssistantInput;
    } catch {
      return json({ ok: false, message: 'Send JSON.' }, 400);
    }
    const msgs = Array.isArray(input?.messages) ? input.messages : [];
    const valid =
      msgs.length > 0 && msgs.length <= MAX_MESSAGES && msgs.every((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string');
    if (!valid || msgs[msgs.length - 1].role !== 'user' || msgs.reduce((n, m) => n + m.content.length, 0) > MAX_CHARS)
      return json({ ok: false, message: 'Send up to 30 messages, ending with a question, and at most 60000 characters.' }, 400);
    const page = input.page && typeof input.page === 'object' ? input.page : {};
    const safe: AssistantInput = {
      chatId: typeof input.chatId === 'string' && input.chatId.length > 0 && input.chatId.length <= 100 ? input.chatId : undefined,
      messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      page: {
        key: typeof page.key === 'string' && Object.hasOwn(ctx.config, page.key) ? page.key : undefined,
        slug: typeof page.slug === 'string' ? page.slug : undefined,
        values: page.values,
      },
    };
    const encoder = new TextEncoder();
    // Aborts the model request when the editor's browser goes away (Stop, New chat, a closed tab), whether the runtime
    // aborts `request.signal` or only closes the response.
    const abort = new AbortController();
    request.signal.addEventListener('abort', () => abort.abort(), { once: true });
    // The record of the turn goes to the site's `store` after the response is sent, so it never slows an answer.
    const store = ctx.ai.store;
    let turnDone: (turn?: AssistantTurn) => void = () => {};
    if (store) {
      const turn = new Promise<AssistantTurn | undefined>((resolve) => (turnDone = resolve));
      after(async () => {
        const t = await turn;
        if (!t) return;
        try {
          await store.record(t, { request });
        } catch (e) {
          console.error('cms assistant record failed:', e);
        }
      });
    }
    const events = ctx.ai.run({ ctx, content, input: safe, signal: abort.signal, onTurn: store ? turnDone : undefined })[Symbol.asyncIterator]();
    let gone = false;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (;;) {
            const next = await events.next();
            if (next.done || gone) break;
            controller.enqueue(encoder.encode(`${JSON.stringify(next.value)}\n`));
          }
        } catch (e) {
          if (!gone && !abort.signal.aborted) {
            console.error('cms assistant failed:', e);
            controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'error', message: 'The model request failed. Check the server log.' })}\n`));
          }
        }
        // Nothing to record when the engine never got to run (it throws before it can).
        turnDone(undefined);
        // The reader may have gone (Stop, New chat, a closed tab): the stream is already closed then.
        if (!gone) controller.close();
      },
      cancel() {
        gone = true;
        abort.abort();
        // The engine reports a stopped answer as it unwinds; `start` settles the promise if it never does.
        void events.return?.(undefined);
      },
    });
    return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  // The earlier chats of a page, from the site's store (`turns`): admins only, and a lighter limit than a question.
  const chatsLimit = createLimiter({ max: 60, windowMs: 60_000 });
  async function aiChats(request: Request) {
    const store = ctx.ai?.store;
    if (!store?.turns) return json({ error: 'Not found' }, 404);
    if (!(await isAdmin(ctx))) return unauthorized();
    const wait = chatsLimit(clientIp(request));
    if (wait > 0)
      return Response.json(
        { ok: false, message: `Too many requests. Try again in ${wait} seconds.` },
        { status: 429, headers: { 'Retry-After': String(wait) } },
      );
    const page = new URL(request.url).searchParams.get('page') ?? '';
    if (!page || page.length > 200) return json({ ok: false, message: 'Send the page in ?page=.' }, 400);
    try {
      // Checked and capped: whatever the site's store returns, the browser gets turns, a few hundred at most.
      const turns = parseTurns(await store.turns(page, { request }))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 300);
      return json({ ok: true, turns });
    } catch (e) {
      console.error('cms assistant turns failed:', e);
      return json({ ok: false, message: 'Could not load the earlier chats.' }, 500);
    }
  }

  async function searchRoute(request: Request) {
    const wait = Math.max(searchLimit(clientIp(request)), searchLimitAll('all'));
    if (wait > 0)
      return Response.json(
        { ok: false, message: `Too many searches. Try again in ${wait} seconds.` },
        { status: 429, headers: { 'Retry-After': String(wait) } },
      );
    const params = new URL(request.url).searchParams;
    const q = params.get('q')?.trim() ?? '';
    if (!q || q.length > 200) return json({ ok: false, message: 'Send what to look for in ?q= (up to 200 characters).' }, 400);
    let collections = params.get('collections')?.split(',').filter(Boolean);
    // `search.route: ['posts']` limits what an anonymous visitor can search.
    if (Array.isArray(ctx.searchRoute)) {
      const allowed = ctx.searchRoute;
      collections = collections ? collections.filter((k) => allowed.includes(k)) : allowed;
    }
    const limit = Math.min(Number(params.get('limit')) || 10, 20);
    try {
      return json({ ok: true, results: await ctx.search!.query(q, { collections, limit }) });
    } catch (e) {
      console.error('cms search failed:', e);
      return json({ ok: false, message: 'Search failed.' }, 500);
    }
  }

  const routes: Record<string, (request: Request) => Promise<Response>> = {
    // The login form posts JSON. Without JavaScript (or before it loads) the browser posts the form itself,
    // so a form-encoded request is answered with redirects instead and the password never ends up in a URL.
    async login(request) {
      if (ctx.authAdapter) return json({ error: 'Not found' }, 404);
      const form = (request.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded');
      const back = (error: string) => Response.redirect(new URL(`${ctx.loginUrl}?error=${error}`, request.url), 303);
      const ip = clientIp(request);
      const wait = await lockedFor(ctx.storage, ip);
      if (wait > 0) {
        if (form) return back('locked');
        return json({ ok: false, message: `Too many attempts. Try again in ${Math.ceil(wait / 60)} ${wait > 60 ? 'minutes' : 'minute'}.` }, 429);
      }
      const password = form ? (await request.formData().catch(() => null))?.get('password') : (await request.json().catch(() => ({}))).password;
      if (!checkPassword((ctx.options.auth as PasswordAuth).password, String(password ?? ''))) {
        await recordFailure(ctx.storage, ip);
        // Slow down guessing; there is only one shared password.
        await new Promise((r) => setTimeout(r, 1000));
        return form ? back('wrong') : json({ ok: false, message: 'Wrong password.' }, 401);
      }
      await clearFailures(ctx.storage, ip);
      (await cookies()).set(SESSION_COOKIE, await ctx.session.create(await sessionVersion(ctx)), sessionCookieOptions());
      return form ? Response.redirect(new URL(adminPath, request.url), 303) : json({ ok: true, redirect: adminPath });
    },

    async logout(request) {
      if (ctx.authAdapter) await ctx.authAdapter.signOut?.();
      else (await cookies()).delete(SESSION_COOKIE);
      return Response.redirect(new URL(ctx.loginUrl, request.url), 303);
    },

    /** Built-in login only: invalidates every session, including this one. */
    async 'logout-all'(request) {
      if (ctx.authAdapter) return json({ error: 'Not found' }, 404);
      if (!(await isAdmin(ctx))) return unauthorized();
      await signOutEverywhere(ctx);
      (await cookies()).delete(SESSION_COOKIE);
      return Response.redirect(new URL(ctx.loginUrl, request.url), 303);
    },

    'ai/chat': aiChat,

    async save(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const input = (await request.json()) as EntryInput;
      const { created, ...result } = await content.save(input);
      if (result.ok && created) result.redirect = `${adminPath}/${input.key}/${input.slug}?created=1`;
      return json(result satisfies SaveResult);
    },

    /**
     * Keeps the form's current (valid) data as the entry's draft, so the live version only changes on Publish.
     * A published entry's draft is stored beside it; an entry that was never published is just updated.
     * Refuses when the stored entry has changed since the form loaded it (`rev`).
     */
    async autosave(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      return json((await content.autosave((await request.json()) as AutosaveInput)) satisfies AutosaveResult);
    },

    /** Throws away an entry's unpublished changes, going back to the live version. */
    async discard(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const { key, slug } = await request.json();
      const result = await content.discard(key, slug);
      return result.ok ? json({ ok: true }) : json(result, 400);
    },

    /** Runs publish, unpublish, delete or a site's own list action on several entries of a collection. */
    async bulk(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const { status, ...result } = await runBulk(ctx, content, (await request.json().catch(() => ({}))) as { key: unknown; slugs: unknown; action: unknown });
      return json(result, status);
    },

    async delete(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const { key, slug } = await request.json();
      const result = await content.remove(key, slug);
      return result.ok ? json({ ok: true, redirect: `${adminPath}/${key}` }) : json(result, 400);
    },

    /**
     * Stores the unsaved form as a draft and turns on Draft Mode for this browser, so the public page
     * renders it. The path to open comes from the config, never from the client.
     */
    async preview(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const v = validate(ctx, (await request.json()) as EntryInput);
      if (!v.ok) return json(v satisfies PreviewResult);
      const url = previewPath(ctx.config[v.key], v.slug);
      if (!url) return json({ ok: false, message: 'Preview is not enabled for this content.', errors: {} } satisfies PreviewResult);
      await store.saveDraft(v.key, v.slug, v.data);
      (await draftMode()).enable();
      // Which entry's draft to show; the readers ignore every other draft.
      (await cookies()).set(PREVIEW_COOKIE, `${v.key}/${v.slug}`, { httpOnly: true, sameSite: 'lax', path: '/' });
      return json({ ok: true, url } satisfies PreviewResult);
    },

    /** Posted by the preview banner's form; goes back to the page it came from. */
    async 'preview/exit'(request) {
      (await draftMode()).disable();
      (await cookies()).delete(PREVIEW_COOKIE);
      const back = request.headers.get('referer');
      const target = back && new URL(back).host === new URL(request.url).host ? back : '/';
      return Response.redirect(new URL(target, request.url), 303);
    },

    /** An editor approves or rejects an agent's request to delete an entry or discard its draft. */
    async request(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const { key, slug, approve } = await request.json();
      const r = await content.resolveRequest(key, slug, approve === true);
      return json({ ...r, ...(r.ok && r.deleted && { redirect: `${adminPath}/${key}` }) });
    },

    /** Creates an MCP token from the Agent access page. The response is the only time the token is shown. */
    async 'tokens/create'(request) {
      if (!tokens) return json({ error: 'Not found' }, 404);
      if (!(await isAdmin(ctx))) return unauthorized();
      return json(await tokens.create(await request.json().catch(() => ({}))));
    },

    async 'tokens/revoke'(request) {
      if (!tokens) return json({ error: 'Not found' }, 404);
      if (!(await isAdmin(ctx))) return unauthorized();
      const { id } = await request.json().catch(() => ({}));
      const r = await tokens.revoke(id);
      return json(r, r.ok ? 200 : 400);
    },

    /** The MCP server for agents (`mcp` option). It checks its own tokens instead of the admin session. */
    async mcp(request) {
      return mcp ? mcp(request) : json({ error: 'Not found' }, 404);
    },

    /** Published entries to pick from, for reference pickers outside an entry's own fields (e.g. in rich text). */
    async references(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const { collections } = (await request.json().catch(() => ({}))) as { collections?: unknown };
      if (!Array.isArray(collections) || !collections.every((c) => typeof c === 'string')) return json({ ok: false, message: 'Bad request.' }, 400);
      return json({ ok: true, options: await loadRefOptions(ctx, collections as string[]) });
    },

    /** The form of a collection a reference field can create entries in (its "Create new" panel). */
    async 'reference/schema'(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const { collection } = (await request.json().catch(() => ({}))) as { collection?: unknown };
      const def = typeof collection === 'string' && Object.hasOwn(ctx.config, collection) ? ctx.config[collection] : undefined;
      if (def?.kind !== 'collection') return json({ ok: false, message: 'Unknown collection.', errors: {} } satisfies ReferenceSchemaResult, 404);
      return json({
        ok: true,
        schema: plainDef(def),
        initial: initialValues(def.fields),
        refOptions: await loadRefOptions(ctx, referenceTargets(def.fields)),
      } satisfies ReferenceSchemaResult);
    },

    /** The stored files, newest first: what the image picker offers. */
    async 'media/list'() {
      if (!(await isAdmin(ctx))) return unauthorized();
      const media = ctx.options.media;
      if (!media?.list) return json({ ok: false, message: 'This storage cannot list files.' }, 501);
      const files = (await media.list()).sort((a, b) => (b.uploadedAt?.getTime() ?? 0) - (a.uploadedAt?.getTime() ?? 0));
      return json({
        ok: true,
        files: files.map((f) => ({ key: f.key, url: `${ctx.apiPath}/media/${f.key}`, size: f.size ?? null, uploadedAt: f.uploadedAt?.toISOString() ?? null })),
      });
    },

    /**
     * Deletes stored files: one (`{ key }`) or up to MAX_BULK_DELETE (`{ keys }`). The admin warns first if entries
     * still use them. A batch deletes what it can and reports the rest in `failed`.
     */
    async 'media/delete'(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const media = ctx.options.media;
      if (!media?.delete) return json({ ok: false, message: 'This storage does not support deleting files.' }, 501);
      const body = (await request.json().catch(() => ({}))) as { key?: unknown; keys?: unknown };
      const valid = (k: unknown): k is string => typeof k === 'string' && MEDIA_KEY.test(k) && !k.includes('..');
      if (body.keys !== undefined) {
        const keys = body.keys;
        if (!Array.isArray(keys) || keys.length === 0 || keys.length > MAX_BULK_DELETE || !keys.every(valid)) {
          return json({ ok: false, message: `Pick between 1 and ${MAX_BULK_DELETE} files.` }, 400);
        }
        const unique = [...new Set(keys)];
        const results = await Promise.allSettled(unique.map((k) => media.delete!(k)));
        const deleted: string[] = [];
        const failed: { key: string; message: string }[] = [];
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') deleted.push(unique[i]);
          else failed.push({ key: unique[i], message: r.reason instanceof Error ? r.reason.message : 'Could not delete.' });
        });
        return json({ ok: failed.length === 0, deleted, failed });
      }
      if (!valid(body.key)) return json({ ok: false, message: 'Unknown file.' }, 400);
      await media.delete(body.key);
      return json({ ok: true });
    },

    async upload(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const media = ctx.options.media;
      if (!media) return json({ error: 'Image uploads are not configured.' }, 501);
      const file = (await request.formData()).get('file');
      if (!(file instanceof File)) return json({ error: 'No file' }, 400);
      const ext = IMAGE_TYPES[file.type];
      if (!ext) return json({ error: 'Use a JPEG, PNG, WebP, GIF or AVIF image.' }, 415);
      if (file.size > MAX_IMAGE_BYTES) return json({ error: 'Images must be under 4 MB.' }, 413);
      const base =
        file.name
          .replace(/\.[^.]*$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'image';
      const key = await media.put(file, `${base}.${ext}`);
      return json({ url: `${ctx.apiPath}/media/${key}` });
    },
  };

  async function POST(request: Request, { params }: { params: Promise<{ route?: string[] }> }) {
    if (!sameOrigin(request)) return json({ error: 'Cross-origin request refused.' }, 403);
    const handler = routes[((await params).route ?? []).join('/')];
    if (!handler) return json({ error: 'Not found' }, 404);
    try {
      return await handler(request);
    } catch (e) {
      // Report failures (e.g. storage misconfiguration) to the admin UI instead of an empty 500.
      console.error('cms request failed:', e);
      return json({ ok: false, error: (e as Error).message, message: (e as Error).message, errors: {} }, 500);
    }
  }

  /**
   * A link to an entry's latest version on the site (from the MCP tool `get_preview_url`): signs nothing in, so
   * only an admin's browser gets Draft Mode. Everyone else goes to the login page.
   */
  async function openPreview(request: Request) {
    const q = new URL(request.url).searchParams;
    const key = q.get('key') ?? '';
    const slug = q.get('slug') ?? undefined;
    const target = previewTarget(ctx, key, slug);
    if (!target) return new Response('Not found', { status: 404 });
    if (!(await isAdmin(ctx))) return Response.redirect(new URL(ctx.loginUrl, request.url), 303);
    await store.removeDraft(key, target.slug);
    (await draftMode()).enable();
    (await cookies()).set(PREVIEW_COOKIE, `${key}/${target.slug}`, { httpOnly: true, sameSite: 'lax', path: '/' });
    return Response.redirect(new URL(target.path, request.url), 303);
  }

  /** Uploaded images (streamed from storage; keys carry a random suffix, so responses never change), and preview links. */
  async function GET(request: Request, { params }: { params: Promise<{ route?: string[] }> }) {
    const [first, ...rest] = (await params).route ?? [];
    if (first === 'preview' && rest.join('/') === 'open') return openPreview(request);
    if (first === 'search' && rest.length === 0 && ctx.search && ctx.searchRoute) return searchRoute(request);
    if (first === 'ai' && rest.join('/') === 'chats' && ctx.ai?.store?.turns) return aiChats(request);
    if (first === 'mcp' && mcp && rest.length === 0) return new Response('Use POST.', { status: 405, headers: { Allow: 'POST' } });
    const key = rest.join('/');
    if (first !== 'media' || !ctx.options.media || !MEDIA_KEY.test(key) || key.includes('..')) return new Response('Not found', { status: 404 });
    const file = await ctx.options.media.get(key);
    if (!file) return new Response('Not found', { status: 404 });
    return new Response(file.body, {
      headers: {
        'Content-Type': file.contentType ?? 'application/octet-stream',
        ...(file.size !== undefined && { 'Content-Length': String(file.size) }),
        // Cached by browsers and the CDN, so storage is read about once per file.
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        // Served from the site's own domain: never let a stored file act as a page.
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  }

  return { GET, POST };
}
