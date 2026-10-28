// Training: free practice outside the path — what can be chosen, and the run built from it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChord, chartSymbol } from '../src/theory/chords.js';
import { plainName } from '../src/theory/notes.js';
import { getProgression, PROGRESSIONS } from '../src/theory/progressions.js';
import {
  QUALITY_GROUPS, KEYS, SHAPES, DEFAULT_TRAINING, DRILL_BARS,
  drillPool, shapeQualities, drawDrill, progressionFor, trainingPlan, progressionShapes,
  sanitizeTraining, loadTraining, saveTraining,
} from '../src/game/training.js';

const QUALITIES = QUALITY_GROUPS.flatMap(group => group.qualities);
const symbols = asks => asks.map(ask => ask.symbol);
const barsOf = progression => progression.bars.map(bar => bar.chords.map(chord => chord.symbol).join(' '));

/** A generator that walks a fixed list, so a draw can be read off the test. */
const sequence = values => {
  let at = 0;
  return () => values[at++ % values.length];
};

const fakeStorage = (seed = {}) => {
  const data = new Map(Object.entries(seed));
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
};

// ---- What is on offer ------------------------------------------------------------------------

test('every chord on offer is one the analyzer can judge, in every key', () => {
  assert.equal(KEYS.length, 12);
  assert.ok(QUALITIES.includes('') && QUALITIES.includes('m7b5') && QUALITIES.includes('7alt'));
  for (const key of KEYS) {
    for (const quality of QUALITIES) {
      assert.doesNotThrow(() => parseChord(chartSymbol(key, quality)), `${key}${quality}`);
    }
  }
  assert.equal(new Set(QUALITIES).size, QUALITIES.length, 'no quality is listed twice');
  assert.equal(SHAPES[0].texture, null, 'the first choice demands no shape');
});

// ---- The drill -------------------------------------------------------------------------------

test('drillPool: every chosen quality in every chosen key, spelled the way a chart spells it', () => {
  const pool = drillPool({ qualities: ['maj7', 'm7'], keys: ['C', 'Db'], shape: 'any' });
  assert.deepEqual(symbols(pool), ['Cmaj7', 'Cm7', 'Dbmaj7', 'C#m7']);
  assert.ok(pool.every(ask => ask.texture === null));
  // The shape travels with every ask, as it does on the path.
  const shells = drillPool({ qualities: ['maj7'], keys: ['C'], shape: 'shell' });
  assert.deepEqual(shells, [{ symbol: 'Cmaj7', texture: 'shell' }]);
  const either = drillPool({ qualities: ['m7'], keys: ['C'], shape: 'rootless' });
  assert.deepEqual(either[0].texture, ['rootless-A', 'rootless-B']);
});

test('drillPool: a chord that cannot be played in the shape asked for is not asked for', () => {
  // The engine builds no quartal voicing for a half-diminished and no shell for one either, so
  // asking for one would be a chord nobody can get right (docs/spec-game.md).
  assert.deepEqual(drillPool({ qualities: ['m7b5'], keys: KEYS, shape: 'quartal' }), []);
  assert.deepEqual(drillPool({ qualities: ['m7b5'], keys: KEYS, shape: 'shell' }), []);
  const mixed = drillPool({ qualities: ['m7', 'm7b5'], keys: ['C'], shape: 'quartal' });
  assert.deepEqual(symbols(mixed), ['Cm7'], 'the playable one stays');
  // A dominant does have one, since 2026-10-12: seventh, third, thirteenth, ninth.
  assert.equal(drillPool({ qualities: ['7'], keys: KEYS, shape: 'quartal' }).length, 12);
  // Nothing chosen is nothing to play.
  assert.deepEqual(drillPool({ qualities: [], keys: KEYS, shape: 'any' }), []);
  assert.deepEqual(drillPool({ qualities: ['maj7'], keys: [], shape: 'any' }), []);
});

test('shapeQualities: which chords a shape exists for, so the screen can grey out the rest', () => {
  assert.deepEqual(shapeQualities('any'), QUALITIES);
  const quartal = shapeQualities('quartal');
  assert.ok(quartal.includes('m7') && quartal.includes('maj7') && quartal.includes('7'));
  assert.ok(!quartal.includes('m7b5'), 'no quartal half-diminished');
  // A triad needs its root, third and fifth, and no stack of fourths holds all three.
  assert.ok(!quartal.includes('') && !quartal.includes('m'), 'no quartal triad');
  const shell = shapeQualities('shell');
  assert.ok(shell.includes('7') && !shell.includes('m7b5') && !shell.includes('dim7'));
  assert.ok(!shell.includes(''), 'a triad has no seventh to make a shell from');
});

