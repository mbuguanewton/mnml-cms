// Removes files from dist whose source is gone. The build writes over dist in place instead of deleting it first,
// so a running dev server that imports the package never sees it missing.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const src = join(root, 'src');

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

let removed = 0;
for (const file of existsSync(dist) ? walk(dist) : []) {
  const base = relative(dist, file).replace(/\.d\.ts$|\.js$/, '');
  if (base === relative(dist, file)) continue; // not a tsc output
  if (!existsSync(join(src, `${base}.ts`)) && !existsSync(join(src, `${base}.tsx`))) {
    rmSync(file);
    removed++;
  }
}
// Empty folders left behind.
const prune = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) prune(join(dir, e.name));
  if (dir !== dist && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
};
if (existsSync(dist)) prune(dist);
if (removed) console.log(`dist: removed ${removed} stale files`);
