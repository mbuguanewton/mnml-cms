// Copies content between databases: dev → prod, prod → dev, or to and from a file. Dry run unless --apply.
//
//   pnpm db:export                                  write the DATABASE_URL database to mnml-content.json
//   pnpm db:export --env PROD_DATABASE_URL --out prod.json
//   pnpm db:import mnml-content.json --mode add     compare a file with DATABASE_URL (add, overwrite or replace)
//   pnpm db:import prod.json --mode overwrite --env PROD_DATABASE_URL --apply --yes
//   pnpm db:sync --from DATABASE_URL --to PROD_DATABASE_URL --mode add --apply --yes
//   pnpm db:sync --from-env-file .env.local --to-env-file .env.production --mode add --apply --yes
//
// --env / --from / --to name an environment variable that holds the database URL (never the URL itself, so
// it stays out of your shell history). Put them in .env.local. With --env-file / --from-env-file /
// --to-env-file the variable is read from that file instead (still named DATABASE_URL unless you also pass
// --env / --from / --to), so dev and prod can each keep their own `DATABASE_URL`. Modes: add (only what the target lacks),
// overwrite (also replace what differs), replace (make the target match, deleting the rest).
// Uploaded images are not copied; any the target doesn't have are listed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs, parseEnv } from 'node:util';
import {
  applyImport,
  describePlan,
  drizzleStorage,
  exportContent,
  localMedia,
  missingMedia,
  neonDatabase,
  parseContentFile,
  planImport,
  vercelBlobMedia,
  type ContentFile,
  type ImportMode,
} from '@n3wtou/mnml-cms/sync';
import config from '../mnml.config';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: 'string' },
    'env-file': { type: 'string' },
    from: { type: 'string' },
    'from-env-file': { type: 'string' },
    to: { type: 'string' },
    'to-env-file': { type: 'string' },
    out: { type: 'string', default: 'mnml-content.json' },
    mode: { type: 'string' },
    apply: { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
  },
});
const [command, fileArg] = positionals;

const fail = (message: string): never => {
  console.error(`\n${message}`);
  process.exit(1);
};

/** The database in variable `name` of `file` (read without touching process.env), or of the environment. */
function connect(name = 'DATABASE_URL', file?: string) {
  let vars: Record<string, string | undefined> = process.env;
  if (file) {
    if (!existsSync(file)) return fail(`${file} does not exist.`);
    vars = parseEnv(readFileSync(file, 'utf8'));
  }
  const url = vars[name];
  if (!url) return fail(file ? `${name} is not set in ${file}.` : `${name} is not set. Add it to .env.local.`);
  const { hostname, pathname } = new URL(url);
  return {
    url,
    vars,
    storage: drizzleStorage(neonDatabase(url)),
    label: `${name}${file ? ` in ${file}` : ''} (${hostname}${pathname})`,
    local: ['localhost', '127.0.0.1', '::1'].includes(hostname),
  };
}

const mode = (): ImportMode => {
  if (values.mode !== 'add' && values.mode !== 'overwrite' && values.mode !== 'replace') return fail('Pass --mode add, overwrite or replace.');
  return values.mode;
};

const save = (path: string, file: ContentFile) => writeFileSync(path, JSON.stringify(file, null, 2) + '\n');

async function importInto(file: ContentFile, target: ReturnType<typeof connect>, mode: ImportMode) {
  console.log(`Target: ${target.label}`);
  const plan = await planImport(config, target.storage, file, mode);
  console.log(describePlan(plan, mode));

  // Checked against the target's own media storage when its env file has the Blob token.
  const token = target.vars.BLOB_READ_WRITE_TOKEN;
  const media = token ? vercelBlobMedia({ token }) : localMedia();
  const missing = await missingMedia(file, async (key) => (await media.get(key)) !== null);
  if (missing.length > 0) {
    console.log(
      `\n${missing.length} uploaded file${missing.length === 1 ? '' : 's'} the content uses ${missing.length === 1 ? 'is' : 'are'} missing from the target's media storage (images will be broken until copied):`,
    );
    for (const key of missing.slice(0, 10)) console.log(`  ${key}`);
  }

  if (plan.invalid.length > 0) return fail('Fix the invalid entries first. Nothing was written.');
  if (!values.apply) return console.log('\nDry run: nothing was written. Add --apply to do it.');
  if (!target.local && !values.yes) return fail(`${target.label} is not a local database. Add --yes to confirm.`);

  // Keep what is about to be changed, so an import can be undone with `db:import <backup> --mode replace`.
  mkdirSync('.mnml-backups', { recursive: true });
  const backup = `.mnml-backups/${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  save(backup, await exportContent(config, target.storage));
  console.log(`\nBacked up the target to ${backup}`);

  const done = await applyImport(target.storage, plan, mode);
  console.log(`Done: ${done.added} added, ${done.changed} changed, ${done.removed} removed.`);
}

if (command === 'export') {
  const source = connect(values.env, values['env-file']);
  const file = await exportContent(config, source.storage);
  save(values.out!, file);
  console.log(`Exported ${file.entries.length} entries from ${source.label} to ${values.out}`);
} else if (command === 'import') {
  if (!fileArg) fail('Pass the file to import.');
  const chosen = mode();
  let file: ContentFile;
  try {
    file = parseContentFile(JSON.parse(readFileSync(fileArg, 'utf8')));
  } catch (e) {
    file = fail(`Can't import ${fileArg}: ${(e as Error).message}`);
  }
  await importInto(file, connect(values.env, values['env-file']), chosen);
} else if (command === 'sync') {
  if (!(values.from ?? values['from-env-file']) || !(values.to ?? values['to-env-file'])) {
    fail('Pass where to copy from and to: --from / --from-env-file and --to / --to-env-file.');
  }
  const chosen = mode();
  const source = connect(values.from, values['from-env-file']);
  const target = connect(values.to, values['to-env-file']);
  if (source.url === target.url) fail('The source and the target are the same database.');
  console.log(`Source: ${source.label}`);
  await importInto(await exportContent(config, source.storage), target, chosen);
} else {
  fail('Usage: export | import <file> | sync, see the top of scripts/content.ts.');
}
