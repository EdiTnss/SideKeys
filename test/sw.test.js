// The service worker's precache list is generated, and it is the one thing that decides whether
// the app works offline at all. A wrong list fails silently — the app simply stops working with
// the network off, which nobody notices until they are on a train. So the generator gets a test.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../app/scripts/build-sw.mjs', import.meta.url));

/** A stand-in for a Vite build: a couple of hashed assets and the files public/ drops in. */
function fakeDist(extra = {}) {
  const dist = mkdtempSync(join(tmpdir(), 'sidekeys-sw-'));
  mkdirSync(join(dist, 'assets'));
  mkdirSync(join(dist, 'icons'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>SideKeys</title>');
  writeFileSync(join(dist, 'assets', 'index-B4Znw1EC.js'), 'console.log(1)');
  writeFileSync(join(dist, 'assets', 'index-BUrhXD-P.css'), 'body{}');
  writeFileSync(join(dist, 'manifest.webmanifest'), '{"name":"SideKeys"}');
  writeFileSync(join(dist, 'icons', 'icon-192.png'), 'not really a png');
  mkdirSync(join(dist, 'piano'));
  writeFileSync(join(dist, 'piano', 'manifest.json'), '{"format":1}');
  writeFileSync(join(dist, 'piano', 'c4.ogg'), 'pretend this is three hundred kilobytes');
  for (const [name, contents] of Object.entries(extra)) writeFileSync(join(dist, name), contents);
  return dist;
}

const build = dist => {
  execFileSync(process.execPath, [SCRIPT, dist], { encoding: 'utf8' });
  return readFileSync(join(dist, 'sw.js'), 'utf8');
};

test('the worker is written with every built file in its precache list', () => {
  const dist = fakeDist();
  try {
    const sw = build(dist);
    const list = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
    assert.deepEqual(list.sort(), [
      './',
      './assets/index-B4Znw1EC.js',
      './assets/index-BUrhXD-P.css',
      './icons/icon-192.png',
      './index.html',
      './manifest.webmanifest',
      './piano/manifest.json',
    ].sort());
    // The root is there as well as index.html: a visitor who opens the bare URL offline asks for
    // the directory, which is a different cache key from the file.
    assert.ok(list.includes('./'));
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('neither placeholder survives, so the worker is never shipped half-written', () => {
  const dist = fakeDist();
  try {
    const sw = build(dist);
    assert.ok(!sw.includes('__PRECACHE__'), 'precache placeholder left in');
    assert.ok(!sw.includes('__CACHE_NAME__'), 'cache name placeholder left in');
    assert.match(sw, /const CACHE = "sidekeys-[0-9a-f]{12}"/);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('the piano stays out of the precache, but its manifest does not', () => {
  // Three megabytes of recordings would be fetched twice on a first visit: once by the
  // install, once by the page, which loads them eagerly as soon as a level opens.
  const dist = fakeDist();
  try {
    const list = JSON.parse(build(dist).match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
    assert.ok(!list.includes('./piano/c4.ogg'), 'a recording was precached');
    assert.ok(list.includes('./piano/manifest.json'), 'without it, an offline page cannot tell whether a piano exists');
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('the worker never precaches itself, however it got into the folder', () => {
  const dist = fakeDist({ 'sw.js': 'an old worker from a previous build' });
  try {
    const sw = build(dist);
    const list = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
    assert.ok(!list.includes('./sw.js'), 'a cached worker would make the next version invisible');
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('the cache name follows the build, so a new version never serves the old files', () => {
  const first = fakeDist();
  const second = fakeDist();
  const third = fakeDist();
  try {
    const nameOf = sw => sw.match(/const CACHE = "(.+?)"/)[1];
    assert.equal(nameOf(build(first)), nameOf(build(second)), 'the same build gives the same name');

    // A file Vite does not hash — the manifest, an icon — must still move the name, or an update
    // to it would never reach anyone.
    writeFileSync(join(third, 'manifest.webmanifest'), '{"name":"SideKeys","short_name":"SK"}');
    assert.notEqual(nameOf(build(third)), nameOf(build(first)), 'an unhashed file changed and the name did not');
  } finally {
    for (const dist of [first, second, third]) rmSync(dist, { recursive: true, force: true });
  }
});

test('a folder with no index.html is a failed build, and says so', () => {
  const dist = mkdtempSync(join(tmpdir(), 'sidekeys-sw-'));
  try {
    assert.throws(() => build(dist), /index\.html/);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});
