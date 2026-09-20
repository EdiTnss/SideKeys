import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { parseChord } from '../src/theory/chords.js';
import { analyzeVoicing } from '../src/theory/analyzer.js';
import { emptyStats, recordAttempt, weakSpots, summaryLine, loadStats, saveStats } from '../src/ui/stats.js';

const attempt = (stats, symbol, notes) => {
  const chord = parseChord(symbol);
  return recordAttempt(stats, { key: symbol.slice(chord.root.length), chord, analysis: analyzeVoicing(notes.split(' ').map(nameToMidi), chord) });
};
const fakeStorage = () => {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
};

test('attempts and clean attempts are counted per quality and overall', () => {
  let stats = emptyStats();
  stats = attempt(stats, 'Cmaj7', 'E3 G3 B3 D4');        // clean
  stats = attempt(stats, 'Cmaj7', 'C4 E4 G4');           // missing the 7
  stats = attempt(stats, 'G7alt', 'B3 F4 A4');           // missing b13, A is a wrong note
  assert.equal(stats.attempts, 3);
  assert.equal(stats.clean, 1);
  assert.equal(stats.byKey.maj7.attempts, 2);
  assert.equal(stats.byKey.maj7.clean, 1);
  assert.deepEqual(stats.byKey.maj7.missing, { '7': 1 });
  assert.deepEqual(stats.byKey['7alt'].missing, { b13: 1 });
  assert.equal(stats.byKey['7alt'].wrong, 1);
  assert.equal(emptyStats().attempts, 0);                 // the input is never modified
});

test('weak spots: the most frequent problems first, limited', () => {
  let stats = emptyStats();
  for (let i = 0; i < 3; i++) stats = attempt(stats, 'G7alt', 'B3 F4 A4');       // b13 missing + wrong ×3
  stats = attempt(stats, 'Dm7', 'D3 F3 A3 B3');                                  // 13 caution only: clean
  stats = attempt(stats, 'Cmaj7', 'C4 E4 G4 B4 F5');                             // avoid note
  stats = attempt(stats, 'Cmaj7', 'C4 E4 G4');                                   // missing 7
  const spots = weakSpots(stats, { limit: 3 });
  assert.equal(spots.length, 3);
  assert.deepEqual(spots[0], { key: '7alt', problem: 'b13 missing', count: 3 });
  assert.deepEqual(spots[1], { key: '7alt', problem: 'wrong notes', count: 3 });
  assert.equal(weakSpots(emptyStats()).length, 0);
  assert.ok(weakSpots(stats, { limit: 10 }).some(s => s.key === 'maj7' && s.problem === 'avoid notes' && s.count === 1));
});

test('summaryLine reads naturally', () => {
  assert.equal(summaryLine(emptyStats()), 'no chords yet');
  let stats = emptyStats();
  stats = attempt(stats, 'Cmaj7', 'E3 G3 B3 D4');
  stats = attempt(stats, 'Cmaj7', 'E3 G3 B3 D4');
  stats = attempt(stats, 'Cmaj7', 'C4 E4 G4');
  assert.equal(summaryLine(stats), '3 chords, 2 clean (67%)');
  assert.equal(summaryLine(attempt(emptyStats(), 'Cmaj7', 'E3 G3 B3 D4')), '1 chord, 1 clean (100%)');
});

test('stats survive a save/load round trip and fall back to empty on garbage', () => {
  const storage = fakeStorage();
  const stats = attempt(attempt(emptyStats(), 'G7alt', 'B3 F4 A4'), 'Cmaj7', 'E3 G3 B3 D4');
  assert.equal(saveStats(stats, storage), true);
  assert.deepEqual(loadStats(storage), stats);
  storage.setItem('sidekeys.stats', '{nope');
  assert.deepEqual(loadStats(storage), emptyStats());
  assert.deepEqual(loadStats(undefined), emptyStats());
  assert.equal(saveStats(stats, undefined), false);
});

test('statistics saved under the old app name are still there after the rename', () => {
  const storage = fakeStorage();
  storage.setItem('voicing-lab.stats', JSON.stringify({ attempts: 12, clean: 7, byKey: {} }));
  const stats = loadStats(storage);
  assert.equal(stats.attempts, 12);
  assert.equal(stats.clean, 7);
  assert.equal(storage.getItem('voicing-lab.stats'), null);
});
