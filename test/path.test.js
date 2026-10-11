// The path: what each level asks for, and what opens what.

import test from 'node:test';
import assert from 'node:assert/strict';
import { PATH, asksFor, pathState, levelById } from '../src/game/path.js';
import { parseChord } from '../src/theory/chords.js';

test('every ask on the path parses as a chord the analyzer can judge', () => {
  for (const unit of PATH) {
    for (const level of unit.levels) {
      const asks = asksFor(level);
      assert.ok(asks.length >= 6, `${level.id} asks for ${asks.length} chords`);
      for (const symbol of asks) assert.doesNotThrow(() => parseChord(symbol), `${level.id}: ${symbol}`);
    }
  }
});

test('asksFor: qualities across keys, and a progression straight from the library', () => {
  assert.deepEqual(
    asksFor({ asks: { kind: 'chords', qualities: ['', 'm'], keys: ['C', 'F'] } }),
    ['C', 'Cm', 'F', 'Fm'],
  );
  assert.deepEqual(
    asksFor({ asks: { kind: 'progression', progressionId: 'ii-V-I', keys: ['C'] } }),
    ['Dm7', 'G7', 'Cmaj7'],   // the library's '| Cmaj7 | % |' repeat is asked once
  );
});

test('pathState: the first unit is open, the rest wait for the boss before them', () => {
  const fresh = pathState({});
  assert.equal(fresh[0].unlocked, true);
  assert.equal(fresh[1].unlocked, false);
  assert.equal(fresh[0].levels[0].unlocked, true);
  assert.equal(fresh[0].levels[1].unlocked, false, 'the second level waits for the first');

  const firstCleared = pathState({ [PATH[0].levels[0].id]: 1 });
  assert.equal(firstCleared[0].levels[1].unlocked, true);
  assert.equal(firstCleared[1].unlocked, false, 'one level is not the boss');

  const boss = PATH[0].levels.at(-1);
  assert.equal(boss.boss, true, 'every unit ends on a boss');
  const bossCleared = pathState({ [boss.id]: 1 });
  assert.equal(bossCleared[1].unlocked, true, 'the boss opens the next unit');
  assert.equal(bossCleared[1].levels[0].unlocked, true);
});

test('pathState: stars are carried through, per level and summed per unit', () => {
  const [first] = PATH;
  const stars = { [first.levels[0].id]: 3, [first.levels[1].id]: 2 };
  const state = pathState(stars);
  assert.equal(state[0].levels[0].stars, 3);
  assert.equal(state[0].levels[1].stars, 2);
  assert.equal(state[0].stars, 5);
  assert.equal(state[0].maxStars, first.levels.length * 3);
});

test('levelById: finds a level and the unit it belongs to, or nothing', () => {
  const found = levelById(PATH[1].levels[0].id);
  assert.equal(found?.unit.id, PATH[1].id);
  assert.equal(found?.level.id, PATH[1].levels[0].id);
  assert.equal(levelById('no-such-level'), null);
});
