import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { compingReport, placeAttack, COMPING_LIMITS } from '../src/theory/comping.js';

const v = names => names.split(' ').map(nameToMidi);
const hit = (bar, beat, names, move = false) => ({ notes: v(names), bar, beat, move });
const form = (grid, extra = {}) => ({ grid, timeSignature: [4, 4], tempo: 120, swing: true, ...extra });
const codes = report => report.findings.map(f => f.code);
const find = (report, code) => report.findings.find(f => f.code === code);
const SWUNG = 2 / 3;

// ---- Placing an attack -----------------------------------------------------------------------

test('placeAttack: swung eighths snap to the triplet "and", with the offset in milliseconds', () => {
  const clock = { timeSignature: [4, 4], tempo: 120, swing: true };
  assert.deepEqual(round(placeAttack({ bar: 3, beat: 2 + SWUNG }, clock)), { bar: 3, beat: 2.667, offsetMs: 0, onBeat: false });
  assert.deepEqual(round(placeAttack({ bar: 3, beat: 2.02 }, clock)), { bar: 3, beat: 2, offsetMs: 10, onBeat: true });
  // A downbeat played a little early belongs to the next bar.
  assert.deepEqual(round(placeAttack({ bar: 3, beat: 4.96 }, clock)), { bar: 4, beat: 1, offsetMs: -20, onBeat: true });
});

test('placeAttack: straight eighths snap to the half, so a swung "and" reads late', () => {
  const clock = { timeSignature: [4, 4], tempo: 120, swing: false };
  assert.deepEqual(round(placeAttack({ bar: 1, beat: 2.5 }, clock)), { bar: 1, beat: 2.5, offsetMs: 0, onBeat: false });
  assert.deepEqual(round(placeAttack({ bar: 1, beat: 2 + SWUNG }, clock)), { bar: 1, beat: 2.5, offsetMs: 83, onBeat: false });
});

function round(placed) {
  // `+ 0` turns the -0 of a float a hair under zero into 0, which deepEqual tells apart.
  return { ...placed, beat: Math.round(placed.beat * 1000) / 1000, offsetMs: Math.round(placed.offsetMs) + 0 };
}

// ---- Which chord an attack answers -------------------------------------------------------------

test('the "and" of 4 before a new bar is judged on the next chord, and counts as a push', () => {
  const report = compingReport([hit(1, 1, 'F3 A3 C4 E4'), hit(1, 4 + SWUNG, 'F3 A3 B3 E4')], form('| Dm7 | G7 |'));
  assert.deepEqual(report.judged.map(j => [j.symbol, j.anticipated]), [['Dm7', false], ['G7', true]]);
});

test('no anticipation in the middle of a bar: the "and" of 2 stays on the chord of beat 1', () => {
  const report = compingReport([hit(1, 1, 'F3 A3 C4 E4'), hit(1, 2 + SWUNG, 'F3 A3 B3 E4')], form('| Dm7 G7 |'));
  assert.deepEqual(report.judged.map(j => [j.symbol, j.anticipated]), [['Dm7', false], ['Dm7', false]]);
});

test('attacks in the count-in are not judged', () => {
  const report = compingReport([hit(0, 4 + SWUNG, 'F3 A3 C4 E4'), hit(1, 1, 'F3 A3 C4 E4')], form('| Dm7 |'));
  assert.equal(report.judged.length, 1);
});

// ---- 1. The chords -----------------------------------------------------------------------------

test('missed-change: a chord with nothing judged on it, with the bars where it happened', () => {
  const attacks = [hit(1, 1, 'F3 A3 C4 E4'), hit(3, 1, 'E3 G3 B3 D4'), hit(4, 1, 'F3 A3 C4 E4'), hit(6, 1, 'E3 G3 B3 D4')];
  const missed = find(compingReport(attacks, form('| Dm7 | G7 | Cmaj7 |')), 'missed-change');
  assert.equal(missed.level, 'problem');
  assert.deepEqual(missed.bars, [2, 5]);
  assert.deepEqual(missed.params, { symbol: 'G7' });
});

test('missing-tone: the same tone missing is a habit from 3 times and half the chords of that quality', () => {
  const missingB5 = 'D3 C4 F4';                  // Dø7 without Ab
  const good = 'D3 Ab3 C4 F4';
  const habit = compingReport([hit(1, 1, missingB5), hit(2, 1, missingB5), hit(3, 1, good), hit(4, 1, missingB5), hit(5, 1, good), hit(6, 1, missingB5)], form('| Dø7 |'));
  const finding = find(habit, 'missing-tone');
  assert.deepEqual([finding.count, finding.of, finding.bars], [4, 6, [1, 2, 4, 6]]);
  assert.deepEqual(finding.params, { quality: 'm7b5', degree: 'b5' });

  // Twice in six is a slip, not a habit: precision beats coverage.
  const slips = compingReport([hit(1, 1, missingB5), hit(2, 1, good), hit(3, 1, good), hit(4, 1, missingB5), hit(5, 1, good), hit(6, 1, good)], form('| Dø7 |'));
  assert.equal(find(slips, 'missing-tone'), undefined);
});

