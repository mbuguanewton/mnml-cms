import 'server-only';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ExternalLinkIcon, FileTextIcon, ImageIcon, PlusIcon, SettingsIcon } from 'lucide-react';
import { plainDef, referenceTargets, withDefaults, type Collection, type CmsConfig, type Singleton } from '../define.js';
import type { EntryStatus } from '../api.js';
import type { RefOptions } from '../admin/fields.js';
import { buttonVariants } from '../admin/button.js';
import { menuItemClass } from '../admin/action-menu.js';
import { StatusDot } from '../admin/status-dot.js';
import { AdminProvider } from '../admin/context.js';
import { DeleteButton } from '../admin/delete-button.js';
import { MediaDeleteButton } from '../admin/media-delete-button.js';
import { EntryForm } from '../admin/entry-form.js';
import { AdminHeader } from '../admin/header.js';
import { LoginForm } from '../admin/login-form.js';
import { AdminNav, type NavGroup } from '../admin/nav.js';
import { bodyClass, cardClass } from '../admin/styles.js';
import { isAdmin } from './auth.js';
import type { Context } from './context.js';

type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
type AnyEntry = Record<string, unknown>;

/** The entry's derived values as display strings, shown read-only in the form (see `derive()` for placement). */
function derivedRows(def: Singleton | Collection, entry: AnyEntry | null) {
  if (!entry) return [];
  const show = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const spaced = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()).replace(/ ([A-Z])/g, (m) => m.toLowerCase());
  return Object.entries(def.derived ?? {}).map(([key, fn]) => {
    const meta = fn as { label?: string; after?: string };
    return { key, label: meta.label ?? spaced(key), after: meta.after, value: show(entry[key]) };
  });
}

/** The stored fields only: derived values aren't editable, and the save schema rejects unknown keys. */
const fieldsOnly = (def: Singleton | Collection, entry: AnyEntry): AnyEntry => Object.fromEntries(Object.keys(def.fields).map((k) => [k, entry[k]]));

// The whole admin as one server component, mounted at <adminPath>/[[...path]]:
//   (none) dashboard · login · <singleton> · <collection> · <collection>/new · <collection>/<slug> · <extra page>

const rootClass = 'cms-root flex flex-1 flex-col bg-cms-bg text-sm text-cms-text [font-family:ui-sans-serif,system-ui,sans-serif]';

