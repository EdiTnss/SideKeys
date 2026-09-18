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

test('diminished chords use their symbols in the drill (ø7, bare °); old saved names are migrated', () => {
  assert.ok(DRILL_SYMBOLS.includes('ø7') && DRILL_SYMBOLS.includes('°'));
  for (const old of ['m7b5', 'dim7', 'ø', '°7']) assert.ok(!DRILL_SYMBOLS.includes(old), old);
  const storage = fakeStorage();
  storage.setItem('voicing-lab.settings', JSON.stringify({ qualities: ['m7b5', 'dim7', 'ø', '°7', 'm7'] }));
  assert.deepEqual(loadSettings(storage).qualities, ['ø7', '°', 'm7']);
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
  const settings = { ...DEFAULT_SETTINGS, qualities: ['7alt'], roots: ['Db'], debounceMs: 450, nextNote: 36, outputId: 'out-1', channel: 3, proxyUrl: 'https://voicing-lab-proxy.example.workers.dev/' };
  assert.equal(saveSettings(settings, storage), true);
  assert.deepEqual(loadSettings(storage), settings);

  storage.setItem('voicing-lab.settings', '{not json');
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);

  storage.setItem('voicing-lab.settings', JSON.stringify({ qualities: ['nope', 'm7'], roots: ['H'], debounceMs: 'x', channel: 99, outputId: 7, proxyUrl: 'javascript:alert(1)' }));
  const cleaned = loadSettings(storage);
  assert.deepEqual(cleaned.qualities, ['m7']);
  assert.deepEqual(cleaned.roots, DEFAULT_SETTINGS.roots);   // an empty list would block the drill
  assert.equal(cleaned.debounceMs, DEFAULT_SETTINGS.debounceMs);
  assert.equal(cleaned.channel, 1);
  assert.equal(cleaned.outputId, null);
  assert.equal(cleaned.proxyUrl, '');                          // only http(s) URLs are kept
  assert.equal(DEFAULT_SETTINGS.proxyUrl, '');
  storage.setItem('voicing-lab.settings', JSON.stringify({ proxyUrl: '  http://localhost:8787/  ' }));
  assert.equal(loadSettings(storage).proxyUrl, 'http://localhost:8787/');

  assert.deepEqual(loadSettings(undefined), DEFAULT_SETTINGS);     // no storage at all
  assert.equal(saveSettings(settings, undefined), false);
});

test('arrangement channels and parts: defaults, a round trip, and bad values falling back', () => {
  assert.deepEqual(DEFAULT_SETTINGS.channels, { melody: 1, lh: 2, bass: 3 });
  assert.deepEqual(DEFAULT_SETTINGS.parts, { melody: true, lh: true, bass: true });
  const storage = fakeStorage();
  const custom = { ...DEFAULT_SETTINGS, channels: { melody: 4, lh: 5, bass: 6 }, parts: { melody: true, lh: false, bass: true } };
  saveSettings(custom, storage);
  assert.deepEqual(loadSettings(storage).channels, custom.channels);
  assert.deepEqual(loadSettings(storage).parts, custom.parts);

  storage.setItem('voicing-lab.settings', JSON.stringify({ channels: { melody: 0, lh: 17, bass: 'x' }, parts: { lh: 'no' } }));
  const cleaned = loadSettings(storage);
  assert.deepEqual(cleaned.channels, { melody: 1, lh: 2, bass: 3 });
  assert.deepEqual(cleaned.parts, { melody: true, lh: true, bass: true });

  const fresh = loadSettings(undefined);
  fresh.channels.lh = 9;                                            // a loaded copy never touches the defaults
  assert.equal(DEFAULT_SETTINGS.channels.lh, 2);
});
