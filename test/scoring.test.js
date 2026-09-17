import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { createPiece, addMelody } from '../src/theory/piece.js';
import { analyzePiece } from '../src/theory/analysis.js';
import { generateCandidates } from '../src/theory/candidates.js';
import { scoreReharm, resolveChoices, DENSITY_TARGETS } from '../src/theory/scoring.js';

const raw = (name, bar, beat, durationBeats) => ({ midi: nameToMidi(name), bar, beat, durationBeats, velocity: 80 });
const analyzed = (grid, melody = []) => analyzePiece(addMelody(createPiece({ key: 'C', grid }), melody));
const menu = piece => generateCandidates(piece, { maxPerSlot: 1000, intensity: 'heavy', style: 'free' });
const symbolsOf = candidate => candidate.chords.map(c => c.symbol).join(' ');
// A choice as the pipeline hands it to the scorer: the slot plus the resolved candidate object.
const pick = (piece, bar, technique, symbols, slot = 1) => {
  const list = menu(piece).slots.find(s => s.bar === bar && s.slot === slot).candidates;
  const candidate = list.find(c => c.technique === technique && (symbols === undefined || symbolsOf(c) === symbols));
  assert.ok(candidate, `${technique} ${symbols ?? ''} expected in bar ${bar}`);
  return { bar, slot, candidate };
};
const manual = (bar, chords, technique = 'other') =>
  ({ bar, slot: 1, candidate: { id: `b${bar}s1-manual`, chords, technique, spans: 1, bassStepToNext: 0, warnings: [] } });
const near = (actual, expected, what) => assert.ok(Math.abs(actual - expected) < 1e-9, `${what}: ${actual} != ${expected}`);

test('all original: nothing changed, nothing clashes, a walking-fifths bass is perfectly smooth', () => {
  const piece = analyzed('| Dm7 | G7 | Cmaj7 |');
  const score = scoreReharm(piece, []);
  assert.deepEqual(score, {
    clashes: 0, warnings: 0, bassSmoothness: 1,
    density: 0, densityTarget: { min: 0.4, max: 0.6 }, densityOk: false,
    maxRun: 0, maxRunOk: true, techniqueMix: 0, techniques: {},
  });
  assert.equal(scoreReharm(piece, [], { intensity: 'light' }).densityOk, true);
  const explicitOriginal = { bar: 2, slot: 1, candidate: menu(piece).slots[1].candidates[0] };
  assert.equal(scoreReharm(piece, [explicitOriginal]).density, 0);
  assert.deepEqual(DENSITY_TARGETS.heavy, { min: 0.6, max: 1 });
});

test('one tritone substitution: density, technique mix, and the bass walks D-Db-C', () => {
  const piece = analyzed('| Dm7 | G7 | Cmaj7 |');
  const score = scoreReharm(piece, [pick(piece, 2, 'tritone-sub', 'Db7')]);
  assert.equal(score.density, 1 / 3);
  assert.deepEqual(score.techniques, { 'tritone-sub': 1 });
  assert.equal(score.techniqueMix, 1);
  assert.equal(score.maxRun, 1);
  assert.equal(score.bassSmoothness, 1);
  assert.equal(score.clashes, 0);
});

test('bass smoothness follows the cost table: steps and fifths are free, thirds cost, the tritone costs most', () => {
  const smoothness = (grid, chosen = []) => scoreReharm(analyzed(grid), chosen).bassSmoothness;
  near(smoothness('| Cmaj7 | Dm7 | Ebmaj7 | Gb7 |'), 0.75, 'C-D-Eb-Gb');     // whole step .25, half step 0, minor third .5
  near(smoothness('| Cmaj7 | Em7 | Cmaj7 |'), 0.25, 'C-E-C');               // two major thirds
  near(smoothness('| C7 | Gb7 |'), 0, 'tritone');
  near(smoothness('| Cmaj7 | C7 |'), 1, 'same root');
  near(smoothness('| Cmaj7 |'), 1, 'single chord');
  near(smoothness('| Cmaj7 | C/E | Fmaj7 |'), 0.625, 'slash bass');         // the bass is E, not C: major third then half step
});

