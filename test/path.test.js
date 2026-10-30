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

test('a level cut short by its count still reaches every key it names, every quality evenly', () => {
  // The cut used to fall on a list built key by key, so "All four, twelve keys" asked for C, F,
  // Bb and Eb only, and no twelve-key level ever reached G, D, A, E or B (review of 2026-10-30,
  // #1). The qualities now turn over the keys: one round of the keys, then the next.
  const short = PATH.flatMap(unit => unit.levels)
    .filter(level => ['chords', 'slash'].includes(level.asks.kind))
    .filter(level => level.asks.count
      && level.asks.count < level.asks.keys.length * (level.asks.qualities ?? level.asks.shapes).length);
  assert.ok(short.length >= 8, `only ${short.length} levels are cut short`);
  for (const level of [...short, reviewLevel(['m7', '7', 'maj7'])]) {
    const asks = asksFor(level).map(ask => parseChord(ask.symbol));
    const roots = new Set(asks.map(chord => chord.rootPc));
    const keys = Math.min(level.asks.keys.length, level.asks.count);
    assert.equal(roots.size, keys, `${level.id} reaches ${roots.size} of ${keys} keys`);
    // Evenly: no quality (or inversion) asked for more than once over any other.
    const kinds = (level.asks.qualities ?? level.asks.shapes).length;
    const tally = new Map();
    for (const chord of asks) {
      const kind = `${chord.quality}/${chord.bass === null ? '' : (chord.bassPc - chord.rootPc + 12) % 12}`;
      tally.set(kind, (tally.get(kind) ?? 0) + 1);
    }
    assert.equal(tally.size, kinds, `${level.id} asks for ${tally.size} of ${kinds} kinds`);
    const counts = [...tally.values()];
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${level.id}: ${counts.join(', ')}`);
    // And never the same root twice running, which is what made the old order a one-note drill.
    asks.forEach((chord, at) => {
      if (at) assert.notEqual(chord.rootPc, asks[at - 1].rootPc, `${level.id}: ${chord.symbol} after ${asks[at - 1].symbol}`);
    });
  }
});

test('asksFor with a random draw: the same chords in another order, never the same root twice running', () => {
  // Review of 2026-10-30, #12 (Edi: "a new order every pass"). A fixed order is learnt by the
  // second pass, and then the chord on screen is remembered instead of read.
  let state = 7;
  const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const sorted = list => [...list].sort();
  const rootsOf = symbols => symbols.map(symbol => parseChord(symbol).rootPc);
  for (const level of [...PATH.flatMap(unit => unit.levels), reviewLevel(['m7', '7', 'maj7'])]) {
    const canonical = asksFor(level).map(ask => ask.symbol);
    for (let run = 0; run < 5; run += 1) {
      const drawn = asksFor(level, { random });
      assert.deepEqual(sorted(drawn.map(ask => ask.symbol)), sorted(canonical), `${level.id}: the same chords`);
      assert.ok(drawn.every(ask => ask.texture === (level.texture ?? null)), `${level.id}: the shape travels with it`);
      const roots = rootsOf(drawn.map(ask => ask.symbol));
      roots.forEach((root, at) => {
        if (at) assert.notEqual(root, roots[at - 1], `${level.id}: ${drawn[at].symbol} after ${drawn[at - 1].symbol}`);
      });
      // A progression moves as a whole: only the keys change places.
      if (level.asks.kind === 'progression') {
        const blocks = list => Array.from({ length: list.length / 3 }, (_, at) => list.slice(at * 3, at * 3 + 3).join(' '));
        assert.deepEqual(sorted(blocks(drawn.map(ask => ask.symbol))), sorted(blocks(canonical)), level.id);
      }
    }
  }
  // And the order does change from one pass to the next.
  const triads = levelById('triads-major').level;
  const orders = new Set(Array.from({ length: 20 }, () => asksFor(triads, { random }).map(ask => ask.symbol).join(' ')));
  assert.ok(orders.size > 10, `only ${orders.size} orders in 20 passes`);
  const firsts = new Set(Array.from({ length: 20 }, () => asksFor(triads, { random })[0].symbol));
  assert.ok(firsts.size > 1, 'it does not always open on C');
});

test('reviewLevel: the queue turned into something playable, in every key', () => {
  const level = reviewLevel(['m7b5', '7']);
  const asks = asksFor(level).map(ask => ask.symbol);
  assert.equal(asks.length, 12, 'long enough to be a session, short enough to finish');
  // Rewritten with Edi's yes to #1 of the review of 2026-10-30: it read Cm7b5, C7, Fm7b5, F7,
  // and the twelve chords stopped at Db. The qualities now turn over all twelve keys.
  assert.deepEqual(asks.slice(0, 4), ['Cm7b5', 'F7', 'Bbm7b5', 'Eb7']);
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

test('reviewLevel is called Review: Training is the name of the free practice now', () => {
  assert.equal(reviewLevel(['7']).name, 'Review');
});

test('the Quartal unit asks for dominants, now that there is a quartal voicing to answer with', () => {
  const quartal = PATH.find(unit => unit.id === 'quartal');
  assert.deepEqual(quartal.levels.map(level => level.id), ['quartal-minor', 'quartal-dom', 'quartal-boss']);
  const dominants = asksFor(levelById('quartal-dom').level).map(ask => ask.symbol);
  assert.equal(dominants.length, 12);
  assert.ok(dominants.includes('G7') && dominants.every(symbol => symbol.endsWith('7')));
  assert.ok(asksFor(levelById('quartal-boss').level).some(ask => /^[A-G][#b]?7$/.test(ask.symbol)), 'and the last level mixes them in');
});

test('a unit starts in the six keys tunes are most often in', () => {
  // Edi, 2026-10-13. It was C F G D A E, the sharp side, which kept B flat and E flat out of
  // every unit until its last level.
  const six = ['C', 'F', 'Bb', 'Eb', 'G', 'D'];
  for (const unit of PATH) {
    for (const level of unit.levels) {
      const keys = level.asks.keys;
      if (keys.length === 6) assert.deepEqual(keys, six, level.id);
      assert.ok(!(keys.length < 12 && (keys.includes('A') || keys.includes('E'))), `${level.id} still starts on the sharp side`);
    }
  }
  assert.deepEqual(asksFor(levelById('triads-minor').level).map(ask => ask.symbol), ['Cm', 'Fm', 'Bbm', 'Ebm', 'Gm', 'Dm']);
  assert.deepEqual(asksFor(levelById('inv-major-first').level).map(ask => ask.symbol), ['C/E', 'F/A', 'Bb/D', 'Eb/G', 'G/B', 'D/F#']);
});
