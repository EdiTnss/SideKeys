// The path: what each level asks for, and what opens what.

import test from 'node:test';
import assert from 'node:assert/strict';
import { PATH, asksFor, pathState, levelById, levelAfter, reviewLevel } from '../src/game/path.js';
import { parseChord } from '../src/theory/chords.js';
import { plainName } from '../src/theory/notes.js';

test('every ask on the path parses as a chord the analyzer can judge', () => {
  for (const unit of PATH) {
    for (const level of unit.levels) {
      const asks = asksFor(level);
      assert.ok(asks.length >= 6, `${level.id} asks for ${asks.length} chords`);
      for (const { symbol } of asks) assert.doesNotThrow(() => parseChord(symbol), `${level.id}: ${symbol}`);
    }
  }
});

test('asksFor: qualities across keys, and a progression straight from the library', () => {
  const symbolsOf = level => asksFor(level).map(ask => ask.symbol);
  assert.deepEqual(
    symbolsOf({ asks: { kind: 'chords', qualities: ['', 'm'], keys: ['C', 'F'] } }),
    ['C', 'Cm', 'F', 'Fm'],
  );
  assert.deepEqual(
    symbolsOf({ asks: { kind: 'progression', progressionId: 'ii-V-I', keys: ['C'] } }),
    ['Dm7', 'G7', 'Cmaj7'],   // the library's '| Cmaj7 | % |' repeat is asked once
  );
  // The shape travels with the ask, so no screen has to look the level up a second time.
  assert.deepEqual(
    asksFor({ texture: 'shell', asks: { kind: 'chords', qualities: ['maj7'], keys: ['C'] } }),
    [{ symbol: 'Cmaj7', texture: 'shell' }],
  );
});

test('pathState: every unit is open, and inside one a level waits for a star on the level before', () => {
  const fresh = pathState({});
  for (const entry of fresh) {
    assert.equal(entry.levels[0].unlocked, true, `${entry.unit.id} is open from the start`);
    assert.equal(entry.levels[1].unlocked, false, 'the second level waits for the first');
  }
  assert.deepEqual(fresh.map(entry => entry.number), PATH.map((_, at) => at + 1), 'numbered in path order');

  const firstCleared = pathState({ [PATH[0].levels[0].id]: 1 });
  assert.equal(firstCleared[0].levels[1].unlocked, true);
  assert.equal(firstCleared[0].levels[2].unlocked, false, 'one star opens one level, not the unit');
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
      for (const { symbol } of asksFor(level)) {
        const found = suggestVoicings(parseChord(symbol)).some(candidate => wanted.includes(candidate.type));
        assert.ok(found, `${level.id}: no ${wanted.join(' or ')} voicing for ${symbol}`);
      }
    }
  }
});

test('a slash level asks for a bass the analyzer will check, spelled from the chord', () => {
  const inversions = PATH.find(unit => unit.id === 'inversions');
  const asks = asksFor(inversions.levels[0]).map(ask => ask.symbol);
  assert.ok(asks.includes('C/E'), `first inversion of C should be C/E, got ${asks[0]}`);
  for (const symbol of asks) {
    const chord = parseChord(symbol);
    assert.notEqual(chord.bassPc, null, `${symbol} carries no bass`);
    // Root position must fail the level, or the unit would be teaching nothing.
    const root = [60 + chord.rootPc, 60 + chord.rootPc + 4, 60 + chord.rootPc + 7];
    assert.equal(isRight(analyzeVoicing(root, chord)), false, `${symbol} accepted root position`);
  }
});

test('no level runs past 36 chords, and none is dressed up as a boss', () => {
  for (const unit of PATH) for (const level of unit.levels) {
    assert.ok(asksFor(level).length <= 36, `${level.id} asks for ${asksFor(level).length} chords`);
    assert.equal('boss' in level, false, `${level.id} still carries the flag`);
    assert.ok(!/boss/i.test(level.name), `${level.id} is still named "${level.name}"`);
  }
});

test('reviewLevel: the queue turned into something playable, in every key', () => {
  const level = reviewLevel(['m7b5', '7']);
  const asks = asksFor(level).map(ask => ask.symbol);
  assert.equal(asks.length, 12, 'long enough to be a session, short enough to finish');
  assert.deepEqual(asks.slice(0, 4), ['Cm7b5', 'C7', 'Fm7b5', 'F7']);
  for (const symbol of asks) assert.doesNotThrow(() => parseChord(symbol), symbol);
  assert.equal(asksFor(reviewLevel([])).length, 0, 'nothing due is nothing to play');
});

test('levelAfter: the next level, across the end of a unit, and null off the path', () => {
  const [first, second] = PATH[0].levels;
  assert.equal(levelAfter(first.id).level.id, second.id);
  assert.equal(levelAfter(first.id).unit.id, PATH[0].id);
  // The last level of a unit hands over to the first level of the next one.
  const crossing = levelAfter(PATH[0].levels.at(-1).id);
  assert.equal(crossing.unit.id, PATH[1].id);
  assert.equal(crossing.level.id, PATH[1].levels[0].id);
  assert.equal(levelAfter(PATH.at(-1).levels.at(-1).id), null, 'nothing follows the last level');
  assert.equal(levelAfter('review'), null, 'the review is not on the path');
});

/** True when a chart would never write this symbol: an awkward root or bass, or Dbm / Gbm. */
const awkward = symbol => {
  const chord = parseChord(symbol);
  const minorThird = chord.chordTones.includes((chord.rootPc + 3) % 12);
  return [chord.root, chord.bass].some(name => name && plainName(name) !== name)
    || (minorThird && ['Db', 'Gb'].includes(chord.root));
};

test('the path asks for chords the way a chart writes them', () => {
  for (const unit of PATH) for (const level of unit.levels) {
    for (const { symbol } of asksFor(level)) assert.ok(!awkward(symbol), `${level.id}: ${symbol}`);
  }
  // The three inversions that used to come out as Abm/Cb, Dbm/Fb and Gbm/Bbb.
  const minorFirst = { asks: { kind: 'slash', shapes: [{ quality: 'm', degree: 'b3' }], keys: ['Ab', 'Db', 'Gb'] } };
  assert.deepEqual(asksFor(minorFirst).map(ask => ask.symbol), ['Abm/B', 'C#m/E', 'F#m/A']);
  // The same rule without a slash, and in the review, which is built from the same keys.
  const minors = { asks: { kind: 'chords', qualities: ['m', 'maj7'], keys: ['Db', 'Gb'] } };
  assert.deepEqual(asksFor(minors).map(ask => ask.symbol), ['C#m', 'Dbmaj7', 'F#m', 'Gbmaj7']);
  for (const { symbol } of asksFor(reviewLevel(['m7', 'm7b5', 'dim7']))) assert.ok(!awkward(symbol), symbol);
});