export function createAdminPage<C extends CmsConfig>(ctx: Context<C>) {
  const { config, store, adminPath, apiPath, options } = ctx;
  const defs = Object.entries(config) as [string, Singleton | Collection][];
  const home = { label: 'Dashboard', href: adminPath };

  return async function AdminPage({ params, searchParams }: Props) {
    const path = (await params).path ?? [];
    const provider = (children: React.ReactNode) => <AdminProvider value={{ adminPath, apiPath }}>{children}</AdminProvider>;

    if (path.length === 1 && path[0] === 'login') {
      const adapter = ctx.authAdapter;
      // A custom adapter with a `loginUrl` signs in on your own page.
      if (adapter?.loginUrl) redirect(adapter.loginUrl);
      if (await isAdmin(ctx)) redirect(adminPath);
      const brand = await brandName();
      // Laid out with inline styles on purpose: this page must look right even when the host's Tailwind
      // build hasn't generated the admin's newest classes yet (e.g. a dev server that wasn't restarted).
      const line = 'color-mix(in srgb, var(--cms-text) 14%, transparent)';
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
          className={`${rootClass} bg-cms-panel`}
          style={{ position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}
        >
          <title>{`Sign in — ${brand}`}</title>
          {/* Decorative: a soft accent glow, and a dashed grid that fades out toward the edges. */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(48rem 24rem at 50% 0%, color-mix(in srgb, var(--cms-accent) 80%, transparent), transparent)' }} />
          <div aria-hidden style={gridLayer(`linear-gradient(90deg, ${line} 1px, transparent 1px)`, '40px auto', 'to bottom')} />
          <div aria-hidden style={gridLayer(`linear-gradient(${line} 1px, transparent 1px)`, 'auto 40px', 'to right')} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', maxWidth: 384 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <span
                className="font-cms-brand"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  fontSize: 24,
                  fontWeight: 700,
                  background: 'var(--cms-primary)',
                  color: 'var(--cms-on-primary)',
                  boxShadow: '0 1px 2px rgb(0 0 0 / 0.12)',
                }}
              >
                {brand[0] ?? 'A'}
              </span>
              <span className="font-cms-brand" style={{ fontSize: 18, fontWeight: 600 }}>
                {brand}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                padding: 28,
                borderRadius: 12,
                border: '1px solid var(--cms-line)',
                background: 'var(--cms-bg)',
                boxShadow: '0 1px 3px rgb(0 0 0 / 0.08), 0 8px 24px rgb(0 0 0 / 0.04)',
              }}
            >
              <h1 style={{ fontSize: 20, fontWeight: 600, fontFamily: 'inherit', margin: 0 }}>Welcome back</h1>
              <p style={{ margin: '4px 0 24px', color: 'var(--cms-text-mute)' }}>{adapter ? 'Sign in to continue.' : 'Enter the admin password to continue.'}</p>
              {adapter ? adapter.login : <LoginForm />}
            </div>
            <Link href="/" className="no-underline hover:text-cms-text" style={{ color: 'var(--cms-text-mute)' }}>
              ← Back to site
            </Link>
          </div>
        </main>,
      );
    }
    if (!(await isAdmin(ctx))) redirect(ctx.loginUrl);

    const content = await screen(path, await searchParams);
    const brand = await brandName();
    return provider(
      <div className={`${rootClass} md:flex-row`}>
        <title>{`${brand} — Admin`}</title>
        <AdminNav brand={brand} groups={navGroups()} signOutEverywhere={!ctx.authAdapter} />
        <div className="flex min-w-0 flex-1 flex-col">{content}</div>
      </div>,
    );
  };

  /** Published entries of every collection that `def`'s reference fields point at, for the pickers. */
  async function refOptions(def: Singleton | Collection): Promise<RefOptions> {
    const out: RefOptions = {};
    for (const target of referenceTargets(def.fields)) {
      const t = Object.hasOwn(config, target) ? config[target] : undefined;
      if (t?.kind !== 'collection') continue;
      const items = (await store.listEntries(target as never, { drafts: false, orderBy: t.titleField } as never)) as { slug: string; entry: AnyEntry }[];
      out[target] = items.map(({ slug, entry }) => ({ slug, label: String(entry[t.titleField] || slug) }));
    }
    return out;
  }

  async function brandName() {
    return typeof options.brand === 'function' ? await options.brand() : (options.brand ?? 'Admin');
  }

  function navGroups(): NavGroup[] {
    const icon = (key: string, def: Singleton | Collection) =>
      options.icons?.[key as keyof C] ?? (def.kind === 'singleton' ? <SettingsIcon /> : <FileTextIcon />);
    const groups: NavGroup[] = [
      { title: 'Singletons', items: defs.filter(([, d]) => d.kind === 'singleton').map(([k, d]) => ({ href: `${adminPath}/${k}`, label: d.label, icon: icon(k, d) })) },
      { title: 'Collections', items: defs.filter(([, d]) => d.kind === 'collection').map(([k, d]) => ({ href: `${adminPath}/${k}`, label: d.label, icon: icon(k, d) })) },
    ];
    for (const p of options.pages ?? []) {
      const title = p.group ?? 'Tools';
      let group = groups.find((g) => g.title === title);
      if (!group) groups.push((group = { title, items: [] }));
      group.items.push({ href: `${adminPath}/${p.path}`, label: p.label, icon: p.icon ?? <FileTextIcon /> });
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

    const def = Object.hasOwn(config, key) ? (config[key] as Singleton | Collection) : undefined;
    if (!def) notFound();

    if (def.kind === 'singleton') {
      if (sub) notFound();
      const stored = (await store.getSingleton(key as never, { drafts: false })) as AnyEntry | null;
      const entry = stored ?? withDefaults(def.fields, {});
      return <EntryForm schemaKey={key} schema={plainDef(def)} initial={fieldsOnly(def, entry as AnyEntry)} derived={derivedRows(def, stored)} refOptions={await refOptions(def)} crumbs={[home, { label: def.label }]} />;
    }

    const listCrumb = { label: def.label, href: `${adminPath}/${key}` };
    if (!sub) return collectionList(key, def);
    if (sub === 'new') {
      return <EntryForm schemaKey={key} schema={plainDef(def)} initial={withDefaults(def.fields, {})} refOptions={await refOptions(def)} crumbs={[home, listCrumb, { label: 'New' }]} />;
    }

    const entry = (await store.getEntry(key as never, sub, { drafts: false, all: true })) as AnyEntry | null;
    if (!entry) notFound();
    const status = (await store.getStatus(key, sub)) ?? 'published';
    // Saved edits that aren't published yet replace the live version in the form.
    const pending = (await store.getPending(key, sub)) as AnyEntry | undefined;
    const title = String(entry[def.titleField] || sub);
    return (
      // key: remount with fresh state after a create redirect
      <EntryForm
        key={sub}
        schemaKey={key}
        schema={plainDef(def)}
        slug={sub}
        initial={fieldsOnly(def, pending ? (withDefaults(def.fields, pending) as AnyEntry) : entry)}
        hasPending={pending !== undefined}
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
        scan(await store.getSingleton(key as never, { drafts: false }), { group: key, entry: def.label, href: `${adminPath}/${key}` });
        continue;
      }
      const items = (await store.listEntries(key as never, { drafts: false, all: true } as never)) as { slug: string; entry: AnyEntry }[];
      for (const { slug, entry } of items) {
        const use = { group: key, entry: String(entry[def.titleField] || slug), href: `${adminPath}/${key}/${slug}` };
        scan(fieldsOnly(def, entry), use);
        const pending = await store.getPending(key, slug);
        if (pending !== undefined) scan(pending, { ...use, pending: true });
      }
    }
    return found;
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
      // Uploaded names carry a random prefix or suffix; show the readable part.
      const name = (f.key.split('/').pop() ?? f.key).replace(/^[0-9a-f]{8}-/, '');
      const meta = [size(f.size), f.uploadedAt?.toLocaleDateString('en-US', { dateStyle: 'medium' })].filter(Boolean).join(' · ');
      return (
        <li key={f.key} className="flex flex-col overflow-hidden rounded-[8px] bg-cms-panel">
          {/* Plain <img>: served by the CMS media route. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${apiPath}/media/${f.key}`} alt="" loading="lazy" className="aspect-[4/3] w-full bg-cms-surface object-cover" />
          <div className="flex flex-1 flex-col gap-1" style={{ padding: '12px 14px 6px' }}>
            <p className="truncate text-sm font-medium" title={name}>
              {name}
            </p>
            <p className="text-xs text-cms-text-mute">{meta}</p>
          </div>
          {media?.delete && (
            <div className="flex" style={{ padding: '2px 8px 8px' }}>
              <MediaDeleteButton mediaKey={f.key} name={name} usedIn={(usage.get(f.key) ?? []).length} />
            </div>
          )}
        </li>
      );
    };

    const grid = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    const section = (title: string, hint: string | null, list: React.ReactNode[], count: number) => (
      <section key={title} className="flex flex-col gap-3">
        <h2 className="flex items-baseline gap-2 text-sm font-semibold [font-family:inherit]">
          {title}
          <span className="font-normal text-cms-text-mute">{count}</span>
        </h2>
        {hint && <p className="-mt-1 text-xs text-cms-text-mute">{hint}</p>}
        <ul className={grid}>{list}</ul>
      </section>
    );

    return (
      <>
        <AdminHeader crumbs={[home, { label: 'Media' }]} />
        <main className={`${bodyClass} flex max-w-6xl flex-col gap-8`}>
          {!files ? (
            <p className="text-cms-text-mute">{media ? 'This media storage cannot list files.' : 'Image uploads are not configured.'}</p>
          ) : files.length === 0 ? (
            <p className="text-cms-text-mute">No files yet. Images you upload in the editor appear here.</p>
          ) : (
            <>
              <p className="text-cms-text-mute">
                {files.length} {files.length === 1 ? 'file' : 'files'} · {unused.length} unused
              </p>
              {sections.map((g) =>
                section(
                  g.label,
                  null,
                  g.files.map((f) => card(f)),
                  g.files.length,
                ),
              )}
              {unused.length > 0 && section('Unused', 'Not used by any entry. Safe to delete.', unused.map((f) => card(f)), unused.length)}
            </>
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

  async function collectionList(key: string, def: Collection) {
    // Columns: the title field, the slug, and the first date field if there is one (newest first).
    const dateField = Object.entries(def.fields).find(([, f]) => f.type === 'date')?.[0];
    const items = (await store.listEntries(key as never, {
      drafts: false,
      all: true,
      ...(dateField && { orderBy: dateField, order: 'desc' }),
    } as never)) as { slug: string; entry: AnyEntry; status: EntryStatus }[];
    const pending = await store.listPending(key);
    const cols = dateField ? 4 : 3;
    return (
      <>
        <AdminHeader crumbs={[home, { label: def.label }]}>
          <Link href={`${adminPath}/${key}/new`} className={buttonVariants({ className: 'no-underline' })}>
            <PlusIcon /> Create
          </Link>
        </AdminHeader>
        <main className={bodyClass}>
          <div className={`${cardClass} overflow-hidden`}>
            <table className="w-full text-left">
              <thead className="border-b border-cms-line bg-cms-panel text-cms-text-soft">
                <tr>
                  <th className="px-4 py-2 font-medium">{def.fields[def.titleField]?.label ?? 'Title'}</th>
                  <th className="px-4 py-2 font-medium max-sm:hidden">Slug</th>
                  <th className="w-28 px-4 py-2 font-medium">Status</th>
                  {dateField && <th className="w-32 px-4 py-2 font-medium">{def.fields[dateField].label}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-cms-line">
                {items.length === 0 && (
                  <tr>
                    <td colSpan={cols} className="px-4 py-6 text-center text-cms-text-mute">
                      No entries yet.
                    </td>
                  </tr>
                )}
                {items.map(({ slug, entry, status }) => (
                  // The title link's overlay makes the whole row clickable.
                  <tr key={slug} className="relative hover:bg-cms-panel">
                    <td className="px-4 py-2.5">
                      <Link href={`${adminPath}/${key}/${slug}`} className="font-medium no-underline after:absolute after:inset-0">
                        {String(entry[def.titleField] || slug)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 [font-family:ui-monospace,monospace] text-xs text-cms-text-mute max-sm:hidden">{slug}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 text-cms-text-soft">
                        <StatusDot state={status === 'draft' ? 'draft' : pending.has(slug) ? 'changes' : 'published'} />
                        {status === 'draft' ? 'Draft' : pending.has(slug) ? 'Changes' : 'Published'}
                      </span>
                    </td>
                    {dateField && <td className="px-4 py-2.5 tabular-nums text-cms-text-soft">{String(entry[dateField] ?? '—')}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    <div className={`${cardClass} relative flex items-center gap-3 px-4 py-3 hover:border-cms-text-mute`}>
      <div className="min-w-0 flex-1">
        {/* The overlay makes the whole card clickable while keeping the + button separate. */}
        <Link href={href} className="font-medium no-underline after:absolute after:inset-0">
          {title}
        </Link>
        {detail && <div className="text-cms-text-mute">{detail}</div>}
      </div>
      {children}
    </div>
  );
}
