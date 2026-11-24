import 'server-only';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ImageIcon,
  KeyRoundIcon,
  PlusIcon,
  SettingsIcon,
} from 'lucide-react';
import { initialValues, plainDef, referenceTargets, withDefaults, type Collection, type CmsConfig, type Singleton } from '../../schema/define.js';
import { displayText } from '../../schema/text.js';
import type { EntryStatus } from '../../api.js';
import type { RefOptions } from '../../admin/entry/fields.js';
import { buttonVariants } from '../../admin/ui/button-variants.js';
import { menuItemClass } from '../../admin/shell/action-menu.js';
import { StatusDot } from '../../admin/entry/status-dot.js';
import { AdminProvider } from '../../admin/shell/context.js';
import { FormDialogProvider } from '../../admin/editor/form-dialog.js';
import { AgentAccess } from '../../admin/agent/agent-access.js';
import { AgentRequest } from '../../admin/agent/agent-request.js';
import { ListColumns } from '../../admin/entry/list-columns.js';
import { ListFilters, type FilterControl } from '../../admin/entry/list-filters.js';
import { ListHeaderCheck, ListRowCheck, ListSelection } from '../../admin/entry/list-selection.js';
import { ListSearch } from '../../admin/entry/list-search.js';
import {
  applyFilters,
  activeCount,
  cellText,
  columnChoices,
  columnCookie,
  columnSpecs,
  parseColumnCookie,
  visibleColumns,
  filterParams,
  filterSpecs,
  filtersFollowColumns,
  filterValues,
  listQuery,
  nextSort,
  parseFilters,
  parseSort,
  sortItems,
  type Column,
} from '../content/list-filters.js';
import { listView, parsePage } from '../content/list-view.js';
import { agentTokens } from '../mcp/tokens.js';
import { DeleteButton } from '../../admin/entry/delete-button.js';
import { MediaDeleteButton } from '../../admin/shell/media-delete-button.js';
import { mediaName } from '../../admin/shell/media-name.js';
import { MediaSelectBox, MediaSelection, type MediaItem } from '../../admin/shell/media-selection.js';
import { EntryForm } from '../../admin/entry/entry-form.js';
import { Brand } from '../../admin/shell/brand.js';
import { resolveBrand } from './brand.js';
import { AdminHeader } from '../../admin/shell/header.js';
import { LoginForm } from '../../admin/shell/login-form.js';
import { AdminNav, type NavGroup } from '../../admin/shell/nav.js';
import { bodyClass, cardClass } from '../../admin/ui/styles.js';
import { isAdmin } from '../auth/auth.js';
import { loadRefOptions } from '../content/ref-options.js';
import { revOf } from '../content/rev.js';
import { SINGLETON_SLUG } from '../content/store.js';
import type { Context, ListAction } from '../context.js';

type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
type AnyEntry = Record<string, unknown>;

/** The entry's derived values as display strings, shown read-only in the form (see `derive()` for placement). */
function derivedRows(def: Singleton | Collection, entry: AnyEntry | null) {
  if (!entry) return [];
  const show = (v: unknown) =>
    v == null || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : typeof v === 'object' ? JSON.stringify(v) : displayText(v);
  const spaced = (k: string) =>
    k
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^./, (c) => c.toUpperCase())
      .replace(/ ([A-Z])/g, (m) => m.toLowerCase());
  return Object.entries(def.derived ?? {}).map(([key, fn]) => {
    const meta = fn as { label?: string; after?: string };
    return { key, label: meta.label ?? spaced(key), after: meta.after, value: show(entry[key]) };
  });
}

/** The stored fields only: derived values aren't editable, and the save schema rejects unknown keys. */
const fieldsOnly = (def: Singleton | Collection, entry: AnyEntry): AnyEntry => Object.fromEntries(Object.keys(def.fields).map((k) => [k, entry[k]]));

// The whole admin as one server component, mounted at <adminPath>/[[...path]]:
//   (none) dashboard · login · <singleton> · <collection> · <collection>/new · <collection>/<slug> · <extra page>

// mnml-admin marks a page that shows the admin (the token bridge in styles.css keys on it; the preview banner on
// site pages is a mnml-root too, so it can't).
const rootClass = 'mnml-root mnml-admin flex flex-1 flex-col bg-mnml-bg text-sm text-mnml-text [font-family:ui-sans-serif,system-ui,sans-serif]';

