// styles.css already lives at the package root and ships as-is; this checks it points at dist.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
if (!css.includes('@source "./dist"')) throw new Error('styles.css must contain @source "./dist"');