test('clashes and warnings are recomputed from the melody against the chosen chords', () => {
  const piece = analyzed('| Dm7 | G7 | Cmaj7 |', [raw('F4', 3, 1, 2), raw('G4', 3, 2.5, 0.5)]);
  const original = scoreReharm(piece, []);
  assert.equal(original.warnings, 1);                                         // F is the avoid 11 on Cmaj7
  assert.equal(original.clashes, 0);
  const clashing = scoreReharm(piece, [manual(3, [{ symbol: 'Emaj7', bar: 3, beat: 1 }])]);
  assert.equal(clashing.clashes, 1);                                          // F is the b9 of Emaj7
  assert.equal(clashing.warnings, 0);                                         // the passing G is not checked

  const split = analyzed('| Dm7 | G7 | Cmaj7 |', [raw('F4', 2, 1, 2), raw('B4', 2, 3, 2)]);
  const halves = [{ symbol: 'Dm7', bar: 2, beat: 1 }, { symbol: 'Abmaj7', bar: 2, beat: 3 }];
  assert.equal(scoreReharm(split, [manual(2, halves)]).clashes, 1);          // B against Abmaj7 in the second half
  const swapped = analyzed('| Dm7 | G7 | Cmaj7 |', [raw('B4', 2, 1, 2), raw('F4', 2, 3, 2)]);
  assert.equal(scoreReharm(swapped, [manual(2, halves)]).clashes, 0);        // B is the 13 of Dm7, F the 13 of Abmaj7
});

test('density targets per intensity; runs longer than four are penalised below heavy', () => {
  const piece = analyzed('| Dm7 | G7 | Cmaj7 | Am7 | Dm7 | G7 | Cmaj7 | Am7 |');
  const changeOn = bars => bars.map(bar => pick(piece, bar, 'quality-change'));
  const at = (chosen, intensity) => scoreReharm(piece, chosen, { intensity });

  const two = changeOn([1, 5]);
  assert.equal(at(two, 'light').density, 0.25);
  assert.deepEqual([at(two, 'light').densityOk, at(two, 'medium').densityOk, at(two, 'heavy').densityOk], [true, false, false]);
  const four = changeOn([1, 3, 5, 7]);
  assert.deepEqual([at(four, 'light').densityOk, at(four, 'medium').densityOk, at(four, 'heavy').densityOk], [false, true, false]);
  assert.equal(at(four, 'medium').maxRun, 1);
  const fiveInARow = changeOn([1, 2, 3, 4, 5]);
  assert.equal(at(fiveInARow, 'heavy').density, 0.625);
  assert.deepEqual([at(fiveInARow, 'light').densityOk, at(fiveInARow, 'medium').densityOk, at(fiveInARow, 'heavy').densityOk], [false, false, true]);
  assert.equal(at(fiveInARow, 'medium').maxRun, 5);
  assert.deepEqual([at(fiveInARow, 'light').maxRunOk, at(fiveInARow, 'medium').maxRunOk, at(fiveInARow, 'heavy').maxRunOk], [false, false, true]);
  assert.equal(at(changeOn([1, 2, 3, 4]), 'medium').maxRunOk, true);
  assert.deepEqual(at(four, 'medium').densityTarget, { min: 0.4, max: 0.6 });

  const mixed = [pick(piece, 2, 'tritone-sub', 'Db7'), pick(piece, 3, 'quality-change'), pick(piece, 6, 'quality-change')];
  assert.deepEqual(at(mixed, 'medium').techniques, { 'tritone-sub': 1, 'quality-change': 2 });
  assert.equal(at(mixed, 'medium').techniqueMix, 2);
});

test('a Coltrane cycle counts as two changed slots; a choice on the covered slot is ignored', () => {
  const piece = analyzed('| Dm7 | G7 | Cmaj7 | % |');
  const cycle = pick(piece, 1, 'coltrane');
  const ignored = pick(piece, 2, 'tritone-sub', 'Db7');
  const slots = resolveChoices(piece, [cycle, ignored]);
  assert.deepEqual(slots.flatMap(s => s.chords).map(c => c.symbol), ['Abmaj7', 'B7', 'Emaj7', 'G7', 'Cmaj7', 'Cmaj7']);
  assert.deepEqual(slots.map(s => s.changed), [true, true, false, false]);
  assert.equal(slots[1].coveredBy, cycle.candidate.id);
  assert.equal(slots[1].candidate, null);
  assert.equal(slots[2].technique, 'original');

  const score = scoreReharm(piece, [cycle, ignored]);
  assert.equal(score.density, 0.5);
  assert.equal(score.maxRun, 2);
  assert.deepEqual(score.techniques, { coltrane: 1 });
  assert.equal(score.techniqueMix, 1);
  near(score.bassSmoothness, 0.8, 'Ab-B-E-G-C-C');                          // two minor thirds cost .5 each over five moves
  assert.equal(score.clashes, 0);
});