test('stale-chord: staying on the old chord after the change, and those hits are not counted twice', () => {
  const dm = 'F3 A3 C4 E4';
  const g = 'F3 A3 B3 E4';
  const attacks = [];
  for (let chorus = 0; chorus < 3; chorus++) {
    const bar = chorus * 2 + 1;
    attacks.push(hit(bar, 1, dm), hit(bar + 1, 1, dm), hit(bar + 1, 3, g));
  }
  const report = compingReport(attacks, form('| Dm7 | G7 |'));
  const stale = find(report, 'stale-chord');
  assert.deepEqual([stale.count, stale.bars], [3, [2, 4, 6]]);
  assert.equal(find(report, 'wrong-note'), undefined);
  assert.equal(find(report, 'missing-tone'), undefined);
});

test('quality-clean: a strength from 8 chords of a quality, 90% clean', () => {
  const attacks = Array.from({ length: 8 }, (_, i) => hit(i + 1, 1, 'F3 B3 E4 A4'));
  const finding = find(compingReport(attacks, form('| G7 |')), 'quality-clean');
  assert.equal(finding.level, 'strength');
  assert.deepEqual([finding.count, finding.of, finding.params.quality], [8, 8, '7']);
});

// ---- 2. Register -------------------------------------------------------------------------------

test('too-high: the top note above G5, from 3 attacks', () => {
  const high = 'E5 G5 B5';
  const report = compingReport([hit(1, 1, high), hit(2, 1, 'E4 G4 B4'), hit(3, 1, high), hit(4, 1, high)], form('| Cmaj7 |'));
  assert.deepEqual(find(report, 'too-high').bars, [1, 3, 4]);
  // G5 itself is inside the window.
  const atTheLimit = compingReport([1, 2, 3].map(bar => hit(bar, 1, 'B4 E5 G5')), form('| Cmaj7 |'));
  assert.equal(find(atTheLimit, 'too-high'), undefined);
  assert.equal(COMPING_LIMITS.topNote, nameToMidi('G5'));
});

test('muddy: the same murky pair three times, with the analyzer\'s limits', () => {
  const report = compingReport([1, 2, 3].map(bar => hit(bar, 1, 'B2 D3 F3 A3')), form('| G7 |'));
  const muddy = find(report, 'muddy');
  assert.deepEqual(muddy.params, { lower: 'B2', upper: 'D3' });
  assert.equal(muddy.count, 3);
});

test('center-out: the middle of the voicings under F3 in a quarter of the attacks', () => {
  const low = Array.from({ length: 8 }, (_, i) => hit(i + 1, 1, i < 3 ? 'B2 F3 A3' : 'B3 F4 A4'));
  const finding = find(compingReport(low, form('| G7 |')), 'center-out');
  assert.deepEqual([finding.count, finding.of, finding.params.side], [3, 8, 'below']);
});

test('register-ok: four choruses with nothing above G5 and nothing muddy', () => {
  const attacks = Array.from({ length: 8 }, (_, i) => hit(i + 1, 1, 'F3 B3 E4 A4'));
  assert.ok(codes(compingReport(attacks, form('| G7 | % |'))).includes('register-ok'));
  // Three choruses are not enough to say it.
  assert.ok(!codes(compingReport(attacks.slice(0, 6), form('| G7 | % |'))).includes('register-ok'));
});

// ---- 3. Voice leading --------------------------------------------------------------------------

test('jumpy-spot: the same change jumping in 3 of 4 choruses', () => {
  const dm = 'F3 A3 C4 E4';
  const far = 'B4 E5 F5 A5';                 // G7, an octave away
  const near = 'F3 A3 B3 E4';
  const attacks = [];
  [far, far, near, far].forEach((g, chorus) => attacks.push(hit(chorus * 2 + 1, 1, dm), hit(chorus * 2 + 2, 1, g)));
  const spot = find(compingReport(attacks, form('| Dm7 | G7 |')), 'jumpy-spot');
  assert.deepEqual(spot.params, { from: 'Dm7', to: 'G7' });
  assert.deepEqual([spot.count, spot.of, spot.bars], [3, 4, [2, 4, 8]]);
});

test('a repeated chord is not a change: two bars of the same symbol are not compared', () => {
  const report = compingReport([hit(1, 1, 'F3 B3 E4 A4'), hit(2, 1, 'B4 E5 F5 A5')], form('| G7 | % |'));
  assert.equal(report.changes.length, 0);
});

// ---- 4. Variety --------------------------------------------------------------------------------

test('one-type and one-density: the same shape and the same number of notes almost always', () => {
  const attacks = Array.from({ length: 10 }, (_, i) => hit(i + 1, 1, 'B3 E4 F4 A4'));
  const report = compingReport(attacks, form('| G7 |'));
  assert.deepEqual(find(report, 'one-type').params, { type: 'rootless-A' });
  assert.deepEqual(find(report, 'one-density').params, { notes: 4 });
});

