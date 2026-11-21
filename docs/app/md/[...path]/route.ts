// Serves the docs as Markdown for agents: /fields/blocks.md is rewritten here (next.config.ts) and answered with
// docs/md/fields/blocks.md, generated from docs/content by packages/cms/scripts/build-agent-docs.mjs.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'md');

export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  const files = await readdir(DIR, { recursive: true });
  return files.filter((f) => f.endsWith('.md')).map((f) => ({ path: f.slice(0, -3).split('/') }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const body = await readFile(join(DIR, `${path.join('/')}.md`), 'utf8');
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
