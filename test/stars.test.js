// The two per-chord predicates behind the stars (docs/spec-game.md). The run-level formula —
// percentages, timed, movement — comes with the levels; these are what one voicing earns.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChord } from '../src/theory/chords.js';
import { analyzeVoicing } from '../src/theory/analyzer.js';
import { isRight, isClean } from '../src/theory/stars.js';

const on = (symbol, notes) => analyzeVoicing(notes, parseChord(symbol));

test('isRight: the chord that was asked for, nothing missing and nothing foreign', () => {
  assert.equal(isRight(on('Dm7', [62, 65, 69, 72])), true);          // D F A C, all of it
  assert.equal(isRight(on('Dm7', [65, 69, 72, 76])), true);          // rootless A: the root is not required
  assert.equal(isRight(on('Dm7b5', [62, 65, 72])), false);           // the b5 is required and absent
  assert.equal(isRight(on('Cmaj7', [60, 64, 67, 71, 73])), false);   // Db belongs to no Cmaj7
});

test('isRight: an avoid note or a muddy register still counts as right', () => {
  // The 11 on a major 7th is an avoid note, but the chord itself is there and nothing is foreign.
  const avoid = on('Cmaj7', [60, 64, 67, 71, 77]);
  assert.equal(avoid.avoid.length > 0, true, 'the analyzer still reports the avoid note');
  assert.equal(isRight(avoid), true);
  assert.equal(isClean(avoid), false, 'but it is not clean');

  // A third low down is muddy; the notes are right all the same.
  const muddy = on('Cmaj7', [36, 40, 55, 59]);
  assert.equal(muddy.muddy.length > 0, true, 'the analyzer still reports the muddy interval');
  assert.equal(isRight(muddy), true);
  assert.equal(isClean(muddy), false);
});

test('isClean: no warning at all, and a doubling is not a warning', () => {
  assert.equal(isClean(on('Dm7', [65, 69, 72, 76])), true);
  // F A C F: the 3rd doubled two octaves apart, with no root in the bass to excuse it. The
  // analyzer files a doubling as info, not as a reproach, so the voicing stays clean.
  const doubled = on('Dm7', [65, 69, 72, 77]);
  assert.equal(doubled.doublings.length > 0, true, 'the analyzer still reports the doubling');
  assert.equal(isClean(doubled), true);
  // And a root doubled under the voicing is not even reported: the analyzer exempts a root or a
  // 5th in the bass, which is what two hands play all day.
  assert.deepEqual(on('Dm7', [50, 62, 65, 69, 72]).doublings, []);
});

test('isClean implies isRight, so a star never skips the one below it', () => {
  for (const [symbol, notes] of [['Dm7', [65, 69, 72, 76]], ['G7alt', [65, 68, 70, 74]], ['Cmaj7', [60, 64, 67, 71]]]) {
    const analysis = on(symbol, notes);
    if (isClean(analysis)) assert.equal(isRight(analysis), true, `${symbol} is clean but not right`);
  }
});

// ---- The run: how a whole pass turns into stars (docs/spec-game.md) ----------------------

import { scoreRun, movementThreshold, counts, judgeAsk } from '../src/theory/stars.js';

const attempt = (symbol, notes) => ({ symbol, notes, analysis: notes.length ? on(symbol, notes) : null });

// Chained by suggestVoicings, so the numbers are the engine's own, not invented: 0.25 then 1.25
// semitones per voice, 0.75 on average.
const SMOOTH = [attempt('Dm7', [53, 57, 60, 64]), attempt('G7', [53, 57, 59, 64]), attempt('Cmaj7', [52, 55, 59, 62])];
// The same three chords, all clean, with the middle one thrown an octave and a half up.
const JUMPY = [attempt('Dm7', [53, 57, 60, 64]), attempt('G7', [77, 81, 83, 88]), attempt('Cmaj7', [52, 55, 59, 62])];

test('scoreRun: the third star needs timed and the progression threshold, both', () => {
  const smooth = scoreRun({ attempts: SMOOTH, timed: true, movementThreshold: 1.25 });
  assert.equal(smooth.stars, 3);
  assert.equal(smooth.label, 'Smooth');
  assert.equal(smooth.movement, 0.75);

  assert.equal(scoreRun({ attempts: SMOOTH, timed: false, movementThreshold: 1.25 }).stars, 2, 'free play tops out at Clean');
  const jumpy = scoreRun({ attempts: JUMPY, timed: true, movementThreshold: 1.25 });
  assert.equal(jumpy.stars, 2, 'clean but jumpy is two stars');
  assert.equal(jumpy.movement, 24.5);
});

