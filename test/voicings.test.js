import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { parseChord } from '../src/theory/chords.js';
import { analyzeVoicing } from '../src/theory/analyzer.js';
import { suggestVoicings, DEFAULT_REGISTER } from '../src/theory/voicings.js';

const v = names => names.split(' ').map(nameToMidi);
const suggest = (symbol, options) => suggestVoicings(parseChord(symbol), options);

test('every suggestion is clean and inside the register', () => {
  for (const symbol of ['Cmaj7', 'G7', 'Dm7', 'G7alt', 'C6/9', 'Bø7', 'C°', 'F7sus4']) {
    const candidates = suggest(symbol);
    assert.ok(candidates.length >= 2, symbol);
    for (const { notes, type } of candidates) {
      const analysis = analyzeVoicing(notes, parseChord(symbol));
      assert.equal(analysis.messages.filter(m => m.level === 'warning').length, 0, `${symbol} ${type} ${notes}`);
      assert.ok(notes[0] >= DEFAULT_REGISTER[0] && notes[notes.length - 1] <= DEFAULT_REGISTER[1], `${symbol} ${notes}`);
      assert.equal(analysis.voicing.type, type);
    }
  }
});

test('Cmaj7: rootless A first, then B, shells and a quartal stack among the candidates', () => {
  const candidates = suggest('Cmaj7');
  assert.deepEqual(candidates[0], { notes: v('E3 G3 B3 D4'), type: 'rootless-A', comparison: null });
  assert.equal(candidates[1].type, 'rootless-B');
  const types = new Set(candidates.map(c => c.type));
  for (const type of ['shell', 'drop-2', 'quartal']) assert.ok(types.has(type), type);
  assert.ok(candidates.some(c => c.type === 'shell' && c.notes.join() === v('E3 B3').join()));
  const keys = candidates.map(c => c.notes.join());
  assert.equal(new Set(keys).size, keys.length);                 // no duplicates
});

test('after Dm7 in the A form, the closest G7 is the B form: F A B E', () => {
  const [best] = suggest('G7', { previous: v('F3 A3 C4 E4') });
  assert.deepEqual(best.notes, v('F3 A3 B3 E4'));
  assert.equal(best.type, 'rootless-B');
  assert.equal(best.comparison.movement, 1);
  const movements = suggest('G7', { previous: v('F3 A3 C4 E4') }).filter(c => c.notes.length === 4).map(c => c.comparison.movement);
  assert.deepEqual(movements, [...movements].sort((a, b) => a - b));   // four-note candidates sorted by movement
});

test('suggestions keep the texture: same note count as the previous voicing first, then least movement', () => {
  const after4 = suggest('Em7', { previous: v('F3 A3 C4 E4') });
  assert.equal(after4[0].notes.length, 4);                             // not a two-note shell
  const fourNoteMovements = after4.filter(c => c.notes.length === 4).map(c => c.comparison.movement);
  assert.deepEqual(fourNoteMovements, [...fourNoteMovements].sort((a, b) => a - b));
  const after2 = suggest('Em7', { previous: v('F3 C4') });
  assert.equal(after2[0].notes.length, 2);                             // a shell follows a shell
});

test('altered dominants fill the 9 and 13 slots with what the chord allows', () => {
  const alt = suggest('C7alt').find(c => c.type === 'rootless-A');
  assert.deepEqual(alt.notes.map(n => n % 12), [4, 8, 10, 1]);       // E Ab Bb Db
  for (const { notes } of suggest('C7alt')) {
    for (const pc of [7, 2, 9]) assert.ok(!notes.some(n => n % 12 === pc), `natural 5, 9 or 13 in ${notes}`);
  }
  const b9 = suggest('G7b9').find(c => c.type === 'rootless-A');
  assert.ok(b9.notes.some(n => n % 12 === 8));                        // Ab, the b9
  assert.ok(!b9.notes.some(n => n % 12 === 9));                       // no natural 9
});

test('chords without two guide tones still get something, and the register is configurable', () => {
  assert.ok(Array.isArray(suggest('C')));
  const high = suggest('Cmaj7', { register: [60, 84] });
  assert.ok(high.every(c => c.notes[0] >= 60));
  assert.deepEqual(suggest('Cmaj7', { register: [40, 45] }), []);     // nothing fits
});
