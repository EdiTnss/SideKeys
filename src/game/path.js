// The path: units, the levels inside them, and what opens what. Data plus two rules, no DOM.
//
// Every level here is one the analyzer can actually grade. Two rules were added on 2026-10-11 so
// that most of DIRECTION.md's list became gradeable: a slash chord's bass is checked
// (`analysis.slash`), and a level may demand a texture (`isRight(analysis, { texture })`).
//
// What is still missing and why: the quality table has no diminished or augmented triad, since
// a bare `dim` reads as dim7 the way charts write it; and Comping needs Gig Mode, which does not
// exist. The teaching content below is Claude's draft; the order is Edi's to correct.

import { parseChord, chartSymbol } from '../theory/chords.js';
import { spellPlain } from '../theory/notes.js';
import { getProgression } from '../theory/progressions.js';
import { movementThreshold, DEFAULT_MOVEMENT } from '../theory/stars.js';

const SIX = ['C', 'F', 'G', 'D', 'A', 'E'];
const TWELVE = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D', 'G'];

// One chord to the bar at 120: two seconds to hear it, find it and play it (Edi, 2026-10-11).
const TEMPO = 120;

// A unit's last level used to be called its boss and to guard the unit after it. Both went on
// 2026-10-12 (Edi): the level stays, named for what it asks, and every unit is open. The ids
// still end in "-boss" because they are the keys stars are saved under — renaming them would
// orphan stars already earned, for a word no player ever sees.
export const PATH = [
  {
    id: 'triads',
    name: 'Triads',
    blurb: 'Three notes, both hands, in every key.',
    levels: [
      { id: 'triads-major', name: 'Major triads', tempo: TEMPO, asks: { kind: 'chords', qualities: [''], keys: SIX } },
      { id: 'triads-minor', name: 'Minor triads', tempo: TEMPO, asks: { kind: 'chords', qualities: ['m'], keys: SIX } },
      { id: 'triads-both', name: 'Major and minor', tempo: TEMPO, asks: { kind: 'chords', qualities: ['', 'm'], keys: SIX } },
      { id: 'triads-boss', name: 'With sus4, twelve keys', tempo: TEMPO, asks: { kind: 'chords', qualities: ['', 'm', 'sus4'], keys: TWELVE, count: 18 } },
    ],
  },
  {
    id: 'inversions',
    name: 'Inversions',
    blurb: 'The same chord, a different note underneath. The bass is the exercise.',
    levels: [
      { id: 'inv-major-first', name: 'First inversion', tempo: TEMPO, asks: { kind: 'slash', shapes: [{ quality: '', degree: '3' }], keys: SIX } },
      { id: 'inv-major-second', name: 'Second inversion', tempo: TEMPO, asks: { kind: 'slash', shapes: [{ quality: '', degree: '5' }], keys: SIX } },
      { id: 'inv-minor', name: 'Minor, both inversions', tempo: TEMPO, asks: { kind: 'slash', shapes: [{ quality: 'm', degree: 'b3' }, { quality: 'm', degree: '5' }], keys: SIX } },
      {
        id: 'inv-boss',
        name: 'Major and minor, twelve keys',
        tempo: TEMPO,
        asks: {
          kind: 'slash',
          shapes: [{ quality: '', degree: '3' }, { quality: '', degree: '5' }, { quality: 'm', degree: 'b3' }, { quality: 'm', degree: '5' }],
          keys: TWELVE,
          count: 20,
        },
      },
    ],
  },
  {
    id: 'sevenths',
    name: 'Seventh chords',
    blurb: 'The four that carry almost every tune.',
    levels: [
      { id: 'sevenths-maj-min', name: 'maj7 and m7', tempo: TEMPO, asks: { kind: 'chords', qualities: ['maj7', 'm7'], keys: SIX } },
      { id: 'sevenths-dom-half', name: 'Dominant 7 and m7b5', tempo: TEMPO, asks: { kind: 'chords', qualities: ['7', 'm7b5'], keys: SIX } },
      { id: 'sevenths-all', name: 'All four, twelve keys', tempo: TEMPO, asks: { kind: 'chords', qualities: ['maj7', 'm7', '7', 'm7b5'], keys: TWELVE, count: 16 } },
      { id: 'sevenths-boss', name: 'With dim7 and m6', tempo: TEMPO, asks: { kind: 'chords', qualities: ['maj7', 'm7', '7', 'm7b5', 'dim7', 'm6'], keys: TWELVE, count: 18 } },
    ],
  },
  {
    id: 'shell',
    name: 'Shell voicings',
    blurb: 'Root, third and seventh. The least that still says the chord.',
    texture: 'shell',
    levels: [
      { id: 'shell-maj-min', name: 'maj7 and m7', tempo: TEMPO, texture: 'shell', asks: { kind: 'chords', qualities: ['maj7', 'm7'], keys: SIX } },
      { id: 'shell-dom', name: 'Dominants, twelve keys', tempo: TEMPO, texture: 'shell', asks: { kind: 'chords', qualities: ['7'], keys: TWELVE } },
      { id: 'shell-boss', name: 'All three, twelve keys', tempo: TEMPO, texture: 'shell', asks: { kind: 'chords', qualities: ['maj7', 'm7', '7'], keys: TWELVE, count: 18 } },
    ],
  },
  {
    id: 'rootless',
    name: 'Rootless voicings',
    blurb: 'Leave the root to the bass player. Four notes, A and B shapes.',
    levels: [
      { id: 'rootless-a', name: 'Form A', tempo: TEMPO, texture: 'rootless-A', asks: { kind: 'chords', qualities: ['m7', '7', 'maj7'], keys: SIX, count: 12 } },
      { id: 'rootless-b', name: 'Form B', tempo: TEMPO, texture: 'rootless-B', asks: { kind: 'chords', qualities: ['m7', '7', 'maj7'], keys: SIX, count: 12 } },
      { id: 'rootless-both', name: 'Either shape, twelve keys', tempo: TEMPO, texture: ['rootless-A', 'rootless-B'], asks: { kind: 'chords', qualities: ['m7', '7', 'maj7'], keys: TWELVE, count: 16 } },
      { id: 'rootless-boss', name: 'Rootless over ii–V–I', tempo: TEMPO, texture: ['rootless-A', 'rootless-B'], asks: { kind: 'progression', progressionId: 'ii-V-I', keys: ['C', 'F', 'Bb', 'Eb'] } },
    ],
  },
  {
    id: 'drop-2',
    name: 'Drop 2',
    blurb: 'Take the second voice from the top and drop it an octave.',
    levels: [
      { id: 'drop2-maj-min', name: 'maj7 and m7', tempo: TEMPO, texture: 'drop-2', asks: { kind: 'chords', qualities: ['maj7', 'm7'], keys: SIX } },
      { id: 'drop2-boss', name: 'With dominants, twelve keys', tempo: TEMPO, texture: 'drop-2', asks: { kind: 'chords', qualities: ['maj7', 'm7', '7'], keys: TWELVE, count: 18 } },
    ],
  },
  {
    id: 'quartal',
    name: 'Quartal',
    blurb: 'Fourths stacked. The modern sound, and the one the engine is strictest about.',
    levels: [
      // Dominants are missing on purpose: with the tightened quartal rule (at most one augmented
      // fourth), the generator offers no quartal voicing for a dominant in any key.
      { id: 'quartal-minor', name: 'Minor sevenths, twelve keys', tempo: TEMPO, texture: 'quartal', asks: { kind: 'chords', qualities: ['m7'], keys: TWELVE } },
      { id: 'quartal-boss', name: 'With maj7', tempo: TEMPO, texture: 'quartal', asks: { kind: 'chords', qualities: ['m7', 'maj7'], keys: TWELVE, count: 18 } },
    ],
  },
  {
    id: 'ii-V-I',
    name: 'ii–V–I',
    blurb: 'The sentence the whole language is built on.',
    levels: [
      { id: 'ii-V-I-flat-keys', name: 'Four flat keys', tempo: TEMPO, asks: { kind: 'progression', progressionId: 'ii-V-I', keys: ['C', 'F', 'Bb', 'Eb'] } },
      { id: 'ii-V-I-sharp-keys', name: 'Four more', tempo: TEMPO, asks: { kind: 'progression', progressionId: 'ii-V-I', keys: ['Ab', 'Db', 'G', 'D'] } },
      { id: 'ii-V-I-boss', name: 'All twelve keys', tempo: TEMPO, asks: { kind: 'progression', progressionId: 'ii-V-I', keys: TWELVE } },
    ],
  },
];