test('scoreRun: the shares are over the chords asked, not over the ones answered', () => {
  const run = [...SMOOTH, attempt('Dm7', []), attempt('G7', [])];     // two asks that never came
  const score = scoreRun({ attempts: run, timed: true, movementThreshold: 1.25 });
  assert.equal(score.total, 5);
  assert.equal(score.clean, 3);
  assert.equal(score.cleanShare, 0.6);
  assert.equal(score.stars, 1, '60% clean is past Right but short of Clean');
});

test('scoreRun: 60% right earns the first star, less earns none', () => {
  const rightNotClean = attempt('Cmaj7', [60, 64, 67, 71, 77]);       // the 11 is an avoid note
  const notRight = attempt('Dm7b5', [62, 65, 72]);                    // the b5 never arrived
  const three = [rightNotClean, rightNotClean, rightNotClean, notRight, notRight];
  assert.equal(scoreRun({ attempts: three }).stars, 1);
  assert.equal(scoreRun({ attempts: three }).label, 'Right');
  const two = [rightNotClean, rightNotClean, notRight, notRight, notRight];
  assert.equal(scoreRun({ attempts: two }).stars, 0);
  assert.equal(scoreRun({ attempts: two }).label, null);
});

test('scoreRun: a repeated chord is not a change, so it cannot flatter the voice leading', () => {
  const held = [...SMOOTH, attempt('Cmaj7', [52, 55, 59, 62])];       // | Cmaj7 | % |
  assert.equal(scoreRun({ attempts: held, timed: true, movementThreshold: 1.25 }).movement, 0.75);
});

test('scoreRun: with no chord change there is nothing to judge, so no third star', () => {
  const one = [attempt('Dm7', [53, 57, 60, 64]), attempt('Dm7', [53, 57, 60, 64])];
  const score = scoreRun({ attempts: one, timed: true, movementThreshold: 1.5 });
  assert.equal(score.movement, null);
  assert.equal(score.stars, 2);
});

test('movementThreshold: measured per progression, 1.5 where the library says nothing else', () => {
  assert.equal(movementThreshold('ii-V-I'), 1.25);
  assert.equal(movementThreshold('turnaround'), 1.75);
  assert.equal(movementThreshold('blues'), 1.5);
  assert.equal(movementThreshold('drill'), 1.5);
  assert.equal(movementThreshold(null), 1.5);
});

// ---- A level that asks for a texture (2026-10-11) ----------------------------------------

test('isRight: a required texture is part of being right, not a separate verdict', () => {
  const shell = on('C7', [60, 64, 70]);                    // root, 3, b7
  assert.equal(shell.voicing.type, 'shell');
  assert.equal(isRight(shell, { texture: 'shell' }), true);
  assert.equal(isClean(shell, { texture: 'shell' }), true);

  const close = on('C7', [60, 64, 67, 70]);                // the right chord, the wrong shape
  assert.equal(close.voicing.type, 'close');
  assert.equal(isRight(close), true, 'with nothing asked for, it is simply right');
  assert.equal(isRight(close, { texture: 'shell' }), false);
  assert.equal(isClean(close, { texture: 'shell' }), false, 'clean still implies right');
});

test('isRight: a wrong bass on a slash chord is not right either', () => {
  const asked = on('C/E', [64, 67, 72]);
  const rootPosition = on('C/E', [60, 64, 67]);
  assert.equal(isRight(asked), true);
  assert.equal(isRight(rootPosition), false);
  assert.equal(isClean(rootPosition), false);
});

test('scoreRun: the texture a level asks for travels with the run', () => {
  const shells = [
    { symbol: 'C7', notes: [60, 64, 70], analysis: on('C7', [60, 64, 70]) },
    { symbol: 'F7', notes: [53, 57, 63], analysis: on('F7', [53, 57, 63]) },
  ];
  assert.equal(scoreRun({ attempts: shells, texture: 'shell' }).right, 2);
  assert.equal(scoreRun({ attempts: shells, texture: 'rootless-A' }).right, 0, 'right chords, wrong shape');
});

test('isRight: a level may ask for one shape or for any of several', () => {
  const formA = on('Dm7', [65, 69, 72, 76]);
  assert.equal(formA.voicing.type, 'rootless-A');
  assert.equal(isRight(formA, { texture: ['rootless-A', 'rootless-B'] }), true);
  assert.equal(isRight(formA, { texture: ['rootless-B', 'drop-2'] }), false);
  assert.equal(isRight(formA, { texture: [] }), true, 'an empty list asks for nothing');
});

