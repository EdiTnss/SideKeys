// Progress: the best stars per level, the XP earned, and how many times a level paid today.

import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, recordRun, playsToday, loadProgress, saveProgress } from '../src/game/progress.js';

const fakeStorage = (seed = {}) => {
  const data = new Map(Object.entries(seed));
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    get size() { return data.size; },
    entries: () => [...data.entries()],
  };
};

test('recordRun: a level keeps its best stars, never its latest', () => {
  let progress = recordRun(emptyProgress(), { levelId: 'triads-major', stars: 3, xp: 3, today: '2026-10-11' });
  assert.equal(progress.stars['triads-major'], 3);
  progress = recordRun(progress, { levelId: 'triads-major', stars: 1, xp: 0, today: '2026-10-11' });
  assert.equal(progress.stars['triads-major'], 3, 'a worse run does not take the stars away');
});

test('recordRun: XP adds up, and the run that earned none adds none', () => {
  let progress = recordRun(emptyProgress(), { levelId: 'a', stars: 2, xp: 10, today: '2026-10-11' });
  progress = recordRun(progress, { levelId: 'b', stars: 0, xp: 0, today: '2026-10-11' });
  assert.equal(progress.xp, 10);
});

test('playsToday: counts this level today only, and resets when the date turns', () => {
  const start = emptyProgress();
  assert.equal(playsToday(start, 'a', '2026-10-11'), 0);
  const once = recordRun(start, { levelId: 'a', stars: 1, xp: 1, today: '2026-10-11' });
  assert.equal(playsToday(once, 'a', '2026-10-11'), 1);
  assert.equal(playsToday(once, 'b', '2026-10-11'), 0, 'another level has its own count');
  assert.equal(playsToday(once, 'a', '2026-10-12'), 0, 'tomorrow starts again');
  const twice = recordRun(once, { levelId: 'a', stars: 1, xp: 1, today: '2026-10-11' });
  assert.equal(playsToday(twice, 'a', '2026-10-11'), 2);
});

test('recordRun never mutates the progress it was given', () => {
  const before = emptyProgress();
  recordRun(before, { levelId: 'a', stars: 3, xp: 5, today: '2026-10-11' });
  assert.deepEqual(before, emptyProgress());
});

test('loadProgress: a round trip, and anything unreadable starts over instead of throwing', () => {
  const storage = fakeStorage();
  const progress = recordRun(emptyProgress(), { levelId: 'a', stars: 2, xp: 7, today: '2026-10-11' });
  saveProgress(progress, storage);
  assert.deepEqual(loadProgress(storage), progress);

  assert.deepEqual(loadProgress(fakeStorage()), emptyProgress(), 'nothing saved yet');
  assert.deepEqual(loadProgress(fakeStorage({ 'sidekeys.progress': 'not json' })), emptyProgress());
  assert.deepEqual(loadProgress(fakeStorage({ 'sidekeys.progress': '{"stars":"nope"}' })), emptyProgress());
  assert.deepEqual(loadProgress(undefined), emptyProgress(), 'no storage at all is not a crash');
});

// ---- The day: streak, the minutes goal, and what comes back tomorrow (2026-10-11) --------

import { streak, secondsOn, outcomesFor, dueReviews, nextLevel } from '../src/game/progress.js';
import { parseChord } from '../src/theory/chords.js';
import { analyzeVoicing } from '../src/theory/analyzer.js';

const day = (progress, date, seconds = 300) =>
  recordRun(progress, { levelId: 'a', stars: 1, xp: 1, today: date, seconds });

test('streak: consecutive days up to today, and yesterday still counts', () => {
  let p = emptyProgress();
  assert.equal(streak(p, '2026-10-11'), 0);
  p = day(p, '2026-10-09');
  p = day(p, '2026-10-10');
  p = day(p, '2026-10-11');
  assert.equal(streak(p, '2026-10-11'), 3);
  // Nothing played yet today: the streak stands until the day is over.
  assert.equal(streak(p, '2026-10-12'), 3);
  assert.equal(streak(p, '2026-10-13'), 0, 'a day skipped ends it');
});

