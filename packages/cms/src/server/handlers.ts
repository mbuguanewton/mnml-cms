import 'server-only';
import { revalidatePath } from 'next/cache';
import { cookies, draftMode } from 'next/headers';
import { after } from 'next/server';
import type { EntryInput, Invalid, PreviewResult, SaveResult } from '../api.js';
import { objectSchema, previewPath, slugSchema } from '../define.js';
import { checkPassword, isAdmin } from './auth.js';
import type { Change, Context } from './context.js';
import { SESSION_COOKIE, SESSION_MAX_AGE } from './session.js';
import { PREVIEW_COOKIE, SINGLETON_SLUG } from './store.js';

// One route handler for everything the admin does: mount it at <apiPath>/[...route].
//   POST: login · logout · save · delete · preview · preview/exit · upload
//   GET:  media/<key> (uploaded images, public)


// No SVG: it can carry scripts. Vercel caps function request bodies at 4.5 MB.
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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

/** Checks the key, the fields and the slug. Shared by save and preview. */
function validate(ctx: Context, input: EntryInput): Invalid | { ok: true; key: string; slug: string; data: unknown } {
  const def = Object.hasOwn(ctx.config, input.key) ? ctx.config[input.key] : undefined;
  if (!def) return { ok: false, message: 'Unknown collection.', errors: {} };

  const errors: Record<string, string> = {};
  const parsed = objectSchema(def.fields).safeParse(input.data);
  if (!parsed.success) for (const i of parsed.error.issues) errors[i.path.join('.')] ??= i.message;

  let slug = SINGLETON_SLUG;
  if (def.kind === 'collection') {
    const s = slugSchema.safeParse(input.slug);
    if (s.success) slug = s.data;
    else errors.$slug = s.error.issues[0].message;
  }
  if (!parsed.success || errors.$slug) return { ok: false, message: 'Fix the highlighted fields.', errors };
  return { ok: true, key: input.key, slug, data: parsed.data };
}

function changed(ctx: Context, change: Change) {
  (ctx.options.revalidate ?? (() => revalidatePath('/', 'layout')))(change);
  const onChange = ctx.options.onChange;
  if (onChange) after(async () => {
    try {
      await onChange(change);
    } catch (e) {
      console.error('cms onChange failed:', e);
    }
  });
}

export function createHandlers(ctx: Context) {
  const { store, adminPath } = ctx;

  const routes: Record<string, (request: Request) => Promise<Response>> = {
    async login(request) {
      const { password } = await request.json().catch(() => ({}));
      if (!checkPassword(ctx, String(password ?? ''))) {
        // Slow down guessing; there is only one shared password.
        await new Promise((r) => setTimeout(r, 1000));
        return json({ ok: false, message: 'Wrong password.' }, 401);
      }
      (await cookies()).set(SESSION_COOKIE, await ctx.session.create(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
      });
      return json({ ok: true, redirect: adminPath });
    },

    async logout(request) {
      (await cookies()).delete(SESSION_COOKIE);
      return Response.redirect(new URL(`${adminPath}/login`, request.url), 303);
    },

    async save(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const input = (await request.json()) as EntryInput;
      const v = validate(ctx, input);
      if (!v.ok) return json(v satisfies SaveResult);
      const isNew = ctx.config[v.key].kind === 'collection' && input.mode === 'create';
      if (isNew) {
        if (!(await store.insert(v.key, v.slug, v.data))) {
          return json({ ok: false, message: 'That slug is already in use.', errors: { $slug: 'Already in use' } } satisfies SaveResult);
        }
      } else {
        await store.upsert(v.key, v.slug, v.data);
      }
      await store.removeDraft(v.key, v.slug);
      changed(ctx, { type: 'save', key: v.key, slug: v.slug });
      return json({
        ok: true,
        message: 'Saved. The site is updated.',
        redirect: isNew ? `${adminPath}/${v.key}/${v.slug}?created=1` : undefined,
      } satisfies SaveResult);
    },

    async delete(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const { key, slug } = await request.json();
      if (ctx.config[key]?.kind !== 'collection' || typeof slug !== 'string') return json({ ok: false, message: 'Unknown entry.' }, 400);
      await store.remove(key, slug);
      await store.removeDraft(key, slug);
      changed(ctx, { type: 'delete', key, slug });
      return json({ ok: true, redirect: `${adminPath}/${key}` });
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

    async upload(request) {
      if (!(await isAdmin(ctx))) return unauthorized();
      const media = ctx.options.media;
      if (!media) return json({ error: 'Image uploads are not configured.' }, 501);
      const file = (await request.formData()).get('file');
      if (!(file instanceof File)) return json({ error: 'No file' }, 400);
      const ext = IMAGE_TYPES[file.type];
      if (!ext) return json({ error: 'Use a JPEG, PNG, WebP, GIF or AVIF image.' }, 415);
      if (file.size > MAX_IMAGE_BYTES) return json({ error: 'Images must be under 4 MB.' }, 413);
      const base = file.name.replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
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

  /** Uploaded images, streamed from storage. Keys carry a random suffix, so responses never change. */
  async function GET(_request: Request, { params }: { params: Promise<{ route?: string[] }> }) {
    const [first, ...rest] = (await params).route ?? [];
    const key = rest.join('/');
    if (first !== 'media' || !ctx.options.media || !/^[\w.\-/]+$/.test(key) || key.includes('..')) return new Response('Not found', { status: 404 });
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
