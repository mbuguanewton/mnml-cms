// Builds everything agents read from the docs (docs/content), so the docs stay the only source:
//   packages/cms/skills/mnml-*/      skills shipped in the package (one per docs section, subpages as references/)
//   packages/cms/src/server/docs-index.ts   the index behind the MCP `docs` tool
//   docs/public/llms.txt, llms-full.txt     for agents reading the docs site
// `--check` writes nothing and fails if any of them is out of date (CI runs it before the build).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(PKG, '../..');
const CONTENT = join(ROOT, 'docs/content');
const SITE = 'https://mnml-cms.vercel.app';
const GENERATED = 'Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file.';

// Skills: one per docs section. `when` is the skill's description: it loads in every conversation, so keep it short.
const SKILLS = [
  {
    name: 'mnml-getting-started',
    main: 'getting-started',
    refs: ['index', 'entry-points', 'common-mistakes'],
    when: 'mnml-cms setup in Next.js: config, createCms, admin/API routes, proxy, table. Also basics that break: server-only imports, image values, drafts 404ing.',
  },
  {
    name: 'mnml-fields',
    main: 'fields/index',
    refs: 'fields/*',
    when: 'Editing mnml.config.ts: singletons, collections, fields (select, blocks, references, showIf, defaults, derived, SEO, limits, dates, images).',
  },
  {
    name: 'mnml-reading-content',
    main: 'reading-content',
    when: 'Rendering mnml content on pages: getEntry, listEntries, getSingleton, getEntries, listSlugs, RichText, seoMetadata, static params, preview.',
  },
  {
    name: 'mnml-drafts',
    main: 'drafts-and-publishing',
    when: 'mnml drafts: autosave, Publish, Unpublish, Discard, singleton drafts, why a draft 404s.',
  },
  {
    name: 'mnml-moving-content',
    main: 'moving-content',
    when: 'Moving mnml content: export/import between databases, migrating from another CMS, rehosting images, Markdown to rich text in scripts.',
  },
  {
    name: 'mnml-editor',
    main: 'editor/index',
    refs: 'editor/*',
    when: 'Extending the mnml rich text editor: Tiptap extensions, toolbar tools, tables, form nodes, entry links, custom node rendering.',
  },
  {
    name: 'mnml-agents',
    main: 'agents',
    when: 'mnml MCP server for AI agents: tokens, scopes, tools, Markdown rich text, delete approval, connecting Claude Code, Cursor, Zed.',
  },
  {
    name: 'mnml-setup',
    main: 'options',
    refs: ['authentication', 'image-storage', 'other-orms'],
    when: 'mnml createCms options, auth (password or AuthAdapter), image storage (Vercel Blob, local, custom), EntryStorage without Drizzle.',
  },
  {
    name: 'mnml-upgrading',
    main: 'upgrading',
    when: 'Upgrading @n3wtou/mnml-cms, checking which version a project has, fixing breakage after an upgrade.',
  },
];

/** `{ key: 'Title' }` from a Nextra `_meta.ts`, in order. */
function readMeta(dir) {
  const src = readFileSync(join(CONTENT, dir, '_meta.ts'), 'utf8');
  return [...src.matchAll(/^\s*'?([\w-]+)'?:\s*'([^']*)'/gm)].map(([, key, title]) => ({ key, title }));
}

/** Every page in nav order: `{ path, title, url, description, body, headings }`. */
function readPages() {
  const pages = [];
  const add = (path, navTitle) => {
    const src = readFileSync(join(CONTENT, `${path}.mdx`), 'utf8');
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(src);
    const description = fm && /^description:\s*(.*)$/m.exec(fm[1]);
    if (!description) throw new Error(`docs/content/${path}.mdx has no description in its frontmatter.`);
    const body = (fm ? src.slice(fm[0].length) : src).trim();
    const title = /^# (.+)$/m.exec(body)?.[1] ?? navTitle;
    const headings = [];
    let fence = false;
    for (const line of body.split('\n')) {
      if (line.startsWith('```')) fence = !fence;
      else if (!fence && /^#{2,3} /.test(line)) headings.push(line.replace(/^#+ /, ''));
    }
    const slug = path === 'index' ? '' : path.replace(/\/index$/, '');
    pages.push({ path, title, url: slug ? `${SITE}/${slug}` : SITE, description: JSON.parse(description[1]), body, headings });
  };
  for (const { key, title } of readMeta('.')) {
    if (existsSync(join(CONTENT, key, '_meta.ts'))) for (const sub of readMeta(key)) add(`${key}/${sub.key}`, sub.title);
    else add(key, title);
  }
  return pages;
}

/** Links inside the docs (`](/fields/blocks)`) as full URLs, so they work outside the site. */
const absolute = (body) => body.replace(/\]\((\/[^)\s]*)\)/g, (_, href) => `](${SITE}${href === '/' ? '' : href})`);