test('streak: a gap breaks it, and only the run up to today counts', () => {
  let p = emptyProgress();
  p = day(p, '2026-10-01');
  p = day(p, '2026-10-02');
  p = day(p, '2026-10-10');
  p = day(p, '2026-10-11');
  assert.equal(streak(p, '2026-10-11'), 2);
});

test('secondsOn: the minutes goal counts what was played that day, runs added up', () => {
  let p = day(emptyProgress(), '2026-10-11', 240);
  p = day(p, '2026-10-11', 180);
  assert.equal(secondsOn(p, '2026-10-11'), 420);
  assert.equal(secondsOn(p, '2026-10-12'), 0);
});

test('outcomesFor: a quality missed once is missed, however often it was clean', () => {
  const on = (symbol, notes) => ({ symbol, notes, analysis: analyzeVoicing(notes, parseChord(symbol)) });
  const run = [
    on('Cm7', [60, 63, 67, 70]),          // clean
    on('Fm7', [65, 68, 72, 75]),          // clean
    on('Gm7', [67, 71, 74, 77]),          // G B D F: a major third, so not a m7 at all
    on('Cmaj7', [60, 64, 67, 71]),        // clean
  ];
  const { missed, cleared } = outcomesFor(run);
  assert.deepEqual(missed, ['m7']);
  assert.deepEqual(cleared, ['maj7'], 'm7 was missed once, so it does not count as cleared');
});

test('a missed quality comes back tomorrow and retires after three clean answers', () => {
  let p = recordRun(emptyProgress(), { levelId: 'a', stars: 1, xp: 1, today: '2026-10-11', missed: ['m7b5'] });
  assert.deepEqual(dueReviews(p, '2026-10-11'), [], 'not the same day: it comes back tomorrow');
  assert.deepEqual(dueReviews(p, '2026-10-12').map(r => r.quality), ['m7b5']);

  for (const date of ['2026-10-12', '2026-10-13']) {
    p = recordRun(p, { levelId: 'a', stars: 2, xp: 1, today: date, cleared: ['m7b5'] });
    assert.deepEqual(dueReviews(p, '2026-10-14').map(r => r.quality), ['m7b5'], 'two is not three');
  }
  p = recordRun(p, { levelId: 'a', stars: 2, xp: 1, today: '2026-10-14', cleared: ['m7b5'] });
  assert.deepEqual(dueReviews(p, '2026-10-15'), [], 'three clean answers and it is gone');
});

test('a miss resets the count, so three in a row is what retires it', () => {
  let p = recordRun(emptyProgress(), { levelId: 'a', stars: 1, xp: 1, today: '2026-10-11', missed: ['7'] });
  p = recordRun(p, { levelId: 'a', stars: 1, xp: 1, today: '2026-10-12', cleared: ['7'] });
  p = recordRun(p, { levelId: 'a', stars: 1, xp: 1, today: '2026-10-13', cleared: ['7'] });
  p = recordRun(p, { levelId: 'a', stars: 1, xp: 1, today: '2026-10-14', missed: ['7'] });
  assert.equal(p.review['7'].hits, 0);
  assert.equal(p.review['7'].misses, 2);
  assert.deepEqual(dueReviews(p, '2026-10-15').map(r => r.quality), ['7']);
});

test('nextLevel: the first open level that is not yet three stars', () => {
  const first = nextLevel({});
  assert.equal(first?.level.id, 'triads-major');
  const after = nextLevel({ 'triads-major': 3 });
  assert.equal(after?.level.id, 'triads-minor', 'a finished level is behind you');
  const partial = nextLevel({ 'triads-major': 2 });
  assert.equal(partial?.level.id, 'triads-major', 'two stars still has one to get');
});
