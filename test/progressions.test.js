import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGrid, formatGrid, transposeSymbol, transposeGrid, PROGRESSIONS, getProgression, GridParseError } from '../src/theory/progressions.js';
import { parseChord } from '../src/theory/chords.js';
import { pcInterval } from '../src/theory/notes.js';

const symbols = grid => grid.bars.map(bar => bar.chords.map(c => c.symbol).join(' '));

test('parseGrid: bars, equal beat split, % repeats the previous bar', () => {
  const grid = parseGrid('| Dm7 G7 | Cmaj7 | % |');
  assert.deepEqual(grid.timeSignature, [4, 4]);
  assert.equal(grid.bars.length, 3);
  assert.deepEqual(grid.bars[0].chords, [{ symbol: 'Dm7', beat: 1 }, { symbol: 'G7', beat: 3 }]);
  assert.deepEqual(grid.bars[1].chords, [{ symbol: 'Cmaj7', beat: 1 }]);
  assert.deepEqual(grid.bars[2], grid.bars[1]);
  assert.notEqual(grid.bars[2], grid.bars[1]);            // a copy, not the same object
});

test('parseGrid: four chords in 4/4, three in 3/4, outer bar lines optional', () => {
  assert.deepEqual(parseGrid('| Dm7 G7 Cmaj7 A7 |').bars[0].chords.map(c => c.beat), [1, 2, 3, 4]);
  const waltz = parseGrid('| Cmaj7 | Dm7 G7 C7 |', { timeSignature: [3, 4] });
  assert.deepEqual(waltz.bars[1].chords.map(c => c.beat), [1, 2, 3]);
  assert.equal(parseGrid('Dm7 G7 | Cmaj7').bars.length, 2);
  assert.equal(parseGrid('  | Dm7 |  ').bars.length, 1);
});

test('parseGrid: errors carry the bar number and a reason', () => {
  const expectError = (text, bar, pattern, options) =>
    assert.throws(() => parseGrid(text, options), err => err instanceof GridParseError && err.bar === bar && pattern.test(err.reason), text);
  expectError('| % | Cmaj7 |', 1, /nothing to repeat/);
  expectError('| Dm7 G7 C7 |', 1, /3 chords .* 4 beats/);
  expectError('| Dm7 | H7 |', 2, /Cannot parse chord symbol "H7"/);
  expectError('| Dm7 | | G7 |', 2, /empty bar/);
  expectError('| Dm7 G7 |', 1, /2 chords .* 3 beats/, { timeSignature: [3, 4] });
  assert.throws(() => parseGrid(''), GridParseError);
  assert.throws(() => parseGrid('|  |'), GridParseError);
});

test('formatGrid round-trips a parsed grid, using % for repeated bars', () => {
  for (const text of ['| Dm7 G7 | Cmaj7 | % |', '| C7 | F7 | C7 | % | F7 | F#° |', '| Cmaj7 A7 | Dm7 G7 |']) {
    assert.equal(formatGrid(parseGrid(text).bars), text);
  }
  const waltz = '| Cmaj7 | Dm7 G7 C7 |';
  assert.equal(formatGrid(parseGrid(waltz, { timeSignature: [3, 4] }).bars), waltz);
});

test('transposeSymbol: interval, spelling by preference, slash bass, quality untouched', () => {
  assert.equal(transposeSymbol('Dm7', 3, { flats: true }), 'Fm7');
  assert.equal(transposeSymbol('Dm7', 1, { flats: true }), 'Ebm7');
  assert.equal(transposeSymbol('Dm7', 1, { flats: false }), 'D#m7');
  assert.equal(transposeSymbol('G7alt', 5, { flats: true }), 'C7alt');
  assert.equal(transposeSymbol('C6/9', 2, { flats: true }), 'D6/9');
  assert.equal(transposeSymbol('C/E', 5, { flats: true }), 'F/A');
  assert.equal(transposeSymbol('F#°', 5, { flats: true }), 'B°');
  assert.equal(transposeSymbol('Cmaj7', 0, { flats: true }), 'Cmaj7');
  assert.equal(transposeSymbol('Bmaj7', 4, { flats: true }), 'Ebmaj7');
});

