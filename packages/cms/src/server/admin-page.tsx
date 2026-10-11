import 'server-only';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ExternalLinkIcon, FileTextIcon, PlusIcon, SettingsIcon } from 'lucide-react';
import { withDefaults, type Collection, type CmsConfig, type Singleton } from '../define.js';
import { buttonVariants } from '../admin/button.js';
import { AdminProvider } from '../admin/context.js';
import { DeleteButton } from '../admin/delete-button.js';
import { EntryForm } from '../admin/entry-form.js';
import { AdminHeader } from '../admin/header.js';
import { LoginForm } from '../admin/login-form.js';
import { AdminNav, type NavGroup } from '../admin/nav.js';
import { bodyClass, cardClass } from '../admin/styles.js';
import { isAdmin } from './auth.js';
import type { Context } from './context.js';

type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
type AnyEntry = Record<string, unknown>;

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
      return provider(
        <main className={`${rootClass} items-center justify-center bg-cms-panel px-4`}>
          <title>Sign in — Admin</title>
          <div className={`${cardClass} w-full max-w-xs p-6`}>
            <h1 className="mb-5 text-lg font-semibold [font-family:inherit]">Sign in to admin</h1>
            <LoginForm />
          </div>
        </main>,
      );
    }
    if (!(await isAdmin(ctx))) redirect(`${adminPath}/login`);

    const content = await screen(path, await searchParams);
    const brand = typeof options.brand === 'function' ? await options.brand() : (options.brand ?? 'Admin');
    return provider(
      <div className={`${rootClass} md:flex-row`}>
        <title>{`${brand} — Admin`}</title>
        <AdminNav brand={brand} groups={navGroups()} />
        <div className="flex min-w-0 flex-1 flex-col">{content}</div>
      </div>,
    );
  };

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
    return groups.filter((g) => g.items.length > 0);
  }

  async function screen([key, sub, ...rest]: string[], query: Record<string, string | string[] | undefined>): Promise<React.ReactNode> {
    if (!key) return dashboard();
    if (rest.length) notFound();

    const extra = options.pages?.find((p) => p.path === key);
    if (extra && !sub) return extra.render();

    const def = Object.hasOwn(config, key) ? (config[key] as Singleton | Collection) : undefined;
    if (!def) notFound();

    if (def.kind === 'singleton') {
      if (sub) notFound();
      const entry = (await store.getSingleton(key as never, { drafts: false })) ?? withDefaults(def.fields, {});
      return <EntryForm schemaKey={key} schema={def} initial={entry as AnyEntry} crumbs={[home, { label: def.label }]} />;
    }

    const listCrumb = { label: def.label, href: `${adminPath}/${key}` };
    if (!sub) return collectionList(key, def);
    if (sub === 'new') {
      return <EntryForm schemaKey={key} schema={def} initial={withDefaults(def.fields, {})} crumbs={[home, listCrumb, { label: 'New' }]} />;
    }

    const entry = (await store.getEntry(key as never, sub, { drafts: false })) as AnyEntry | null;
    if (!entry) notFound();
    const title = String(entry[def.titleField] || sub);
    return (
      // key: remount with fresh state after a create redirect
      <EntryForm
        key={sub}
        schemaKey={key}
        schema={def}
        slug={sub}
        initial={entry}
        notice={query.created ? 'Created' : undefined}
        crumbs={[home, listCrumb, { label: title }]}
        actions={
          <>
            <Link
              href={`${def.basePath}/${sub}`}
              target="_blank"
              aria-label="View on site"
              title="View on site"
              className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'no-underline' })}
            >
              <ExternalLinkIcon />
            </Link>
            <DeleteButton schemaKey={key} slug={sub} title={title} />
          </>
        }
      />
    );
  }

  async function dashboard() {
    const collections = defs.filter(([, d]) => d.kind === 'collection');
    const counts = await Promise.all(collections.map(async ([k]) => (await store.listSlugs(k as never)).length));
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
    const items = ((await store.listEntries(key as never, { drafts: false })) as { slug: string; entry: AnyEntry }[]).sort((a, b) =>
      dateField ? String(b.entry[dateField] ?? '').localeCompare(String(a.entry[dateField] ?? '')) : a.slug.localeCompare(b.slug),
    );
    const cols = dateField ? 3 : 2;
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
                {items.map(({ slug, entry }) => (
                  // The title link's overlay makes the whole row clickable.
                  <tr key={slug} className="relative hover:bg-cms-panel">
                    <td className="px-4 py-2.5">
                      <Link href={`${adminPath}/${key}/${slug}`} className="font-medium no-underline after:absolute after:inset-0">
                        {String(entry[def.titleField] || slug)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 [font-family:ui-monospace,monospace] text-xs text-cms-text-mute max-sm:hidden">{slug}</td>
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
