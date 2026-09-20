import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storageKey, STORAGE_PREFIX } from '../src/storage.js';

const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: key => { delete data[key]; },
  };
};

test('keys live under the app prefix', () => {
  assert.equal(STORAGE_PREFIX, 'sidekeys');
  assert.equal(storageKey('stats', fakeStorage()), 'sidekeys.stats');
  assert.equal(storageKey('pieces', fakeStorage()), 'sidekeys.pieces');
});

// The app was called Voicing Lab until 2026-09-20. A browser that practised under the old name
// must keep its settings, pieces and statistics: the rename is ours, not the user's problem.
test('what was saved under the old name moves across on first use', () => {
  const storage = fakeStorage({ 'voicing-lab.stats': '{"attempts":42}' });
  assert.equal(storageKey('stats', storage), 'sidekeys.stats');
  assert.equal(storage.data['sidekeys.stats'], '{"attempts":42}');
  assert.equal('voicing-lab.stats' in storage.data, false, 'the old key is not left behind as a second copy');
});

test('a value already saved under the new name is never overwritten by an older one', () => {
  const storage = fakeStorage({ 'sidekeys.pieces': '{"new":1}', 'voicing-lab.pieces': '{"old":1}' });
  storageKey('pieces', storage);
  assert.equal(storage.data['sidekeys.pieces'], '{"new":1}');
});

test('nothing saved anywhere: the key comes back and nothing is written', () => {
  const storage = fakeStorage();
  assert.equal(storageKey('settings', storage), 'sidekeys.settings');
  assert.deepEqual(storage.data, {});
});

test('storage that is missing or refuses still gives a usable key', () => {
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() {}, removeItem() {} };
  assert.equal(storageKey('stats', throwing), 'sidekeys.stats');
  assert.equal(storageKey('stats', null), 'sidekeys.stats');
  assert.equal(storageKey('stats', undefined), 'sidekeys.stats');
});
