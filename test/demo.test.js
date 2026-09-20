import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// demo/manifest.json is always published: it is what lets the app ask what else is there
// without a 404 in every visitor's console. The contract is in demo/README.md.
const manifest = JSON.parse(readFileSync(new URL('../demo/manifest.json', import.meta.url), 'utf8'));

test('the demo manifest names exactly the two files the app asks about', () => {
  assert.deepEqual(Object.keys(manifest).sort(), ['piece', 'reharm']);
});

test('each entry is a file name or null, and a named file is really published', () => {
  for (const [name, value] of Object.entries(manifest)) {
    assert.ok(value === null || typeof value === 'string', `${name}: null or a file name, got ${typeof value}`);
    if (typeof value === 'string') {
      assert.ok(!value.includes('/'), `${name}: a file name inside demo/, not a path`);
      assert.ok(existsSync(new URL(`../demo/${value}`, import.meta.url)), `${name}: the manifest names ${value}, which is not committed`);
    }
  }
});