/**
 * Every chord a level asks for, in order, each carrying the shape that rung demands, or null
 * when it demands none. A level asks for one shape from start to finish; the daily challenge
 * is a ramp and sets one per rung. Both arrive here in the same form, so nothing downstream
 * has to know which it is reading. `count` keeps a long cross product playable.
 *
 * @param {any} level
 * @returns {Array<{ symbol: string, texture: string | string[] | null }>}
 */
export function asksFor(level) {
  const source = level.asks;
  // Already drawn, each with its own shape: the daily challenge's ramp comes through here.
  if (source.kind === 'fixed') return source.asks;
  const symbols = buildAsks(source);
  const asked = source.count ? symbols.slice(0, source.count) : symbols;
  return asked.map(symbol => ({ symbol, texture: level.texture ?? null }));
}

function buildAsks(source) {
  if (source.kind === 'progression') {
    const symbols = source.keys.flatMap(key =>
      getProgression(source.progressionId, key).bars.flatMap(bar => bar.chords.map(chord => chord.symbol)));
    // The library writes ii–V–I as '| Dm7 | G7 | Cmaj7 | % |', because a tune holds the I for two
    // bars. A drill asks for it once: a repeat here would be a chord you already answered.
    return symbols.filter((symbol, at) => symbol !== symbols[at - 1]);
  }
  if (source.kind === 'slash') {
    // The bass is spelled from the chord itself, so Eb/Gb never comes out as Eb/F#, and the
    // chord is named the way a chart names it, so the minor on Db is C#m/E and never Dbm/Fb.
    return source.keys.flatMap(key => source.shapes.map(shape => {
      const chord = parseChord(chartSymbol(key, shape.quality));
      return `${chord.symbol}/${spellPlain(chord.root, shape.degree)}`;
    }));
  }
  return source.keys.flatMap(key => source.qualities.map(quality => chartSymbol(key, quality)));
}

