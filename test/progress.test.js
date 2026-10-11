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