test('static-top: the top note inside two semitones for a whole chorus, in two choruses', () => {
  const tops = ['F3 B3 E4', 'F3 A3 E4', 'E3 B3 F4', 'F3 B3 E4'];
  const attacks = [];
  for (let chorus = 0; chorus < 2; chorus++) tops.forEach((names, i) => attacks.push(hit(chorus * 4 + i + 1, 1, names)));
  assert.ok(codes(compingReport(attacks, form('| G7 | Dm7 | Cmaj7 | G7 |'))).includes('static-top'));
});

test('rhythm: the same bar pattern, downbeats only', () => {
  const attacks = [];
  for (let bar = 1; bar <= 8; bar++) attacks.push(hit(bar, 1, 'F3 B3 E4 A4'), hit(bar, 3, 'F3 B3 E4 A4'));
  const report = compingReport(attacks, form('| G7 |'));
  const pattern = find(report, 'same-pattern');
  assert.deepEqual(pattern.params.beats, [1, 3]);
  assert.deepEqual([pattern.count, pattern.of], [8, 8]);
  assert.ok(codes(report).includes('downbeats-only'));
});

test('too-busy: five or more attacks a bar on average', () => {
  const attacks = [];
  for (let bar = 1; bar <= 4; bar++) for (const beat of [1, 1 + SWUNG, 2, 3, 3 + SWUNG]) attacks.push(hit(bar, beat, 'F3 B3 E4 A4'));
  assert.ok(codes(compingReport(attacks, form('| G7 |'))).includes('too-busy'));
});

test('dragging: swung eighths are on time when the session swings, late when it says straight', () => {
  const attacks = [];
  for (let bar = 1; bar <= 12; bar++) attacks.push(hit(bar, 1, 'F3 B3 E4 A4'), hit(bar, 2 + SWUNG, 'F3 B3 E4 A4'));
  assert.ok(!codes(compingReport(attacks, form('| G7 |'))).includes('dragging'));
  const straight = compingReport(attacks, form('| G7 |', { swing: false }));
  assert.ok(codes(straight).includes('dragging'));
});

test('a move counts for voice leading but not for rhythm', () => {
  const report = compingReport([hit(1, 1, 'F3 B3 E4'), hit(1, 3, 'E3 B3 E4', true), hit(2, 1, 'F3 A3 C4 E4')], form('| G7 | Dm7 |'));
  assert.equal(report.attacks, 2);
  assert.equal(report.judged.length, 3);
});

// ---- A good session: nothing false ---------------------------------------------------------------

test('four well-played choruses of a ii–V–I: no problem with the chords, register or voice leading', () => {
  // Rootless A and B alternating, the chord re-struck in four different rhythms.
  const a = { Dm7: 'F3 A3 C4 E4', G7: 'F3 A3 B3 E4', C1: 'E3 G3 B3 D4', C2: 'B3 D4 E4 G4' };
  const b = { Dm7: 'C4 E4 F4 A4', G7: 'B3 E4 F4 A4', C1: 'B3 D4 E4 G4', C2: 'E3 G3 B3 D4' };
  const rhythms = [[1, 2 + SWUNG], [2, 3 + SWUNG], [1, 3], [1 + SWUNG, 4]];
  const attacks = [];
  for (let chorus = 0; chorus < 4; chorus++) {
    const set = chorus % 2 === 0 ? a : b;
    [set.Dm7, set.G7, set.C1, set.C2].forEach((names, i) => {
      const bar = chorus * 4 + i + 1;
      for (const beat of rhythms[(bar - 1) % 4]) attacks.push(hit(bar, beat, names));
    });
  }
  const report = compingReport(attacks, form('| Dm7 | G7 | Cmaj7 | % |'));
  const problems = report.findings.filter(f => f.level === 'problem').map(f => f.code);
  assert.deepEqual(problems, ['one-density']);           // always four notes: true
  for (const code of ['register-ok', 'smooth-overall', 'quality-clean']) assert.ok(codes(report).includes(code), code);
  assert.equal(report.choruses, 4);
  assert.ok(report.findings.every(f => typeof f.text === 'string' && f.text.length > 0));
});

// ---- What the panel shows ------------------------------------------------------------------------

test('presentReport: three problems first, then the strengths, then the rest; timing held back', async () => {
  const { presentReport } = await import('../src/theory/comping.js');
  const f = (level, code) => ({ level, code, count: 1, of: null, bars: [], params: {}, text: code });
  const report = { findings: [
    f('problem', 'missed-change'), f('problem', 'too-high'), f('strength', 'register-ok'),
    f('problem', 'jumpy-spot'), f('problem', 'one-type'), f('problem', 'dragging'), f('strength', 'smooth-overall'),
  ] };
  const shown = presentReport(report);
  assert.deepEqual(shown.first.map(x => x.code), ['missed-change', 'too-high', 'jumpy-spot']);
  assert.deepEqual(shown.strengths.map(x => x.code), ['register-ok', 'smooth-overall']);
  assert.deepEqual(shown.rest.map(x => x.code), ['one-type']);
  // Until the audio latency is measured, a timing finding could be false (spec-comping.md).
  assert.deepEqual(shown.heldBack.map(x => x.code), ['dragging']);
});