function build() {
  const pages = readPages();
  const byPath = new Map(pages.map((p) => [p.path, p]));
  const files = new Map(); // path relative to ROOT → content
  const skillOf = new Map();

  for (const s of SKILLS) {
    const main = byPath.get(s.main);
    if (!main) throw new Error(`Skill ${s.name}: no page ${s.main}.`);
    const refs = (
      s.refs === undefined
        ? []
        : typeof s.refs === 'string'
          ? pages.filter((p) => p.path.startsWith(s.refs.slice(0, -1)) && p.path !== s.main).map((p) => p.path)
          : s.refs
    ).map((path) => {
      const page = byPath.get(path);
      if (!page) throw new Error(`Skill ${s.name}: no page ${path}.`);
      return page;
    });
    for (const p of [main, ...refs]) skillOf.set(p.path, s.name);
    const dir = `packages/cms/skills/${s.name}`;
    const refName = (p) => `${p.path.split('/').pop()}.md`;
    const more = refs.length ? `\n\n## More\n\n${refs.map((p) => `- [${p.title}](references/${refName(p)}): ${p.description}`).join('\n')}\n` : '\n';
    files.set(
      `${dir}/SKILL.md`,
      `---\nname: ${s.name}\ndescription: ${JSON.stringify(s.when)}\n---\n\n<!-- ${GENERATED} -->\n\n` +
        `> Matches the installed version. Online: ${main.url}\n\n${absolute(main.body)}${more}`,
    );
    for (const p of refs) files.set(`${dir}/references/${refName(p)}`, `<!-- ${GENERATED} -->\n\n${absolute(p.body)}\n`);
  }
  const orphans = pages.filter((p) => !skillOf.has(p.path)).map((p) => p.path);
  if (orphans.length) throw new Error(`Pages in no skill: ${orphans.join(', ')}. Add them to SKILLS in build-agent-docs.mjs.`);

  const index = pages.map((p) => ({ title: p.title, url: p.url, description: p.description, headings: p.headings, skill: skillOf.get(p.path) }));
  files.set(
    'packages/cms/src/server/docs-index.ts',
    `// ${GENERATED}\n\nexport type DocsPage = { title: string; url: string; description: string; headings: string[]; skill: string };\n\n` +
      `export const DOCS_SITE = ${JSON.stringify(SITE)};\n\nexport const docsIndex: DocsPage[] = ${JSON.stringify(index, null, 2)};\n`,
  );

  const intro = byPath.get('index').description;
  files.set(
    'docs/public/llms.txt',
    `# mnml-cms\n\n> ${intro}\n\nEvery page as one file: ${SITE}/llms-full.txt\n\n## Docs\n\n${pages.map((p) => `- [${p.title}](${p.url}): ${p.description}`).join('\n')}\n`,
  );
  files.set('docs/public/llms-full.txt', `# mnml-cms\n\n> ${intro}\n\n${pages.map((p) => `<!-- ${p.url} -->\n\n${absolute(p.body)}`).join('\n\n---\n\n')}\n`);
  return files;
}

const check = process.argv.includes('--check');
const files = build();
const skillsDir = join(PKG, 'skills');
const existingSkills = existsSync(skillsDir)
  ? readdirSync(skillsDir, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => relative(ROOT, join(d.parentPath, d.name)))
  : [];

const stale = [...files].filter(([path, content]) => !existsSync(join(ROOT, path)) || readFileSync(join(ROOT, path), 'utf8') !== content).map(([p]) => p);
const extra = existingSkills.filter((p) => !files.has(p));

if (check) {
  if (stale.length || extra.length) {
    console.error(`Agent docs are out of date (${[...stale, ...extra].join(', ')}). Run: node packages/cms/scripts/build-agent-docs.mjs`);
    process.exit(1);
  }
  console.log(`Agent docs are up to date (${files.size} files).`);
} else {
  for (const p of extra) rmSync(join(ROOT, p));
  for (const [path, content] of files) {
    mkdirSync(dirname(join(ROOT, path)), { recursive: true });
    writeFileSync(join(ROOT, path), content);
  }
  console.log(`Agent docs: ${files.size} files, ${stale.length} changed, ${extra.length} removed.`);
}
