import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { createPiece, addMelody } from '../src/theory/piece.js';
import { analyzePiece } from '../src/theory/analysis.js';

const piece = (grid, options = {}) => createPiece({ key: 'C', grid, ...options });
const slots = analyzed => analyzed.bars.flatMap(bar => bar.chords);
const romans = analyzed => slots(analyzed).map(c => c.analysis.roman);
const functions = analyzed => slots(analyzed).map(c => c.analysis.function);
const cadences = analyzed => slots(analyzed).map(c => c.analysis.cadence);

test('ii–V–I with a secondary dominant: degrees, functions, cadences', () => {
  const a = analyzePiece(piece('| Dm7 G7 | Cmaj7 | E7 | Am7 | Dm7 | G7 | Cmaj7 | % |'));
  assert.deepEqual(a.analysis.key, { tonic: 'C', mode: 'major', guessed: false });
  assert.deepEqual(romans(a), ['ii7', 'V7', 'Imaj7', 'V7/vi', 'vi7', 'ii7', 'V7', 'Imaj7', 'Imaj7']);
  assert.deepEqual(functions(a), ['S', 'D', 'T', 'D', 'T', 'S', 'D', 'T', 'T']);
  assert.deepEqual(cadences(a), [false, true, false, true, false, false, true, false, false]);
  assert.deepEqual(slots(a)[1].analysis.guideTones, [11, 5]);          // B and F on G7
});

test('jazz blues in F: I7 and IV7 are blues chords, the V7 of bar 10 is the cadence', () => {
  const a = analyzePiece(createPiece({ key: 'F', grid: '| F7 | Bb7 | F7 | % | Bb7 | B° | F7 | Am7 D7 | Gm7 | C7 | F7 D7 | Gm7 C7 |' }));
  const r = romans(a);
  assert.equal(r[0], 'I7');
  assert.equal(r[1], 'IV7');
  assert.equal(r[3], 'I7');                                             // bar 4 stays I7, not V7/IV
  assert.equal(r[5], '#iv°');
  assert.deepEqual(r.slice(7, 12), ['iii7', 'V7/ii', 'ii7', 'V7', 'I7']);
  const f = functions(a);
  assert.equal(f[0], 'T');
  assert.equal(f[1], 'S');
  assert.equal(f[5], 'passing');
  assert.equal(f[10], 'D');
  const c = cadences(a);
  assert.equal(c[0], false);
  assert.equal(c[3], false);
  assert.equal(c[10], true);                                            // C7 → F7
  assert.equal(c[8], true);                                             // D7 → Gm7
});

test('minor ii–V–i: minor mode, iiø7, V7alt, i6', () => {
  const a = analyzePiece(piece('| Dø7 | G7alt | Cm6 | % |'));
  assert.equal(a.analysis.key.mode, 'minor');
  assert.deepEqual(romans(a), ['iiø7', 'V7alt', 'i6', 'i6']);
  assert.deepEqual(functions(a), ['S', 'D', 'T', 'T']);
  assert.deepEqual(cadences(a), [false, true, false, false]);
});

test('tritone substitution: bII7 is dominant and resolves by a half step', () => {
  const a = analyzePiece(piece('| Dm7 Db7 | Cmaj7 |'));
  assert.deepEqual(romans(a), ['ii7', 'bII7', 'Imaj7']);
  assert.deepEqual(functions(a), ['S', 'D', 'T']);
  assert.deepEqual(cadences(a), [false, true, false]);
});

test('passing diminished, minor iv and the backdoor bVII7', () => {
  const dim = analyzePiece(piece('| Cmaj7 C#° | Dm7 |'));
  assert.deepEqual(romans(dim), ['Imaj7', '#i°', 'ii7']);
  assert.deepEqual(functions(dim), ['T', 'passing', 'S']);
  const backdoor = analyzePiece(piece('| Fm7 Bb7 | Cmaj7 |'));
  assert.deepEqual(romans(backdoor), ['iv7', 'bVII7', 'Imaj7']);
  assert.deepEqual(functions(backdoor), ['S', 'D', 'T']);
  assert.deepEqual(cadences(backdoor), [false, true, false]);
  const borrowed = analyzePiece(piece('| Abmaj7 | Bb7 | Ebmaj7 |'));
  assert.deepEqual(romans(borrowed), ['bVImaj7', 'bVII7', 'bIIImaj7']);
  assert.deepEqual(functions(borrowed), ['S', 'D', 'S']);                // Bb7 → Eb: a fifth down, still a cadence
});

test('a modal passage without a declared key: the key is guessed from the chords', () => {
  const a = analyzePiece(createPiece({ key: '', grid: '| Dm7 | % | % | % | % | % | % | % |' }));
  assert.deepEqual(a.analysis.key, { tonic: 'D', mode: 'minor', guessed: true });
  assert.equal(romans(a)[0], 'i7');
  assert.equal(functions(a)[0], 'T');
});

test('melody notes get their relation to the chord under them', () => {
  const raw = (midi, bar, beat, durationBeats) => ({ midi, bar, beat, durationBeats, velocity: 80 });
  const withMelody = addMelody(piece('| Dm7 G7 | Cmaj7 |'), [
    raw(nameToMidi('E4'), 1, 1, 2),        // E on Dm7: the 9th
    raw(nameToMidi('F4'), 1, 3, 1),        // F on G7: the 7th
    raw(nameToMidi('A4'), 1, 4, 0.5),      // A on G7, short: passing
    raw(nameToMidi('F4'), 2, 1, 2),        // F on Cmaj7: avoid
    raw(nameToMidi('Bb4'), 2, 3, 2),       // Bb on Cmaj7: outside
  ]);
  const a = analyzePiece(withMelody);
  const [dm7, g7, cmaj7] = slots(a).map(c => c.analysis.melody);
  assert.deepEqual(dm7.structural.map(n => [n.midi, n.relation]), [[64, 'tension']]);
  assert.deepEqual(g7.structural.map(n => [n.midi, n.relation]), [[65, 'chordTone']]);
  assert.deepEqual(g7.passing.map(n => n.midi), [69]);
  assert.deepEqual(cmaj7.structural.map(n => [n.midi, n.relation]), [[65, 'avoid'], [70, 'outside']]);
  assert.deepEqual(dm7.passing, []);
});

test('phrases: four bars by default, configurable, the last one may be shorter', () => {
  const eight = piece('| C | % | % | % | % | % | % | % |');
  assert.deepEqual(analyzePiece(eight).analysis.phrases, [[1, 4], [5, 8]]);
  assert.deepEqual(analyzePiece(eight, { phraseLength: 8 }).analysis.phrases, [[1, 8]]);
  assert.deepEqual(analyzePiece(piece('| C | % | % | % | % | % |')).analysis.phrases, [[1, 4], [5, 6]]);
  assert.deepEqual(eight.bars[0].chords[0].analysis, undefined);        // the input is untouched
});
