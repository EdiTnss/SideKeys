import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextChord, loadSettings, saveSettings, DEFAULT_SETTINGS, DRILL_SYMBOLS, ROOTS } from '../src/ui/drill.js';
import { parseChord } from '../src/theory/chords.js';

// A stand-in for localStorage: same getItem / setItem, no browser.
const fakeStorage = () => {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) };
};

test('every drill symbol parses with every root', () => {
  for (const root of ROOTS) {
    for (const quality of DRILL_SYMBOLS) assert.doesNotThrow(() => parseChord(root + quality), root + quality);
  }
});

test('nextChord draws only from the selected roots and qualities', () => {
  const settings = { ...DEFAULT_SETTINGS, roots: ['F', 'Bb'], qualities: ['7', 'm7'] };
  const seen = new Set();
  let seed = 0;
  const random = () => ((seed += 0.37) % 1);
  for (let i = 0; i < 40; i++) seen.add(nextChord(settings, null, random));
  assert.deepEqual([...seen].sort(), ['Bb7', 'Bbm7', 'F7', 'Fm7']);
});

test('nextChord never repeats the previous chord, unless it is the only one', () => {
  const settings = { ...DEFAULT_SETTINGS, roots: ['C', 'F'], qualities: ['maj7'] };
  for (let i = 0; i < 20; i++) assert.notEqual(nextChord(settings, 'Cmaj7'), 'Cmaj7');
  assert.equal(nextChord({ ...settings, roots: ['C'] }, 'Cmaj7'), 'Cmaj7');
  assert.equal(nextChord({ ...settings, roots: [] }, null), null);
});

test('settings survive a save/load round trip and fall back to defaults on garbage', () => {
  const storage = fakeStorage();
  const settings = { ...DEFAULT_SETTINGS, qualities: ['7alt'], roots: ['Db'], debounceMs: 450, nextNote: 36 };
  assert.equal(saveSettings(settings, storage), true);
  assert.deepEqual(loadSettings(storage), settings);

  storage.setItem('voicing-lab.settings', '{not json');
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);

  storage.setItem('voicing-lab.settings', JSON.stringify({ qualities: ['nope', 'm7'], roots: ['H'], debounceMs: 'x' }));
  const cleaned = loadSettings(storage);
  assert.deepEqual(cleaned.qualities, ['m7']);
  assert.deepEqual(cleaned.roots, DEFAULT_SETTINGS.roots);   // an empty list would block the drill
  assert.equal(cleaned.debounceMs, DEFAULT_SETTINGS.debounceMs);

  assert.deepEqual(loadSettings(undefined), DEFAULT_SETTINGS);     // no storage at all
  assert.equal(saveSettings(settings, undefined), false);
});
