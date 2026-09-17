import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChord, ChordParseError } from '../src/theory/chords.js';

test('Cmaj7: full output shape', () => {
  assert.deepEqual(parseChord('Cmaj7'), {
    symbol: 'Cmaj7',
    root: 'C',
    rootPc: 0,
    quality: 'maj7',
    extensions: [],
    chordTones: [0, 4, 7, 11],                  // C E G B
    guideTones: [4, 11],
    required: [4, 11],
    tensions: { available: [2, 6, 9], altered: [] },   // D F# A
    avoid: [5],                                 // F
    caution: [],
    // Lists are exhaustive: Db, Eb, Ab, Bb are wrong notes (null), not avoid.
    degrees: ['1', null, '9', null, '3', '11', '#11', '5', null, '13', null, '7'],
    bass: null,
    bassPc: null,
  });
});

test('aliases map to the same canonical quality', () => {
  const cases = {
    maj7: ['Cmaj7', 'CΔ', 'CΔ7', 'CM7'],
    m7: ['Cm7', 'C-7', 'Cmin7'],
    m7b5: ['Cm7b5', 'Cø', 'Cø7'],
    dim7: ['Cdim7', 'C°7', 'Co7'],
  };
  for (const [quality, symbols] of Object.entries(cases)) {
    for (const symbol of symbols) {
      assert.equal(parseChord(symbol).quality, quality, symbol);
    }
  }
});

test('G7: chord tones, available and altered tensions, avoid', () => {
  const chord = parseChord('G7');
  assert.deepEqual(chord.chordTones, [7, 11, 2, 5]);          // G B D F
  assert.deepEqual(chord.guideTones, [11, 5]);                // B F
  assert.deepEqual(chord.tensions.available, [9, 4]);         // A E
  assert.deepEqual(chord.tensions.altered, [8, 10, 1, 3]);    // Ab A# C# Eb
  assert.deepEqual(chord.avoid, [0]);                         // C
});

test('Cdim7: tensions a whole step above each chord tone, no avoid list', () => {
  const chord = parseChord('Cdim7');
  assert.deepEqual(chord.chordTones, [0, 3, 6, 9]);           // C Eb Gb Bbb
  assert.deepEqual(chord.tensions.available, [2, 5, 8, 11]);  // D F Ab B
  assert.deepEqual(chord.tensions.altered, []);
  assert.deepEqual(chord.avoid, []);
});

test('roots with accidentals and slash bass', () => {
  const db7 = parseChord('Db7/F');
  assert.equal(db7.root, 'Db');
  assert.equal(db7.rootPc, 1);
  assert.equal(db7.quality, '7');
  assert.deepEqual(db7.chordTones, [1, 5, 8, 11]);            // Db F Ab Cb
  assert.equal(db7.bass, 'F');
  assert.equal(db7.bassPc, 5);

  const fsharp = parseChord('F#m7b5');
  assert.equal(fsharp.root, 'F#');
  assert.equal(fsharp.rootPc, 6);
  assert.deepEqual(fsharp.chordTones, [6, 9, 0, 4]);          // F# A C E
  assert.equal(fsharp.bass, null);
  assert.equal(fsharp.bassPc, null);
});

test('invalid symbols throw ChordParseError instead of crashing', () => {
  for (const bad of ['', 'H7', 'Cmaj8', 'C7/X', 'Dm7#']) {
    assert.throws(() => parseChord(bad), ChordParseError, `"${bad}" should throw ChordParseError`);
  }
});