test('drawDrill: as many chords as asked for, and never the same one twice running', () => {
  const pool = drillPool({ qualities: ['maj7', 'm7', '7'], keys: KEYS, shape: 'any' });
  const drawn = drawDrill(pool, 200);
  assert.equal(drawn.length, 200);
  drawn.forEach((ask, at) => {
    assert.ok(pool.includes(ask));
    if (at) assert.notEqual(ask.symbol, drawn[at - 1].symbol, `repeat at ${at}`);
  });
  // It loops, so the last chord must not be the first one either.
  assert.notEqual(drawn.at(-1).symbol, drawn[0].symbol);
  // A pool of one has nothing else to offer, and a pool of none has nothing at all.
  assert.deepEqual(symbols(drawDrill([{ symbol: 'C', texture: null }], 3)), ['C', 'C', 'C']);
  assert.deepEqual(drawDrill([], 3), []);
});

test('drawDrill: the same random numbers give the same chords', () => {
  const pool = drillPool({ qualities: ['maj7', 'm7'], keys: ['C', 'F'], shape: 'any' });
  const first = drawDrill(pool, 12, sequence([0.1, 0.7, 0.4, 0.95]));
  const second = drawDrill(pool, 12, sequence([0.1, 0.7, 0.4, 0.95]));
  assert.deepEqual(symbols(first), symbols(second));
});

// ---- A progression ---------------------------------------------------------------------------

test('progressionFor: the library progression, with its bars and its chords per bar intact', () => {
  assert.deepEqual(barsOf(progressionFor('turnaround', 'F')), ['Fmaj7 D7', 'Gm7 C7']);
  assert.deepEqual(progressionFor('turnaround', 'F').bars[0].chords.map(chord => chord.beat), [1, 3]);
  // The twelve-bar form is kept as written: a repeated bar is a bar, not a chord already answered.
  assert.equal(progressionFor('blues', 'C').bars.length, 12);
});

test('progressionFor: Db and Gb turn into C# and F# when the flat spelling would write Dbm or Gbm', () => {
  // A major ii–V–I in Gb is written with flats, and stays that way.
  assert.deepEqual(barsOf(progressionFor('ii-V-I', 'Gb')).slice(0, 3), ['Abm7', 'Db7', 'Gbmaj7']);
  assert.equal(progressionFor('ii-V-I', 'Gb').key, 'Gb');
  // The minor one would end on Gbm6, which nobody writes: it is F# minor.
  assert.deepEqual(barsOf(progressionFor('ii-V-i', 'Gb')).slice(0, 3), ['G#ø7', 'C#7alt', 'F#m6']);
  assert.equal(progressionFor('ii-V-i', 'Gb').key, 'F#');
  assert.deepEqual(barsOf(progressionFor('ii-V-i', 'Db')).slice(0, 3), ['D#ø7', 'G#7alt', 'C#m6']);
  // And no progression in any key asks for a chord a chart would not write.
  for (const id of Object.keys(PROGRESSIONS)) {
    for (const key of KEYS) {
      for (const bar of progressionFor(id, key).bars) {
        for (const { symbol } of bar.chords) {
          const chord = parseChord(symbol);
          assert.equal(plainName(chord.root), chord.root, `${id} in ${key}: ${symbol}`);
          assert.equal(chartSymbol(chord.root, symbol.slice(chord.root.length)), symbol, `${id} in ${key}: ${symbol}`);
        }
      }
    }
  }
});

// ---- The plan the screen runs ----------------------------------------------------------------

test('trainingPlan: a drill is one chord to the bar, long enough to never notice it loops', () => {
  const plan = trainingPlan({ ...DEFAULT_TRAINING, mode: 'drill', qualities: ['m7', '7'], keys: ['C', 'F'], shape: 'rootless-A', tempo: 96 });
  assert.equal(plan.endless, true);
  assert.equal(plan.mode, 'drill');
  assert.equal(plan.tempo, 96);
  assert.equal(plan.texture, 'rootless-A');
  assert.equal(plan.progression.bars.length, DRILL_BARS);
  assert.ok(DRILL_BARS >= 256);
  for (const bar of plan.progression.bars) {
    assert.equal(bar.chords.length, 1);
    assert.equal(bar.chords[0].beat, 1);
  }
  assert.deepEqual(plan.progression.timeSignature, [4, 4]);
});

