// The analyzer's verdict, said in either language from its parts (`code` and `params`), never
// by translating the English sentence after it is built. In English the result must be the
// analyzer's own `text`, word for word: that is what keeps the two from drifting apart.

import test from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { parseChord } from '../src/theory/chords.js';
import { analyzeVoicing, inversionOf } from '../src/theory/analyzer.js';
import { describeMessage, describeVoicing, describeInversion, describeProblem } from '../src/i18n/messages.js';
import { emptyStats, recordAttempt, weakSpots } from '../src/ui/stats.js';

const analyze = (symbol, notes) =>
  analyzeVoicing(notes ? notes.split(' ').map(nameToMidi) : [], parseChord(symbol));

// Every code the analyzer has, and every way the type and the bass can be said.
const CASES = [
  ['Cmaj7', 'C4 E4 G4'],                 // missing
  ['C/E', 'C3 E3 G3'],                   // bass
  ['C/E', ''],                           // bass, nothing played
  ['Cmaj7', 'E3 G3 B3 D4'],              // rootless, rootless A
  ['Cmaj7', 'C4 E4 G4 B4 Db5'],          // wrong
  ['Cmaj7', 'C4 E4 F4 B4'],              // avoid
  ['Dm7', 'D3 F3 C4 B4'],                // caution
  ['Cmaj7', 'C2 E2 G2 B2'],              // muddy: M3 and m3
  ['F#7', 'F#1 G#1 A#1 E2'],             // muddy: M2
  ['C', 'C1 Db1'],                       // muddy: m2, and a wrong note
  ['Cmaj7', 'E3 B3 E4'],                 // doubling
  ['Cmaj7', 'C3 E3 B3'],                 // shell
  ['Dm7', 'C4 E4 F4 A4'],                // rootless B
  ['Cmaj7', 'G3 C4 E4 B4'],              // drop 2
  ['Cmaj7', 'E3 C4 G4 B4'],              // drop 3
  ['Cmaj7', 'C3 G3 E4 B4'],              // drop 2&4
  ['Dm7', 'D3 G3 C4 F4 A4'],             // quartal
  ['G7', 'F3 B3 A4 C#5 E5'],             // upper structure triad, with its triad
  ['Cmaj7', 'C4 E4 G4 B4'],              // close position
  ['C', 'C3 G3 E4'],                     // spread
  ['Cmaj7', 'C2 E4 G4 B4 D5'],           // root in the bass
  ['Cmaj7', 'G2 E4 G4 B4 D5'],           // 5th in the bass
];

test('in English, every message reads exactly as the analyzer wrote it', () => {
  const codes = new Set();
  for (const [symbol, notes] of CASES) {
    for (const message of analyze(symbol, notes).messages) {
      codes.add(message.code);
      assert.equal(describeMessage('en', message), message.text, `${symbol}: ${notes}`);
    }
  }
  // The cases above reach every code; a new code needs a case here and a key in both languages.
  assert.deepEqual([...codes].sort(),
    ['avoid', 'bass', 'caution', 'doubling', 'missing', 'muddy', 'rootless', 'type', 'wrong']);
});

test('in English, every voicing type is named as the analyzer names it', () => {
  const types = new Set();
  for (const [symbol, notes] of CASES) {
    const analysis = analyze(symbol, notes);
    const message = analysis.messages.find(m => m.code === 'type');
    if (!message) continue;
    types.add(analysis.voicing.type);
    assert.equal(describeVoicing('en', analysis.voicing), message.text, `${symbol}: ${notes}`);
  }
  assert.equal(types.size, 10, 'every type of the analyzer');
});