test('transposeGrid: spelling follows the target key, intervals are preserved', () => {
  const iiVI = parseGrid('| Dm7 | G7 | Cmaj7 | % |');
  assert.deepEqual(symbols(transposeGrid(iiVI, 'C', 'Db')), ['Ebm7', 'Ab7', 'Dbmaj7', 'Dbmaj7']);
  assert.deepEqual(symbols(transposeGrid(iiVI, 'C', 'E')), ['F#m7', 'B7', 'Emaj7', 'Emaj7']);
  assert.deepEqual(symbols(transposeGrid(iiVI, 'C', 'F#')), ['G#m7', 'C#7', 'F#maj7', 'F#maj7']);
  assert.deepEqual(symbols(transposeGrid(iiVI, 'C', 'Gb')), ['Abm7', 'Db7', 'Gbmaj7', 'Gbmaj7']);
  assert.deepEqual(symbols(transposeGrid(iiVI, 'C', 'C')), ['Dm7', 'G7', 'Cmaj7', 'Cmaj7']);
  assert.deepEqual(symbols(transposeGrid(parseGrid('| Cmaj7 A7 | Dm7 G7 |'), 'C', 'Bb')), ['Bbmaj7 G7', 'Cm7 F7']);

  for (const key of ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']) {
    const moved = transposeGrid(iiVI, 'C', key);
    const interval = pcInterval(0, parseChord(key + 'maj7').rootPc);
    iiVI.bars.forEach((bar, i) => bar.chords.forEach((chord, j) => {
      const before = parseChord(chord.symbol).chordTones;
      const after = parseChord(moved.bars[i].chords[j].symbol).chordTones;
      assert.deepEqual(after, before.map(pc => (pc + interval) % 12), `${key}: ${chord.symbol}`);
    }));
    assert.equal(moved.bars[0].chords[0].beat, 1);
  }
});

test('the library: every progression parses, with the expected bar counts and chords', () => {
  const bars = id => symbols(getProgression(id));
  assert.deepEqual(bars('ii-V-I'), ['Dm7', 'G7', 'Cmaj7', 'Cmaj7']);
  assert.deepEqual(bars('ii-V-i'), ['Dø7', 'G7alt', 'Cm6', 'Cm6']);
  assert.equal(bars('blues').length, 12);
  assert.equal(bars('jazz-blues').length, 12);
  assert.deepEqual(bars('jazz-blues').slice(3, 6), ['Gm7 C7', 'F7', 'F#°']);
  assert.equal(bars('rhythm-changes-A').length, 8);
  assert.deepEqual(bars('turnaround'), ['Cmaj7 A7', 'Dm7 G7']);
  assert.deepEqual(bars('coltrane'), ['Cmaj7 Eb7', 'Abmaj7 B7', 'Emaj7 G7', 'Cmaj7']);
  for (const [id, entry] of Object.entries(PROGRESSIONS)) {
    assert.ok(entry.name, id);
    assert.doesNotThrow(() => parseGrid(entry.grid, { timeSignature: entry.timeSignature }), id);
  }
  assert.deepEqual(parseChord(getProgression('ii-V-i').bars[0].chords[0].symbol).quality, 'm7b5');
});

test('getProgression transposes and never spells Cb, Fb, E# or B#', () => {
  assert.deepEqual(symbols(getProgression('coltrane', 'Eb')), ['Ebmaj7 Gb7', 'Bmaj7 D7', 'Gmaj7 Bb7', 'Ebmaj7']);
  assert.deepEqual(symbols(getProgression('jazz-blues', 'F')).slice(3, 6), ['Cm7 F7', 'Bb7', 'B°']);
  assert.equal(getProgression('turnaround', 'Bb').key, 'Bb');
  assert.throws(() => getProgression('nope'), /Unknown progression/);
});
