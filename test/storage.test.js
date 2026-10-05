import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storageKey, STORAGE_PREFIX } from '../src/storage.js';

// The four tests that covered the move from the old `voicing-lab.*` prefix went with it on
// 2026-10-05 (see the comment in src/storage.js): there is no browser left holding those keys.
test('keys live under the app prefix', () => {
  assert.equal(STORAGE_PREFIX, 'sidekeys');
  assert.equal(storageKey('stats'), 'sidekeys.stats');
  assert.equal(storageKey('pieces'), 'sidekeys.pieces');
  assert.equal(storageKey('settings'), 'sidekeys.settings');
});
