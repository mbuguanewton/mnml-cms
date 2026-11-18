// Copies images from other sites into this site's media storage, once each: what a migration script does for
// every image it moves (e.g. from cdn.sanity.io). Prints the URL to store in an `image` field.
//   pnpm media:import https://example.com/photo.jpg [more urls…]
import { existsSync } from 'node:fs';
import { localMedia, mediaImporter, vercelBlobMedia } from '@n3wtou/mnml-cms/sync';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

// The same storage the site uses (src/mnml.tsx): Vercel Blob with a token, local disk otherwise.
const media = process.env.BLOB_READ_WRITE_TOKEN ? vercelBlobMedia() : localMedia();
const urls = process.argv.slice(2);
if (urls.length === 0) {
  console.error('Usage: pnpm media:import <https url> [more urls…]');
  process.exit(1);
}

const importRemote = mediaImporter(media);
for (const source of urls) {
  try {
    const { url, reused } = await importRemote(source);
    console.log(`${reused ? 'reused  ' : 'imported'} ${source}\n         → ${url}`);
  } catch (err) {
    console.error(`failed   ${source}: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}
