// Builds what agents read from the docs (docs/content), so the docs stay the only source:
//   docs/md/<page>.md                       every page as Markdown (title, description, url in its frontmatter), served at <url>.md
//   docs/public/llms.txt, llms-full.txt     the index and every page in one file
//   packages/cms/src/server/mcp/docs-index.ts   the index behind the MCP `docs` tool, which links to the .md pages
// `--check` writes nothing and fails if any of them is out of date (CI runs it before the build).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(PKG, '../..');
const CONTENT = join(ROOT, 'docs/content');
const MD = join(ROOT, 'docs/md');
const SITE = 'https://mnml-cms.vercel.app';
const GENERATED = 'Generated from docs/content by packages/cms/scripts/build-agent-docs.mjs. Edit the docs, not this file.';

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

/** A page's Markdown file, relative to the site: `fields/blocks.md`, `fields.md` (a section's index), `index.md`. */
const mdPath = (path) => `${path.replace(/\/index$/, '')}.md`;

/** Links inside the docs (`](/fields/blocks)`) as full links to the Markdown pages, so agents can follow them. */
const toMarkdownLinks = (body) =>
  body.replace(/\]\((\/[^)\s#]*)(#[^)\s]*)?\)/g, (_, href, hash = '') => `](${SITE}/${href === '/' ? 'index' : href.slice(1)}.md${hash})`);

function build() {
  const pages = readPages().map((p) => ({ ...p, markdown: `${SITE}/${mdPath(p.path)}` }));
  const files = new Map(); // path relative to ROOT → content

  for (const p of pages) {
    files.set(
      `docs/md/${mdPath(p.path)}`,
      `---\ntitle: ${JSON.stringify(p.title)}\ndescription: ${JSON.stringify(p.description)}\nurl: ${p.url}\n---\n\n${toMarkdownLinks(p.body)}\n`,
    );
  }

  const index = pages.map((p) => ({ title: p.title, url: p.url, markdown: p.markdown, description: p.description, headings: p.headings }));
  files.set(
    'packages/cms/src/server/mcp/docs-index.ts',
    `// ${GENERATED}\n\nexport type DocsPage = { title: string; url: string; markdown: string; description: string; headings: string[] };\n\n` +
      `export const DOCS_SITE = ${JSON.stringify(SITE)};\n\nexport const docsIndex: DocsPage[] = ${JSON.stringify(index, null, 2)};\n`,
  );

  const intro = pages.find((p) => p.path === 'index').description;
  files.set(
    'docs/public/llms.txt',
    `# mnml-cms\n\n> ${intro}\n\nEach page is Markdown at its URL plus \`.md\`. Every page in one file: ${SITE}/llms-full.txt\n\n## Docs\n\n${pages.map((p) => `- [${p.title}](${p.markdown}): ${p.description}`).join('\n')}\n`,
  );
  files.set(
    'docs/public/llms-full.txt',
    `# mnml-cms\n\n> ${intro}\n\n${pages.map((p) => `<!-- ${p.markdown} -->\n\n${toMarkdownLinks(p.body)}`).join('\n\n---\n\n')}\n`,
  );
  return files;
}

const check = process.argv.includes('--check');
const files = build();
// Generated Markdown pages; one whose docs page is gone is removed.
const existingPages = existsSync(MD)
  ? readdirSync(MD, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.md'))
      .map((d) => relative(ROOT, join(d.parentPath, d.name)))
  : [];

const stale = [...files].filter(([path, content]) => !existsSync(join(ROOT, path)) || readFileSync(join(ROOT, path), 'utf8') !== content).map(([p]) => p);
const extra = existingPages.filter((p) => !files.has(p));

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