// ---- An ask may carry its own texture (2026-10-11, for the daily challenge) ----------------

test('scoreRun: an ask carrying its own texture overrides the run-level one', () => {
  // The daily challenge is a ramp — a triad on the first rung, a shell further up, a quartal at
  // the top — so one texture for the whole run cannot describe it. An ask may carry its own.
  const attempts = [
    { symbol: 'C', notes: [60, 64, 67], analysis: on('C', [60, 64, 67]) },
    { symbol: 'C7', notes: [60, 64, 70], texture: 'shell', analysis: on('C7', [60, 64, 70]) },
    { symbol: 'Dm7', notes: [65, 69, 72, 76], texture: 'shell', analysis: on('Dm7', [65, 69, 72, 76]) },
  ];
  const score = scoreRun({ attempts });
  assert.equal(score.total, 3);
  assert.equal(score.right, 2, 'the shell rung passes, the rootless played on a shell rung does not');

  // A run-level texture still covers the asks that carry none, so levels keep working as they did.
  assert.equal(scoreRun({ attempts, texture: 'shell' }).right, 1, 'now the bare triad fails too');
});

// ---- Which answer a bar keeps (2026-10-13) -----------------------------------------------

test('counts: on the clock a bar keeps its first answer, and a later voicing does not replace it', () => {
  // Edi, 2026-10-13. A timed run shows the next chord, so it is easy to reach for it early; a
  // voicing that starts more than half a beat before the bar line still belongs to the bar it
  // is in, and it used to overwrite the right answer already given there.
  assert.equal(counts({ timed: true, answered: false }), true, 'the first voicing in a bar is its answer');
  assert.equal(counts({ timed: true, answered: true }), false, 'a second one is heard, judged, and not filed');
  // Without the clock a miss stays on the chord until it is played right (Edi, 2026-10-28). The
  // retries are practice; the first answer is the one the stars are counted from.
  assert.equal(counts({ timed: false, answered: false }), true);
  assert.equal(counts({ timed: false, answered: true }), false);
});

test('counts: the score is the one the first answers earn, whatever was played after them', () => {
  // The run a player actually has: three right answers, each followed in its own bar by the next
  // chord grabbed too early. Filing by the rule, the early ones never reach the score.
  const asked = ['Dm7', 'G7', 'Cmaj7'];
  const first = SMOOTH;
  const early = [attempt('Dm7', [53, 57, 59, 64]), attempt('G7', [52, 55, 59, 62]), attempt('Cmaj7', [53, 57, 60, 64])];
  const slots = asked.map(() => null);
  asked.forEach((symbol, slot) => {
    for (const voicing of [first[slot], early[slot]]) {
      if (counts({ timed: true, answered: slots[slot] !== null })) slots[slot] = voicing;
    }
  });
  assert.deepEqual(slots, first);
  assert.equal(scoreRun({ attempts: slots, timed: true, movementThreshold: 1.25 }).stars, 3);
  // What used to happen: the last voicing in each bar won, and the run lost its stars.
  assert.equal(scoreRun({ attempts: early, timed: true, movementThreshold: 1.25 }).stars, 0);
});

test('scoreRun: counts the chords actually played, apart from the ones asked', () => {
  // A pass skipped from end to end asked ten chords and judged none: the result screen must not
  // call that "every chord you played came back clean".
  const skipped = Array.from({ length: 10 }, () => ({ symbol: 'C', notes: [], analysis: null }));
  assert.equal(scoreRun({ attempts: skipped }).played, 0);
  assert.equal(scoreRun({ attempts: skipped }).total, 10);
  assert.equal(scoreRun({ attempts: SMOOTH, timed: true }).played, SMOOTH.length);
});

test('judgeAsk: a triad asked for is judged strictly, a seventh chord as jazz', () => {
  const midi = names => names.map(name => ({ C: 60, E: 64, F: 65, G: 67, A: 69, B: 71, D: 74 })[name]);
  // F A B on F: the B is wrong, and the answer is not right.
  const triad = judgeAsk(midi(['F', 'A', 'B']), 'F');
  assert.deepEqual(triad.wrong, [11]);
  assert.equal(isRight(triad, {}), false);
  // Slash triads and sus4 are triads too; a 9 on a C/E is wrong.
  assert.deepEqual(judgeAsk(midi(['E', 'G', 'C', 'D']), 'C/E').wrong, [2]);
  // A seventh chord keeps its tensions: the 9 on Cmaj7 is colour, not a mistake.
  assert.deepEqual(judgeAsk(midi(['C', 'E', 'B', 'D']), 'Cmaj7').wrong, []);
});