test('in Romanian, the sentence is Romanian and the notes stay letters', () => {
  const say = (symbol, notes, code) =>
    describeMessage('ro', analyze(symbol, notes).messages.find(m => m.code === code));
  assert.equal(say('Cmaj7', 'C4 E4 G4', 'missing'), 'Lipsește B (7)');
  assert.equal(say('Cmaj7', 'C2 E2', 'muddy'), 'Prea jos: C2–E2 (terță mare)');
  assert.equal(say('Cmaj7', 'C4 E4 F4 B4', 'avoid'), 'Avoid note: F (11)');
  assert.equal(say('C/E', 'C3 E3 G3', 'bass'), 'Basul trebuie să fie E, nu C');
});

test('in Romanian, every interval the low limits can flag has a Romanian name', () => {
  const names = [1, 2, 3, 4, 5, 6, 7].map(semitones =>
    describeMessage('ro', { code: 'muddy', params: { lower: 'C1', upper: 'X1', semitones } }));
  assert.deepEqual(names.map(text => text.match(/\((.*)\)/)[1]), [
    'secundă mică', 'secundă mare', 'terță mică', 'terță mare',
    'cvartă perfectă', 'cvartă mărită', 'cvintă perfectă',
  ]);
});

test('an interval with no name is said in semitones, in either language', () => {
  const muddy = { code: 'muddy', params: { lower: 'C1', upper: 'C2', semitones: 12 } };
  assert.equal(describeMessage('en', muddy), 'Muddy: C1–C2 (12 semitones) is too low');
  assert.equal(describeMessage('ro', muddy), 'Prea jos: C1–C2 (12 semitonuri)');
});

test('the jazz names stay English in Romanian; what is around them does not', () => {
  assert.equal(describeVoicing('ro', { type: 'drop-2', detail: null, bass: null }), 'Drop 2');
  assert.equal(describeVoicing('ro', { type: 'rootless-A', detail: null, bass: 'root' }),
    'Rootless A, fundamentala în bas');
  assert.equal(describeVoicing('ro', { type: 'upper-structure', detail: 'A', bass: '5' }),
    'Upper structure triad (A), cvinta în bas');
  assert.equal(describeVoicing('en', { type: null, detail: null, bass: null }), null);
});

test('inversions keep their English names in both languages', () => {
  const inversions = ['root position', '1st inversion', '2nd inversion', '3rd inversion'];
  for (const name of inversions) {
    assert.equal(describeInversion('en', name), name);
    assert.equal(describeInversion('ro', name), name);
  }
  assert.equal(describeInversion('ro', null), null);
  assert.equal(describeInversion('en', inversionOf(analyze('C/E', 'E3 G3 C4'))), '1st inversion');
});

test('a weak spot reads as stats.js writes it in English, and in Romanian from its parts', () => {
  let stats = emptyStats();
  for (const [symbol, notes] of [['Cmaj7', 'C4 E4 G4'], ['Cmaj7', 'C4 E4 G4 B4 Db5'], ['Cmaj7', 'C4 E4 F4 B4']]) {
    const chord = parseChord(symbol);
    stats = recordAttempt(stats, { key: symbol.slice(1), chord, analysis: analyze(symbol, notes) });
  }
  const spots = weakSpots(stats, { limit: 10 });
  assert.deepEqual([...new Set(spots.map(spot => spot.kind))].sort(), ['avoid', 'missing', 'wrong']);
  for (const spot of spots) assert.equal(describeProblem('en', spot), spot.problem);
  assert.equal(describeProblem('ro', { kind: 'missing', degree: '7' }), 'lipsește treapta 7');  // "lipsește 7" read as seven missing notes
  assert.equal(describeProblem('ro', { kind: 'wrong', degree: null }), 'note greșite');
  assert.equal(describeProblem('ro', { kind: 'avoid', degree: null }), 'avoid notes');
});

test('a missing degree reads as a degree, not as a count', () => {
  // "5 missing, 1 time" read as five notes missing. The article makes the 5 a name.
  assert.equal(describeProblem('en', { kind: 'missing', degree: '5' }), 'missing the 5');
  assert.equal(describeProblem('ro', { kind: 'missing', degree: '5' }), 'lipsește treapta 5');
});