test('trainingPlan: a progression keeps its own bars, loops, and the shape asked for when it fits', () => {
  const plan = trainingPlan({ ...DEFAULT_TRAINING, mode: 'progression', progression: 'turnaround', key: 'Bb', tempo: 140, shape: 'shell' });
  assert.equal(plan.endless, true);
  assert.equal(plan.mode, 'progression');
  assert.equal(plan.tempo, 140);
  // Until 2026-10-28 the shape belonged to the drill alone; Edi asked for it on progressions.
  assert.equal(plan.texture, 'shell', 'Bbmaj7, G7, Cm7, F7 all have a shell');
  assert.deepEqual(barsOf(plan.progression), barsOf(getProgression('turnaround', 'Bb')));
  assert.match(plan.name, /Turnaround/);
  assert.match(plan.name, /Bb/);
});

test('trainingPlan: nothing playable is no plan, rather than a screen with no chord on it', () => {
  assert.equal(trainingPlan({ ...DEFAULT_TRAINING, mode: 'drill', qualities: [] }), null);
  assert.equal(trainingPlan({ ...DEFAULT_TRAINING, mode: 'drill', qualities: ['m7b5'], shape: 'quartal' }), null);
});

// ---- Remembering the choices -----------------------------------------------------------------

test('sanitizeTraining: what was saved is kept where it makes sense, and replaced where it does not', () => {
  assert.deepEqual(sanitizeTraining(null), DEFAULT_TRAINING);
  assert.deepEqual(sanitizeTraining('nonsense'), DEFAULT_TRAINING);
  const cleaned = sanitizeTraining({
    mode: 'progression', qualities: ['m7', 'nope', 'm7'], keys: ['F', 'H'], shape: 'triangle',
    progression: 'no-such-tune', key: 'Q', tempo: 9000,
  });
  assert.equal(cleaned.mode, 'progression');
  assert.deepEqual(cleaned.qualities, ['m7']);
  assert.deepEqual(cleaned.keys, ['F']);
  assert.equal(cleaned.shape, DEFAULT_TRAINING.shape);
  assert.equal(cleaned.progression, DEFAULT_TRAINING.progression);
  assert.equal(cleaned.key, DEFAULT_TRAINING.key);
  assert.equal(cleaned.tempo, 240, 'clamped, not thrown away');
  assert.equal(sanitizeTraining({ tempo: 3 }).tempo, 40);
  // An empty list is a choice somebody made mid-edit, not a broken file: it is kept, and the
  // screen says there is nothing to play.
  assert.deepEqual(sanitizeTraining({ qualities: [] }).qualities, []);
});

test('the choices survive a save and a load, and a broken file starts from the defaults', () => {
  const storage = fakeStorage();
  const chosen = { ...DEFAULT_TRAINING, qualities: ['m7b5'], keys: ['Eb'], shape: 'drop-2', tempo: 88 };
  saveTraining(chosen, storage);
  assert.deepEqual(loadTraining(storage), chosen);
  assert.deepEqual(loadTraining(fakeStorage({ 'sidekeys.training': 'not json' })), DEFAULT_TRAINING);
  assert.deepEqual(loadTraining(undefined), DEFAULT_TRAINING, 'no storage at all is not a crash');
});

test('progressionShapes: a shape is offered on a progression only if every chord in it has one', () => {
  // ii–V–I in C is maj7, m7, 7: every shape the drill offers exists for all three.
  assert.deepEqual(progressionShapes('ii-V-I', 'C'), SHAPES.map(shape => shape.id));
  // The minor ii–V–i starts on a half-diminished: no shell, no quartal for it.
  const minor = progressionShapes('ii-V-i', 'C');
  assert.ok(minor.includes('rootless-A'));
  assert.ok(!minor.includes('shell'));
  assert.ok(!minor.includes('quartal'));
  assert.ok(minor.includes('any'), 'any voicing is always there');
});

test('trainingPlan: a progression carries the shape when it fits, and none when it does not', () => {
  const plan = trainingPlan({ ...DEFAULT_TRAINING, mode: 'progression', progression: 'ii-V-I', key: 'C', shape: 'rootless-A' });
  assert.equal(plan.texture, 'rootless-A');
  assert.equal(plan.shape, 'rootless-A');
  const unfit = trainingPlan({ ...DEFAULT_TRAINING, mode: 'progression', progression: 'ii-V-i', key: 'C', shape: 'shell' });
  assert.equal(unfit.texture, null, 'a shell ii–V–i would ask for a voicing the half-diminished does not have');
});
