import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChord, classifyPc, qualityIds, QUALITIES, ChordParseError } from '../src/theory/chords.js';

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

test('more aliases: Unicode variants, Real Book spellings, sixths, minor-major, sus, triads', () => {
  const cases = {
    maj7: ['C∆', 'C∆7', 'CMA7', 'Cma7'],
    m7: ['Cmi7', 'CMI7'],
    m7b5: ['CØ', 'CØ7', 'C-7b5', 'C-7(b5)', 'Cmi7(b5)', 'Cm7(b5)'],
    dim7: ['Cº7', 'Cdim', 'C°', 'Cº'],      // a bare ° or dim reads as dim7, as in charts
    '6': ['C6'],
    '6/9': ['C6/9', 'C69'],
    m6: ['Cm6', 'C-6'],
    mMaj7: ['CmMaj7', 'Cm(maj7)', 'CmM7', 'C-Δ7', 'C-∆'],
    '7sus4': ['C7sus4', 'C7sus'],
    sus4: ['Csus4', 'Csus'],
    maj: ['C', 'Cmaj', 'CM'],
    m: ['Cm', 'C-', 'Cmin', 'Cmi'],
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

  assert.equal(parseChord('C/E').quality, 'maj');
  assert.equal(parseChord('C/E').bassPc, 4);
});

test('shorthands imply the seventh of the family and make the extension required', () => {
  const c9 = parseChord('C9');
  assert.equal(c9.quality, '7');
  assert.deepEqual(c9.extensions, ['9']);
  assert.deepEqual(c9.required, [4, 10, 2]);                  // E Bb D

  assert.equal(parseChord('Cm11').quality, 'm7');
  assert.deepEqual(parseChord('Cm11').extensions, ['11']);
  assert.equal(parseChord('Cmaj13').quality, 'maj7');
  assert.equal(parseChord('CΔ9').quality, 'maj7');

  const sus = parseChord('C13sus4');
  assert.equal(sus.quality, '7sus4');
  assert.deepEqual(sus.extensions, ['13']);

  // C11 asks for the 11th explicitly: it leaves the avoid list and becomes required.
  const c11 = parseChord('C11');
  assert.deepEqual(c11.avoid, []);
  assert.ok(c11.tensions.available.includes(5));
  assert.ok(c11.required.includes(5));

  const alt = parseChord('Calt');
  assert.equal(alt.quality, '7');
  assert.deepEqual(alt.extensions, ['b13']);
});

test('an explicit extension is required and excludes the other forms of its degree', () => {
  const b9 = parseChord('C7b9');
  assert.deepEqual(b9.required, [4, 10, 1]);                  // E Bb Db
  assert.deepEqual(b9.tensions.available, [9]);               // 13 only: the natural 9 is gone
  assert.deepEqual(b9.tensions.altered, [1, 3, 6, 8]);        // #9 stays (half-whole scale)
  assert.equal(b9.degrees[2], null);                          // D is a wrong note now

  const s9 = parseChord('C7#9');
  assert.equal(s9.degrees[2], null);
  assert.equal(s9.degrees[1], 'b9');                          // b9 stays too

  assert.deepEqual(parseChord('C9').tensions.altered, [6, 8]);        // b9 and #9 are gone
  assert.deepEqual(parseChord('C7b13').tensions.available, [2]);      // 13 is gone
  assert.deepEqual(parseChord('C13').tensions.altered, [1, 3, 6]);    // b13 is gone
  assert.deepEqual(parseChord('Cmaj7#11').required, [4, 11, 6]);
});

test('b5, #5 and alt are dominant-only spellings', () => {
  const s5 = parseChord('C7#5');
  assert.deepEqual(s5.extensions, ['b13']);
  assert.deepEqual(s5.chordTones, [0, 4, 10]);                // the natural 5 is gone
  assert.deepEqual(s5.required, [4, 10, 8]);                  // E Bb G#
  assert.deepEqual(s5.tensions.available, [2]);               // 13 gone, 9 stays
  assert.deepEqual(s5.tensions.altered, [1, 3, 6, 8]);
  assert.deepEqual(parseChord('C7b5').extensions, ['#11']);

  // alt: the augmented core (3, #5, b7) is required; 5, 9 and 13 are wrong;
  // b9, #9 and #11 stay available, as on every chart.
  const alt = parseChord('C7alt');
  assert.deepEqual(alt.chordTones, [0, 4, 10]);
  assert.deepEqual(alt.required, [4, 10, 8]);
  assert.deepEqual(alt.tensions.available, []);
  assert.deepEqual(alt.tensions.altered, [1, 3, 6, 8]);
  assert.deepEqual(alt.degrees, ['1', 'b9', null, '#9', '3', '11', '#11', null, 'b13', null, 'b7', null]);

  for (const bad of ['Cm7#5', 'Cmaj7b5', 'Cm7alt']) {
    assert.throws(() => parseChord(bad), ChordParseError, bad);
  }
});

test('triads and sus4: the sevenths they usually get in practice are tensions', () => {
  const c = parseChord('C');
  assert.equal(c.quality, 'maj');
  assert.deepEqual(c.chordTones, [0, 4, 7]);
  assert.deepEqual(c.required, [4]);
  assert.deepEqual(c.tensions.available, [11, 2, 6, 9]);      // B D F# A
  assert.deepEqual(c.avoid, [5]);

  const cm = parseChord('Cm');
  assert.deepEqual(cm.chordTones, [0, 3, 7]);
  assert.deepEqual(cm.tensions.available, [10, 11, 2, 5, 9]); // Bb B D F A
  assert.deepEqual(cm.avoid, []);

  const sus = parseChord('Csus4');
  assert.deepEqual(sus.chordTones, [0, 5, 7]);
  assert.deepEqual(sus.required, [5]);
  assert.deepEqual(sus.tensions.available, [2, 9, 10]);       // D A Bb
  assert.deepEqual(sus.avoid, [4]);                           // E
});

test('caution notes: 13 on a ii chord, nothing on a i chord, 9 on m7b5', () => {
  const ii = parseChord('Dm7');
  assert.deepEqual(ii.caution, [11]);                         // B, the 13th
  assert.ok(ii.tensions.available.includes(11));              // still a valid tension
  assert.deepEqual(parseChord('Dm7', { minorFunction: 'i' }).caution, []);
  assert.deepEqual(parseChord('Bm7b5').caution, [1]);         // C#
});

test('classifyPc: one place decides the role of every pitch class', () => {
  const g7 = parseChord('G7');
  assert.deepEqual(classifyPc(g7, 11), { role: 'chordTone', degree: '3', caution: false });
  assert.deepEqual(classifyPc(g7, 9), { role: 'tension', degree: '9', caution: false });
  assert.deepEqual(classifyPc(g7, 8), { role: 'altered', degree: 'b9', caution: false });
  assert.deepEqual(classifyPc(g7, 3), { role: 'altered', degree: 'b13', caution: false });
  assert.deepEqual(classifyPc(g7, 0), { role: 'avoid', degree: '11', caution: false });
  assert.deepEqual(classifyPc(parseChord('Cmaj7'), 1), { role: 'wrong', degree: null, caution: false });
  assert.deepEqual(classifyPc(parseChord('Dm7'), 11), { role: 'tension', degree: '13', caution: true });
});

test('extensions can be concatenated, in parentheses, or separated by commas and spaces', () => {
  for (const symbol of ['C7b9#11', 'C7(b9,#11)', 'C7(b9 #11)', 'C7(b9)(#11)']) {
    assert.deepEqual(parseChord(symbol).extensions, ['b9', '#11'], symbol);
  }
  assert.equal(parseChord('  C7 ').symbol, 'C7');
});

test('invalid symbols throw ChordParseError instead of crashing', () => {
  for (const bad of ['', 'H7', 'Cmaj8', 'C7/X', 'Dm7#']) {
    assert.throws(() => parseChord(bad), ChordParseError, `"${bad}" should throw ChordParseError`);
  }
});

test('ChordParseError carries the symbol and a reason', () => {
  const cases = {
    'C7+': 'unknown quality or extension "+"',          // ambiguous between conventions, so rejected
    'Cmaj7b9': '"b9" is not available on maj7',
    'C7/': 'invalid bass note ""',
    'C6/9/X': 'invalid bass note "X"',
  };
  for (const [symbol, reason] of Object.entries(cases)) {
    assert.throws(
      () => parseChord(symbol),
      err => err instanceof ChordParseError && err.symbol === symbol && err.reason === reason,
      symbol,
    );
  }
  assert.throws(() => parseChord(42), ChordParseError);
});

test('qualityIds lists every quality in table order, not in Object.keys order', () => {
  const ids = qualityIds();
  // Object.keys would put the integer-like keys '6' and '7' first; the table order must survive.
  assert.equal(ids[0], 'maj7');
  assert.ok(ids.indexOf('6') > ids.indexOf('maj7'));
  assert.deepEqual([...ids].sort(), Object.keys(QUALITIES).sort());
  assert.equal(new Set(ids).size, ids.length);
});
