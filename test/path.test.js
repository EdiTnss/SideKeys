// The path: what each level asks for, and what opens what.

import test from 'node:test';
import assert from 'node:assert/strict';
import { PATH, asksFor, pathState, levelById, reviewLevel } from '../src/game/path.js';
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

// ---- Every level has to be answerable, not just parseable (2026-10-11) -------------------

import { suggestVoicings } from '../src/theory/voicings.js';
import { isRight } from '../src/theory/stars.js';
import { analyzeVoicing } from '../src/theory/analyzer.js';

test('a level that demands a texture can be answered on every chord it asks for', () => {
  // The oracle is the engine's own generator, which only offers warning-free voicings. It is a
  // conservative oracle: a texture a human could play but the generator never builds would keep
  // a level out of the path. Better that than a level nobody can clear.
  for (const unit of PATH) {
    for (const level of unit.levels) {
      if (!level.texture) continue;
      const wanted = [].concat(level.texture);
      for (const symbol of asksFor(level)) {
        const found = suggestVoicings(parseChord(symbol)).some(candidate => wanted.includes(candidate.type));
        assert.ok(found, `${level.id}: no ${wanted.join(' or ')} voicing for ${symbol}`);
      }
    }
  }
});

test('a slash level asks for a bass the analyzer will check, spelled from the chord', () => {
  const inversions = PATH.find(unit => unit.id === 'inversions');
  const asks = asksFor(inversions.levels[0]);
  assert.ok(asks.includes('C/E'), `first inversion of C should be C/E, got ${asks[0]}`);
  for (const symbol of asks) {
    const chord = parseChord(symbol);
    assert.notEqual(chord.bassPc, null, `${symbol} carries no bass`);
    // Root position must fail the level, or the unit would be teaching nothing.
    const root = [60 + chord.rootPc, 60 + chord.rootPc + 4, 60 + chord.rootPc + 7];
    assert.equal(isRight(analyzeVoicing(root, chord)), false, `${symbol} accepted root position`);
  }
});

test('no level runs longer than a boss, and a boss is the last of its unit', () => {
  for (const unit of PATH) {
    unit.levels.forEach((level, at) => {
      const asks = asksFor(level);
      assert.ok(asks.length <= 36, `${level.id} asks for ${asks.length} chords`);
      assert.equal(Boolean(level.boss), at === unit.levels.length - 1, `${level.id}: boss in the wrong place`);
    });
  }
});

test('reviewLevel: the queue turned into something playable, in every key', () => {
  const level = reviewLevel(['m7b5', '7']);
  const asks = asksFor(level);
  assert.equal(asks.length, 12, 'long enough to be a session, short enough to finish');
  assert.deepEqual(asks.slice(0, 4), ['Cm7b5', 'C7', 'Fm7b5', 'F7']);
  for (const symbol of asks) assert.doesNotThrow(() => parseChord(symbol), symbol);
  assert.equal(asksFor(reviewLevel([])).length, 0, 'nothing due is nothing to play');
});