/**
 * How much movement per voice the third star allows on this level. A progression has its own
 * measured threshold; a drill of unrelated chords takes the default, which was measured too
 * (docs/spec-game.md).
 */
export function thresholdFor(level) {
  return level.asks.kind === 'progression' ? movementThreshold(level.asks.progressionId) : DEFAULT_MOVEMENT;
}

/**
 * The path as the map draws it: the units in order, which levels are open, and the stars in each.
 *
 * Every unit is open from the start (Edi, 2026-10-12). They used to open one after another, and
 * with no placement test that sent a player who came for rootless voicings through the triads
 * first. Inside a unit the order still holds: a level opens when the one before it has a star.
 * `stars` is { levelId: stars }.
 *
 * @param {Record<string, number>} [stars]
 * @returns {Array<{ unit: any, number: number, stars: number, maxStars: number,
 *                   levels: Array<{ level: any, stars: number, unlocked: boolean }> }>}
 */
export function pathState(stars = {}) {
  return PATH.map((unit, at) => {
    let open = true;
    const levels = unit.levels.map(level => {
      const earned = stars[level.id] ?? 0;
      const state = { level, stars: earned, unlocked: open };
      open = earned > 0;                   // the next one waits for a star on this one
      return state;
    });
    return {
      unit,
      number: at + 1,
      levels,
      stars: levels.reduce((sum, entry) => sum + entry.stars, 0),
      maxStars: unit.levels.length * 3,
    };
  });
}

/**
 * The level behind "your training": the qualities due for review, across all twelve keys. It is
 * not on the path and has no stars to unlock — it is the queue, turned into something playable.
 */
export function reviewLevel(qualities) {
  return {
    id: 'review',
    name: 'Your training',
    tempo: TEMPO,
    asks: { kind: 'chords', qualities, keys: TWELVE, count: 12 },
  };
}

/** → { unit, level } or null. */
export function levelById(id) {
  for (const unit of PATH) {
    const level = unit.levels.find(entry => entry.id === id);
    if (level) return { unit, level };
  }
  return null;
}

/**
 * The level that follows this one on the path, crossing into the next unit after a unit's last
 * level. Null after the very last level, and for anything that is not on the path at all (the
 * review, the daily challenge). Whether it is *open* is `pathState`'s question, not this one's.
 *
 * @param {string} id
 * @returns {{ unit: any, level: any } | null}
 */
export function levelAfter(id) {
  const ordered = PATH.flatMap(unit => unit.levels.map(level => ({ unit, level })));
  const at = ordered.findIndex(entry => entry.level.id === id);
  return at === -1 ? null : ordered[at + 1] ?? null;
}
