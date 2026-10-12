// Writes dist/sw.js: the service worker from ../sw.js, with the list of files to precache and a
// cache name filled in.
//
// The list has to be generated because Vite puts a content hash in every asset filename, and the
// cache name is derived from the list so that a build which changed anything gets a fresh cache
// and the old one is deleted on activate. No dependency: the repo takes none, and this is a
// directory walk plus a hash.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
// The folder to work on: dist by default, or one named on the command line, which is how the
// test drives it without a real build.
const dist = process.argv[2] ? resolve(process.argv[2]) : join(appRoot, 'dist');

/** Every file in dist, as a path relative to it, with forward slashes. */
function walk(directory) {
  return readdirSync(directory).flatMap(entry => {
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [relative(dist, full).split('\\').join('/')];
  });
}

const files = walk(dist)
  // The worker must not cache itself: it is fetched by the browser's own update check, and a
  // cached copy would make a new version invisible.
  .filter(file => file !== 'sw.js')
  // Nor the piano: three megabytes of recordings would be downloaded twice on a first visit —
  // once by this install and once by the page, which fetches them eagerly the moment a level
  // opens. The worker caches them at runtime instead, on the way past, so they are there
  // offline after the first level anyone plays. The manifest stays precached, because without
  // it an offline page cannot even tell whether a piano exists.
  .filter(file => !/^piano\/.+\.ogg$/.test(file))
  .sort();

if (!files.includes('index.html')) throw new Error('dist has no index.html — did vite build run?');

// The hash covers the names, which already carry Vite's content hashes, plus the contents of the
// files it does not hash (the manifest, the icons, anything else dropped in public/).
const digest = createHash('sha256');
for (const file of files) {
  digest.update(file);
  if (!/-[A-Za-z0-9_-]{8,}\./.test(file)) digest.update(readFileSync(join(dist, file)));
}
const cacheName = `sidekeys-${digest.digest('hex').slice(0, 12)}`;

const precache = ['./', ...files.map(file => `./${file}`)];
const source = readFileSync(join(appRoot, 'sw.js'), 'utf8')
  .replace("'__CACHE_NAME__'", JSON.stringify(cacheName))
  .replace('__PRECACHE__', JSON.stringify(precache, null, 2));

if (source.includes('__CACHE_NAME__') || source.includes('__PRECACHE__')) {
  throw new Error('sw.js placeholders did not get filled in');
}

writeFileSync(join(dist, 'sw.js'), source);
console.log(`sw.js: ${precache.length} files precached as ${cacheName}`);
