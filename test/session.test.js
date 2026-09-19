import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { parseGrid } from '../src/theory/progressions.js';
import { createSession, snapshotTarget, ANTICIPATION_BEATS } from '../src/ui/session.js';

const v = names => names.split(' ').map(nameToMidi);
const grid = () => parseGrid('| Dm7 G7 | Cmaj7 | % |');

test('slots are flattened from the bars, with their chords parsed once', () => {
  const session = createSession(grid());
  assert.deepEqual(session.slots.map(s => [s.bar, s.beat, s.symbol]), [[1, 1, 'Dm7'], [1, 3, 'G7'], [2, 1, 'Cmaj7'], [3, 1, 'Cmaj7']]);
  assert.equal(session.slots[1].chord.quality, '7');
});

test('locate: a (bar, beat) position maps to the chord active there, wrapping when looping', () => {
  const session = createSession(grid(), { loop: true });
  assert.deepEqual(session.locate(1, 1), { index: 0, chorus: 1 });
  assert.deepEqual(session.locate(1, 2.5), { index: 0, chorus: 1 });
  assert.deepEqual(session.locate(1, 3), { index: 1, chorus: 1 });
  assert.deepEqual(session.locate(1, 4.75), { index: 1, chorus: 1 });
  assert.deepEqual(session.locate(2, 1), { index: 2, chorus: 1 });
  assert.deepEqual(session.locate(3, 4), { index: 3, chorus: 1 });
  assert.deepEqual(session.locate(4, 1), { index: 0, chorus: 2 });
  assert.deepEqual(session.locate(7, 3), { index: 1, chorus: 3 });
  assert.equal(session.locate(0, 1), null);                  // count-in
  assert.equal(session.locate(-1, 2), null);
  assert.equal(createSession(grid(), { loop: false }).locate(4, 1), null);
});

test('advance: the free-mode cursor walks the slots and wraps or finishes', () => {
  const looped = createSession(grid(), { loop: true });
  assert.equal(looped.current, 0);
  assert.deepEqual([looped.advance(), looped.advance(), looped.advance(), looped.advance()], [1, 2, 3, 0]);
  assert.equal(looped.finished, false);

  const once = createSession(grid(), { loop: false });
  assert.deepEqual([once.advance(), once.advance(), once.advance(), once.advance()], [1, 2, 3, null]);
  assert.equal(once.finished, true);
  assert.equal(once.current, 3);
});

test('record: analyses against the slot chord and compares with what was played before', () => {
  const session = createSession(grid());
  const first = session.record(0, v('F3 A3 C4 E4'));
  assert.equal(first.analysis.voicing.type, 'rootless-A');
  assert.equal(first.comparison, null);
  const second = session.record(1, v('F3 A3 B3 E4'));      // 7-9-3-13 from the bottom: the B form
  assert.equal(second.analysis.voicing.type, 'rootless-B');
  assert.equal(second.comparison.movement, 1);
  assert.equal(session.results.get(1).analysis.voicing.type, 'rootless-B');
  session.record(1, v('F3 B3 E4 A4'));                       // played again: latest result wins
  assert.equal(session.results.get(1).notes.length, 4);
  assert.equal(session.history.length, 3);
});

test('summary: the voice-leading score over the playing order, then a fresh chorus', () => {
  const session = createSession(grid());
  session.record(0, v('F3 A3 C4 E4'));
  session.record(1, v('F3 A3 B3 E4'));
  session.record(2, v('E3 G3 B3 D4'));
  const summary = session.summary();
  assert.equal(summary.steps.length, 2);
  assert.deepEqual(summary.steps.map(s => [s.from, s.to]), [[0, 1], [1, 2]]);
  assert.equal(summary.score.movement, 1 + 5);
  assert.equal(summary.score.commonTones, 3 + 1);
  assert.equal(summary.score.rating, 'smooth');
  assert.equal(summary.played, 3);
  assert.equal(summary.total, 4);

  session.newChorus();
  assert.equal(session.history.length, 0);
  assert.equal(session.results.size, 0);
  assert.equal(session.summary().score.rating, null);
});

test('snapshotTarget: which chord a captured voicing answers, the one rule the app and the replay share', () => {
  const session = createSession(grid(), { loop: false });
  assert.deepEqual(snapshotTarget({ mode: 'drill', symbol: 'Cmaj7' }), { symbol: 'Cmaj7', slot: null });
  assert.equal(snapshotTarget({ mode: 'drill', symbol: null }), null);         // no quality selected, no chord on screen
  assert.equal(snapshotTarget({ mode: 'reharm', symbol: 'Cmaj7', session }), null);
  assert.equal(snapshotTarget({ mode: 'progression', session: null, started: true }), null);

  // Free: the slot under the cursor, once the pass has started.
  assert.equal(snapshotTarget({ mode: 'progression', session, started: false, current: 1 }), null);
  assert.deepEqual(snapshotTarget({ mode: 'progression', session, started: true, current: 1 }), { symbol: 'G7', slot: 1 });
  // Timed: the slot where the voicing started, whatever is on screen by the time it is captured.
  const timed = position => snapshotTarget({ mode: 'progression', session, started: true, timed: true, position, current: 0 });
  assert.deepEqual(timed({ bar: 1, beat: 3.2 }), { symbol: 'G7', slot: 1 });
  assert.deepEqual(timed({ bar: 2, beat: 1 }), { symbol: 'Cmaj7', slot: 2 });
  assert.equal(timed({ bar: 0, beat: 3 }), null);                                // count-in
  assert.equal(timed({ bar: 4, beat: 1 }), null);                                // past the end, no loop
});

test('snapshotTarget, timed: from the "and" of the beat before a change, a voicing counts for the next chord (Edi\'s rule)', () => {
  assert.equal(ANTICIPATION_BEATS, 0.5);
  const session = createSession(grid(), { loop: false });                        // | Dm7 G7 | Cmaj7 | % |
  const timed = (position, on = session) => snapshotTarget({ mode: 'progression', session: on, started: true, timed: true, position })?.symbol ?? null;
  assert.equal(timed({ bar: 1, beat: 2.49 }), 'Dm7');
  assert.equal(timed({ bar: 1, beat: 2.5 }), 'G7');                              // the "and" of 2, before G7 on 3
  assert.equal(timed({ bar: 1, beat: 4.49 }), 'G7');
  assert.equal(timed({ bar: 1, beat: 4.5 }), 'Cmaj7');                           // the "and" of 4
  assert.equal(timed({ bar: 0, beat: 4.6 }), 'Dm7');                             // the first chord, pushed from the count-in
  assert.equal(timed({ bar: 3, beat: 4.8 }), 'Cmaj7');                           // nothing follows without a loop: the last chord keeps it
  assert.equal(timed({ bar: 3, beat: 4.8 }, createSession(grid(), { loop: true })), 'Dm7');   // looped: the next chorus
  const waltz = createSession(parseGrid('| Dm7 | G7 |', { timeSignature: [3, 4] }), { loop: false });
  assert.equal(timed({ bar: 1, beat: 3.4 }, waltz), 'Dm7');
  assert.equal(timed({ bar: 1, beat: 3.5 }, waltz), 'G7');                       // in 3/4, the "and" of 3
});