/** The admin screen for MCP tokens (`mcp: { adminTokens: true }`). */
const AGENT_ACCESS = 'agent-access';

export function createAdminPage<C extends CmsConfig>(ctx: Context<C>) {
  const { config, store, adminPath, apiPath, options } = ctx;
  const defs = Object.entries(config) as [string, Singleton | Collection][];
  const home = { label: 'Dashboard', href: adminPath };

  return async function AdminPage({ params, searchParams }: Props) {
    const path = (await params).path ?? [];
    const Editor = options.editor;
    const Ui = options.ui;
    const withEditor = (children: React.ReactNode) => (Editor ? <Editor>{children}</Editor> : children);
    // The site's UI slots wrap everything, so the confirm and form dialogs use them too.
    const provider = (children: React.ReactNode) => {
      const admin = (
        <AdminProvider value={{ adminPath, apiPath, mediaLibrary: options.media?.list ? true : false }}>
          <FormDialogProvider>{withEditor(children)}</FormDialogProvider>
        </AdminProvider>
      );
      return Ui ? <Ui>{admin}</Ui> : admin;
    };

    if (path.length === 1 && path[0] === 'login') {
      const adapter = ctx.authAdapter;
      // A custom adapter with a `loginUrl` signs in on your own page.
      if (adapter?.loginUrl) redirect(adapter.loginUrl);
      if (await isAdmin(ctx)) redirect(adminPath);
      const query = await searchParams;
      const brand = await resolveBrandOption();
      // Laid out with inline styles on purpose: this page must look right even when the host's Tailwind
      // build hasn't generated the admin's newest classes yet (e.g. a dev server that wasn't restarted).
      const line = 'color-mix(in srgb, var(--mnml-text) 14%, transparent)';
      const fade = 'radial-gradient(ellipse 75% 65% at 50% 38%, #000 25%, transparent 78%)';
      // Dashes: each line direction is its own layer, cut into 4px dashes along its length, then faded at the edges.
      const dashes = (to: string) => `repeating-linear-gradient(${to}, #000 0, #000 4px, transparent 4px, transparent 9px)`;
      const gridLayer = (lines: string, size: string, along: string) =>
        ({
          position: 'absolute',
          inset: 0,
          backgroundImage: lines,
          backgroundSize: size,
          backgroundPosition: 'center top',
          maskImage: `${dashes(along)}, ${fade}`,
          maskComposite: 'intersect',
          WebkitMaskImage: `${dashes(along)}, ${fade}`,
          WebkitMaskComposite: 'source-in',
        }) as React.CSSProperties;
      return provider(
        <main
          className={`${rootClass} bg-mnml-panel`}
          style={{ position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', minHeight: '100dvh' }}
        >
          <title>{`Sign in — ${brand.name}`}</title>
          {/* Decorative: a soft accent glow, and a dashed grid that fades out toward the edges. */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(48rem 24rem at 50% 0%, color-mix(in srgb, var(--mnml-accent) 80%, transparent), transparent)',
            }}
          />
          <div aria-hidden style={gridLayer(`linear-gradient(90deg, ${line} 1px, transparent 1px)`, '40px auto', 'to bottom')} />
          <div aria-hidden style={gridLayer(`linear-gradient(${line} 1px, transparent 1px)`, 'auto 40px', 'to right')} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', maxWidth: 384 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Brand name={brand.name} logo={brand.logo} size="login" />
            </div>
            <div
              style={{
                width: '100%',
                padding: 28,
                borderRadius: 12,
                border: '1px solid var(--mnml-line)',
                background: 'var(--mnml-bg)',
                boxShadow: '0 1px 3px rgb(0 0 0 / 0.08), 0 8px 24px rgb(0 0 0 / 0.04)',
              }}
            >
              <h1 style={{ fontSize: 20, fontWeight: 600, fontFamily: 'inherit', margin: 0 }}>Welcome back</h1>
              <p style={{ margin: '4px 0 24px', color: 'var(--mnml-text-mute)' }}>
                {adapter ? 'Sign in to continue.' : 'Enter the admin password to continue.'}
              </p>
              {adapter ? adapter.login : <LoginForm error={typeof query.error === 'string' ? query.error : undefined} />}
            </div>
            <Link href="/" className="no-underline hover:text-mnml-text" style={{ color: 'var(--mnml-text-mute)' }}>
              ← Back to site
            </Link>
          </div>
        </main>,
      );
    }
    if (!(await isAdmin(ctx))) redirect(ctx.loginUrl);

    const content = await screen(path, await searchParams);
    const brand = await resolveBrandOption();
    return provider(
      <div className={`${rootClass} md:flex-row`}>
        <title>{`${brand.name} — Admin`}</title>
        <AdminNav brand={brand.name} logo={brand.logo} groups={navGroups()} signOutEverywhere={!ctx.authAdapter} />
        <div className="flex min-w-0 flex-1 flex-col">{content}</div>
      </div>,
    );
  };

  /** Published entries of every collection that `def`'s reference fields point at, for the pickers. */
  // A declaration, not a const: it is defined below the `return` above, and only function declarations are hoisted.
  function refOptions(def: Singleton | Collection): Promise<RefOptions> {
    return loadRefOptions(ctx, referenceTargets(def.fields));
  }

  async function resolveBrandOption() {
    return resolveBrand(typeof options.brand === 'function' ? await options.brand() : options.brand);
  }

  function navGroups(): NavGroup[] {
    const icon = (key: string, def: Singleton | Collection) =>
      options.icons?.[key as keyof C] ?? (def.kind === 'singleton' ? <SettingsIcon /> : <FileTextIcon />);
    const groups: NavGroup[] = [
      {
        title: 'Singletons',
        items: defs.filter(([, d]) => d.kind === 'singleton').map(([k, d]) => ({ href: `${adminPath}/${k}`, label: d.label, icon: icon(k, d) })),
      },
      {
        title: 'Collections',
        items: defs.filter(([, d]) => d.kind === 'collection').map(([k, d]) => ({ href: `${adminPath}/${k}`, label: d.label, icon: icon(k, d) })),
      },
    ];
    for (const p of options.pages ?? []) {
      const title = p.group ?? 'Tools';
      let group = groups.find((g) => g.title === title);
      if (!group) groups.push((group = { title, items: [] }));
      group.items.push({ href: `${adminPath}/${p.path}`, label: p.label, icon: p.icon ?? <FileTextIcon /> });
    }
    if (options.mcp?.adminTokens && !Object.hasOwn(config, AGENT_ACCESS)) {
      let tools = groups.find((g) => g.title === 'Tools');
      if (!tools) groups.push((tools = { title: 'Tools', items: [] }));
      tools.items.push({ href: `${adminPath}/${AGENT_ACCESS}`, label: 'Agent access', icon: <KeyRoundIcon /> });
    }
    if (options.media?.list && !Object.hasOwn(config, 'media')) {
      groups.push({ title: 'Library', items: [{ href: `${adminPath}/media`, label: 'Media', icon: <ImageIcon /> }] });
    }
    return groups.filter((g) => g.items.length > 0);
  }

  async function screen([key, sub, ...rest]: string[], query: Record<string, string | string[] | undefined>): Promise<React.ReactNode> {
    if (!key) return dashboard();
    if (rest.length) notFound();

    const extra = options.pages?.find((p) => p.path === key);
    if (extra && !sub) return extra.render();
    if (key === 'media' && !sub && !Object.hasOwn(config, 'media')) return mediaScreen();
    if (key === AGENT_ACCESS && !sub && options.mcp?.adminTokens && !Object.hasOwn(config, AGENT_ACCESS)) return agentAccessScreen();

    const def = Object.hasOwn(config, key) ? (config[key] as Singleton | Collection) : undefined;
    if (!def) notFound();

    if (def.kind === 'singleton') {
      if (sub) notFound();
      const stored = (await store.getSingleton(key as never, { drafts: false })) as AnyEntry | null;
      // With drafts on, the autosaved draft replaces the live version in the form.
      const pending = def.drafts ? ((await store.getPending(key, SINGLETON_SLUG)) as AnyEntry | undefined) : undefined;
      // A singleton that was never saved starts like a new entry: with the fields' defaults.
      const entry = pending ? (withDefaults(def.fields, pending) as AnyEntry) : (stored ?? initialValues(def.fields));
      const request = await store.getRequest(key, SINGLETON_SLUG);
      return (
        <EntryForm
          banner={request && <AgentRequest schemaKey={key} action={request.action} by={request.by} at={request.at} />}
          schemaKey={key}
          schema={plainDef(def)}
          initial={fieldsOnly(def, entry as AnyEntry)}
          hasPending={pending !== undefined}
          rev={revOf(def, pending ?? stored)}
          derived={derivedRows(def, stored)}
          refOptions={await refOptions(def)}
          crumbs={[home, { label: def.label }]}
        />
      );
    }

    const listCrumb = { label: def.label, href: `${adminPath}/${key}` };
    if (!sub) return collectionList(key, def, query);
    if (sub === 'new') {
      return (
        <EntryForm
          schemaKey={key}
          schema={plainDef(def)}
          initial={initialValues(def.fields)}
          refOptions={await refOptions(def)}
          crumbs={[home, listCrumb, { label: 'New' }]}
        />
      );
    }

    const entry = (await store.getEntry(key as never, sub, { drafts: false, all: true })) as AnyEntry | null;
    if (!entry) notFound();
    const status = (await store.getStatus(key, sub)) ?? 'published';
    // Saved edits that aren't published yet replace the live version in the form.
    const pending = (await store.getPending(key, sub)) as AnyEntry | undefined;
    const title = displayText(entry[def.titleField]) || sub;
    const request = await store.getRequest(key, sub);
    return (
      // key: remount with fresh state after a create redirect
      <EntryForm
        key={sub}
        banner={request && <AgentRequest schemaKey={key} slug={sub} action={request.action} by={request.by} at={request.at} />}
        schemaKey={key}
        schema={plainDef(def)}
        slug={sub}
        initial={fieldsOnly(def, pending ? (withDefaults(def.fields, pending) as AnyEntry) : entry)}
        hasPending={pending !== undefined}
        rev={revOf(def, pending ?? entry)}
        derived={derivedRows(def, entry)}
        status={status}
        refOptions={await refOptions(def)}
        notice={query.created ? 'Created' : undefined}
        crumbs={[home, listCrumb, { label: title }]}
        actions={
          <>
            {status === 'published' && (
              <Link href={`${def.basePath}/${sub}`} target="_blank" role="menuitem" className={menuItemClass}>
                <ExternalLinkIcon /> View on site
              </Link>
            )}
            <DeleteButton schemaKey={key} slug={sub} title={title} />
          </>
        }
      />
    );
  }

  /** Where each stored file is used: any `<apiPath>/media/<key>` in an entry's data (image fields and rich-text images). */
  type Use = { group: string; entry: string; href: string; pending?: boolean };
  async function mediaUsage() {
    const found = new Map<string, Use[]>();
    const pattern = new RegExp(`${apiPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/media/([\\w.\\-/]+)`, 'g');
    const scan = (data: unknown, use: Use) => {
      for (const m of JSON.stringify(data).matchAll(pattern)) {
        const list = found.get(m[1]) ?? [];
        if (!list.some((u) => u.href === use.href && u.pending === use.pending)) list.push(use);
        found.set(m[1], list);
      }
    };
    for (const [key, def] of defs) {
      if (def.kind === 'singleton') {
        const use = { group: key, entry: def.label, href: `${adminPath}/${key}` };
        scan(await store.getSingleton(key as never, { drafts: false }), use);
        const pending = def.drafts ? await store.getPending(key, SINGLETON_SLUG) : undefined;
        if (pending !== undefined) scan(pending, { ...use, pending: true });
        continue;
      }
      const items = (await store.listEntries(key as never, { drafts: false, all: true } as never)) as { slug: string; entry: AnyEntry }[];
      for (const { slug, entry } of items) {
        const use = { group: key, entry: displayText(entry[def.titleField]) || slug, href: `${adminPath}/${key}/${slug}` };
        scan(fieldsOnly(def, entry), use);
        const pending = await store.getPending(key, slug);
        if (pending !== undefined) scan(pending, { ...use, pending: true });
      }
    }
    return found;
  }

  async function agentAccessScreen() {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
    const proto = h.get('x-forwarded-proto') ?? (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
    const configTokens = (options.mcp?.tokens ?? [])
      .filter((t) => t.token)
      .map((t) => ({ name: t.name ?? 'agent', scopes: t.scopes ?? ['read', 'draft'], collections: t.collections ?? null }));
    return (
      <>
        <AdminHeader crumbs={[home, { label: 'Agent access' }]} />
        <main className={bodyClass}>
          <AgentAccess
            tokens={await agentTokens(ctx as unknown as Context).list()}
            configTokens={configTokens}
            content={defs.map(([key, def]) => ({ key, label: def.label }))}
            mcpUrl={`${proto}://${host}${apiPath}/mcp`}
          />
        </main>
      </>
    );
  }

  async function mediaScreen() {
    const media = options.media;
    const files = media?.list ? (await media.list()).sort((a, b) => (b.uploadedAt?.getTime() ?? 0) - (a.uploadedAt?.getTime() ?? 0)) : null;
    const usage = files ? await mediaUsage() : new Map<string, Use[]>();
    const unused = files?.filter((f) => !usage.has(f.key)) ?? [];
    // One section per singleton/collection that uses files (a file used in two places appears in both), then unused files.
    const sections = defs
      .map(([key, def]) => ({ key, label: def.label, files: (files ?? []).filter((f) => usage.get(f.key)?.some((u) => u.group === key)) }))
      .filter((g) => g.files.length > 0);
    const size = (n?: number) => (n === undefined ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

    const card = (f: { key: string; size?: number; uploadedAt?: Date }) => {
      const name = mediaName(f.key);
      const meta = [size(f.size), f.uploadedAt?.toLocaleDateString('en-US', { dateStyle: 'medium' })].filter(Boolean).join(' · ');
      return (
        <li key={f.key} className="relative flex flex-col overflow-hidden rounded-[8px] bg-mnml-panel">
          {media?.delete && <MediaSelectBox mediaKey={f.key} name={name} />}
          {/* Plain <img>: served by the CMS media route. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${apiPath}/media/${f.key}`} alt="" loading="lazy" className="aspect-[4/3] w-full bg-mnml-surface object-cover" />
          <div className="flex flex-1 flex-col gap-1" style={{ padding: '12px 14px 6px' }}>
            <p className="truncate text-sm font-medium" title={name}>
              {name}
            </p>
            <p className="text-xs text-mnml-text-mute">{meta}</p>
          </div>
          {media?.delete && (
            <div className="flex" style={{ padding: '2px 8px 8px' }}>
              <MediaDeleteButton mediaKey={f.key} name={name} usedIn={(usage.get(f.key) ?? []).length} />
            </div>
          )}
        </li>
      );
    };

    const items: MediaItem[] = (files ?? []).map((f) => ({ key: f.key, name: mediaName(f.key), usedIn: (usage.get(f.key) ?? []).length }));
    const summary = `${files?.length ?? 0} ${files?.length === 1 ? 'file' : 'files'} · ${unused.length} unused`;
    const grid = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    const section = (title: string, hint: string | null, list: React.ReactNode[], count: number) => (
      <section key={title} className="flex flex-col gap-3">
        <h2 className="flex items-baseline gap-2 text-sm font-semibold [font-family:inherit]">
          {title}
          <span className="font-normal text-mnml-text-mute">{count}</span>
        </h2>
        {hint && <p className="-mt-1 text-xs text-mnml-text-mute">{hint}</p>}
        <ul className={grid}>{list}</ul>
      </section>
    );

    return (
      <>
        <AdminHeader crumbs={[home, { label: 'Media' }]} />
        <main className={`${bodyClass} flex max-w-6xl flex-col gap-8`}>
          {!files ? (
            <p className="text-mnml-text-mute">{media ? 'This media storage cannot list files.' : 'Image uploads are not configured.'}</p>
          ) : files.length === 0 ? (
            <p className="text-mnml-text-mute">No files yet. Images you upload in the editor appear here.</p>
          ) : (
            <MediaSelection items={items} summary={summary} canSelect={media?.delete ? true : false}>
              {sections.map((g) =>
                section(
                  g.label,
                  null,
                  g.files.map((f) => card(f)),
                  g.files.length,
                ),
              )}
              {unused.length > 0 &&
                section(
                  'Unused',
                  'Not used by any entry. Safe to delete.',
                  unused.map((f) => card(f)),
                  unused.length,
                )}
            </MediaSelection>
          )}
        </main>
      </>
    );
  }

  async function dashboard() {
    const collections = defs.filter(([, d]) => d.kind === 'collection');
    const counts = await Promise.all(collections.map(async ([k]) => (await store.listSlugs(k as never, { all: true })).length));
    return (
      <>
        <AdminHeader crumbs={[{ label: 'Dashboard' }]} />
        <main className={`${bodyClass} flex flex-col gap-8`}>
          <Section title="Singletons">
            {defs
              .filter(([, d]) => d.kind === 'singleton')
              .map(([k, d]) => (
                <Card key={k} href={`${adminPath}/${k}`} title={d.label} />
              ))}
          </Section>
          <Section title="Collections">
            {collections.map(([k, d], i) => (
              <Card key={k} href={`${adminPath}/${k}`} title={d.label} detail={`${counts[i]} ${counts[i] === 1 ? 'entry' : 'entries'}`}>
                <Link
                  href={`${adminPath}/${k}/new`}
                  aria-label={`New ${d.label}`}
                  className={buttonVariants({ variant: 'outline', size: 'icon-sm', className: 'relative z-10 no-underline' })}
                >
                  <PlusIcon />
                </Link>
              </Card>
            ))}
          </Section>
        </main>
      </>
    );
  }

  async function collectionList(key: string, def: Collection, query: Record<string, string | string[] | undefined>) {
    // Columns (the title and the first date unless `columns` says otherwise) and filters (every filterable field unless `filters` says otherwise).
    // The editor's choice of columns (a cookie, if the collection allows it), else the default table.
    const cookieValue = (await cookies()).get(columnCookie(key))?.value;
    const columns = visibleColumns(def, cookieValue);
    const choices = columnChoices(def);
    // Once an editor has chosen columns, filters follow them: a hidden column's filter is not shown or applied.
    const follow = filtersFollowColumns(filterSpecs(def), columns, def.columnChoices !== false && parseColumnCookie(cookieValue) !== undefined);
    const specs = follow.specs;
    const dateField = Object.entries(def.fields).find(([, f]) => f.type === 'date')?.[0];
    const all = (await store.listEntries(
      key as never,
      {
        drafts: false,
        all: true,
        ...(dateField && { orderBy: dateField, order: 'desc' }),
      } as never,
    )) as { slug: string; entry: AnyEntry; status: EntryStatus }[];
    const pending = await store.listPending(key);
    // References show their target's title; the filter lists the same options.
    const refTargets = [...specs.map((s) => s.field), ...columns.flatMap((c) => (c.field ? [c.field] : []))].flatMap((f) =>
      f.type === 'reference' ? [f.collection] : [],
    );
    const refOptions = refTargets.length ? await loadRefOptions(ctx, refTargets) : {};
    const cell = { pending, refLabel: (c: string, slug: string) => refOptions[c]?.find((o) => o.slug === slug)?.label ?? slug };
    // Filters, sort, search (title or slug) and paging, all from the URL.
    // `filters: false` turns the whole control off, the status filter too.
    const filtersOn = def.filters !== false;
    const parsed = filtersOn ? parseFilters(query, specs) : { fields: {} };
    const filters = follow.status ? parsed : { ...parsed, status: undefined };
    const sort = parseSort(query, columns);
    const q = typeof query.q === 'string' ? query.q : '';
    const narrowed = sortItems(applyFilters(all, filters, specs, pending), sort, columns, cell);
    const view = listView(narrowed, { q, page: parsePage(query.page), title: (i) => displayText(i.entry[def.titleField]) });
    const items = view.items;
    const filtered = activeCount(filters) > 0;
    const listBase = `${adminPath}/${key}`;
    const hrefFor = (o: { q?: string; filters?: typeof filters; sort?: typeof sort; page?: number }) =>
      `${listBase}${listQuery({ q: 'q' in o ? o.q : q, filters: o.filters ?? filters, sort: 'sort' in o ? o.sort : sort, page: o.page }, specs)}`;
    const pageHref = (n: number) => hrefFor({ page: n });
    const keep = [...new URLSearchParams(listQuery({ filters, sort }, specs))] as [string, string][];
    const optionsOf = (f: (typeof specs)[number]['field']) =>
      f.type === 'select'
        ? f.options.map((o) => ({ value: o, label: f.optionLabels?.[o] ?? o }))
        : f.type === 'boolean'
          ? [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]
          : f.type === 'reference'
            ? (refOptions[f.collection] ?? []).map((o) => ({ value: o.slug, label: o.label }))
            : undefined;
    const statusControl: FilterControl = {
      name: 'status',
      label: 'Status',
      kind: 'select',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'changes', label: 'Changes' },
        { value: 'published', label: 'Published' },
      ],
      eq: 'status',
      from: '',
      to: '',
    };
    const controls: FilterControl[] = [
      ...(follow.status ? [statusControl] : []),
      ...specs.map((s): FilterControl => {
        const p = filterParams(s);
        return {
          name: s.name,
          label: s.label,
          kind: s.field.type === 'date' || s.field.type === 'datetime' ? 'date' : s.field.type === 'number' ? 'number' : 'select',
          options: optionsOf(s.field),
          ...p,
        };
      }),
    ];
    const pageLink = (n: number, label: string, icon: React.ReactNode, disabled: boolean) =>
      disabled ? (
        <span aria-disabled="true" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'pointer-events-none opacity-50' })}>
          {icon} {label}
        </span>
      ) : (
        <Link
          href={pageHref(n)}
          rel={label === 'Next' ? 'next' : 'prev'}
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'no-underline' })}
        >
          {icon} {label}
        </Link>
      );
    // A sortable column header: a link that cycles ascending, descending, default order.
    const heading = (col: Column) => {
      const active = sort?.key === col.key;
      const Icon = !active ? ChevronsUpDownIcon : sort.dir === 'asc' ? ArrowUpIcon : ArrowDownIcon;
      return (
        <th
          key={col.key}
          aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
          className={`px-4 py-2 font-medium ${col.key === 'slug' ? 'max-sm:hidden' : col.key === 'status' ? 'w-28' : ''}`}
        >
          <Link href={hrefFor({ sort: nextSort(sort, col.key) })} className="inline-flex items-center gap-1 text-inherit no-underline hover:text-mnml-text">
            {col.label}
            <Icon className={`size-3.5 ${active ? 'text-mnml-text' : 'text-mnml-text-mute opacity-60'}`} />
          </Link>
        </th>
      );
    };
    const requests = await store.listRequests(key);
    const cols = columns.length;
    // The selection's rows (what each one's status is), and the site's own actions for this collection.
    const rows = items.map((i) => ({
      slug: i.slug,
      status: i.status === 'draft' ? ('draft' as const) : pending.has(i.slug) ? ('changes' as const) : ('published' as const),
    }));
    const customActions = ((options.listActions as Record<string, ListAction[] | undefined> | undefined)?.[key] ?? []).map(
      ({ name, label, danger, confirm }) => ({ name, label, danger, confirm }),
    );
    return (
      <>
        <AdminHeader crumbs={[home, { label: def.label }]}>
          <Link href={`${adminPath}/${key}/new`} className={buttonVariants({ className: 'no-underline' })}>
            <PlusIcon /> Create
          </Link>
        </AdminHeader>
        {/* A table wants the whole width (the form width cap is for readable lines). */}
        <main className={`${bodyClass.replace('max-w-3xl', 'max-w-none')} flex flex-col gap-4`}>
          <ListSelection key={hrefFor({ page: view.page })} collection={key} rows={rows} actions={customActions}>
            {all.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <ListSearch q={q} label={def.label} keep={keep} />
                {filtersOn && controls.length > 0 && <ListFilters controls={controls} values={filterValues(filters, specs)} />}
                {choices.length > 0 && (
                  <ListColumns
                    cookie={columnCookie(key)}
                    primary={columnSpecs(def)[0].label}
                    choices={choices.map(({ key: k, label }) => ({ key: k, label }))}
                    visible={columns.filter((c) => choices.some((x) => x.key === c.key)).map((c) => c.key)}
                    defaults={columnSpecs(def)
                      .filter((c) => choices.some((x) => x.key === c.key))
                      .map((c) => c.key)}
                    customized={parseColumnCookie(cookieValue) !== undefined}
                  />
                )}
              </div>
            )}
            <div className={`${cardClass} overflow-x-auto`}>
              <table className="w-full text-left">
                <thead className="border-b border-mnml-line bg-mnml-panel text-mnml-text-soft">
                  <tr>
                    <th className="w-10 px-3 py-2">
                      <ListHeaderCheck label={def.label.toLowerCase()} />
                    </th>
                    {columns.map(heading)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-mnml-line">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={cols + 1} className="px-4 py-6 text-center text-mnml-text-mute">
                        {all.length === 0 ? (
                          'No entries yet.'
                        ) : (
                          <>
                            No entries match {q.trim() && filtered ? 'this search and these filters' : q.trim() ? `“${q.trim()}”` : 'these filters'}.{' '}
                            <Link href={hrefFor({ q: '', filters: { fields: {} } })} className="text-mnml-link">
                              {q.trim() && filtered ? 'Clear all' : q.trim() ? 'Clear search' : 'Clear filters'}
                            </Link>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                  {items.map((item) => {
                    const { slug, status } = item;
                    return (
                      // The title link's overlay makes the whole row clickable.
                      <tr key={slug} className="relative hover:bg-mnml-panel">
                        <td className="w-10 px-3 py-2.5">
                          <ListRowCheck slug={slug} name={cellText(item, columns[0], cell) || slug} />
                        </td>
                        {columns.map((col, i) =>
                          col.key === 'slug' ? (
                            <td
                              key={col.key}
                              className="px-4 py-2.5 [font-family:ui-monospace,monospace] text-xs whitespace-nowrap text-mnml-text-mute max-sm:hidden"
                            >
                              {slug}
                            </td>
                          ) : col.key === 'status' ? (
                            <td key={col.key} className="px-4 py-2.5">
                              <span className="flex items-center gap-2 text-mnml-text-soft">
                                <StatusDot state={status === 'draft' ? 'draft' : pending.has(slug) ? 'changes' : 'published'} />
                                {status === 'draft' ? 'Draft' : pending.has(slug) ? 'Changes' : 'Published'}
                              </span>
                            </td>
                          ) : i === 0 ? (
                            <td key={col.key} className="px-4 py-2.5">
                              <Link href={`${adminPath}/${key}/${slug}`} className="font-medium no-underline after:absolute after:inset-0">
                                {cellText(item, col, cell) || slug}
                              </Link>
                              {requests.has(slug) && (
                                <span className="mt-1 block w-fit rounded-full bg-mnml-warn px-2 py-0.5 text-xs font-medium whitespace-nowrap text-mnml-on-warn sm:mt-0 sm:ml-2 sm:inline-block">
                                  Awaiting approval
                                </span>
                              )}
                            </td>
                          ) : (
                            <td key={col.key} className="px-4 py-2.5 tabular-nums whitespace-nowrap text-mnml-text-soft">
                              {cellText(item, col, cell) || '—'}
                            </td>
                          ),
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {view.pages > 1 && (
              <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-mnml-text-soft">
                <span className="tabular-nums">
                  {view.from}–{view.to} of {view.total}
                </span>
                <span className="flex gap-2">
                  {pageLink(view.page - 1, 'Previous', <ChevronLeftIcon />, view.page <= 1)}
                  {pageLink(view.page + 1, 'Next', <ChevronRightIcon />, view.page >= view.pages)}
                </span>
              </nav>
            )}
          </ListSelection>
        </main>
      </>
    );
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold [font-family:inherit]">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Card({ href, title, detail, children }: { href: string; title: string; detail?: string; children?: React.ReactNode }) {
  return (
    <div className={`${cardClass} relative flex items-center gap-3 px-4 py-3 hover:border-mnml-text-mute`}>
      <div className="min-w-0 flex-1">
        {/* The overlay makes the whole card clickable while keeping the + button separate. */}
        <Link href={href} className="font-medium no-underline after:absolute after:inset-0">
          {title}
        </Link>
        {detail && <div className="text-mnml-text-mute">{detail}</div>}
      </div>
      {children}
    </div>
  );
}
