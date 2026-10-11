// The path: units, the levels inside them, and what opens what. Data plus two rules, no DOM.
//
// Only chords the analyzer can actually judge are asked for here. Two things it cannot judge
// yet, so two units DIRECTION.md lists are missing on purpose:
// - **inversions**: `C/E` parses and carries `bassPc`, but `analyzeVoicing` never looks at the
//   bass, so a root-position C would pass as C/E. That needs a rule and a test first.
// - **"play a shell / rootless voicing"**: the analyzer reports `voicing.type`, but nothing asks
//   for one, so a level cannot require a texture yet.
// The quality table also has no diminished or augmented triad — a bare `dim` reads as dim7, the
// way charts write it — so the triad unit stops at major, minor and sus4.
//
// The content below is Claude's draft; the teaching order is Edi's to correct.

import { getProgression } from '../theory/progressions.js';
import { movementThreshold, DEFAULT_MOVEMENT } from '../theory/stars.js';

const SIX = ['C', 'F', 'G', 'D', 'A', 'E'];
const TWELVE = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D', 'G'];

export const PATH = [
  {
    id: 'triads',
    name: 'Triads',
    blurb: 'Three notes, both hands, in every key.',
    difficulty: 1,
    levels: [
      { id: 'triads-major', name: 'Major triads', tempo: 60, asks: { kind: 'chords', qualities: [''], keys: SIX } },
      { id: 'triads-minor', name: 'Minor triads', tempo: 60, asks: { kind: 'chords', qualities: ['m'], keys: SIX } },
      { id: 'triads-both', name: 'Major and minor, twelve keys', tempo: 65, asks: { kind: 'chords', qualities: ['', 'm'], keys: TWELVE } },
      { id: 'triads-boss', name: 'Boss — major, minor and sus4', boss: true, tempo: 70, asks: { kind: 'chords', qualities: ['', 'm', 'sus4'], keys: TWELVE } },
    ],
  },
  {
    id: 'sevenths',
    name: 'Seventh chords',
    blurb: 'The four that carry almost every tune.',
    difficulty: 2,
    levels: [
      { id: 'sevenths-maj-min', name: 'maj7 and m7', tempo: 65, asks: { kind: 'chords', qualities: ['maj7', 'm7'], keys: SIX } },
      { id: 'sevenths-dom-half', name: 'Dominant 7 and m7b5', tempo: 65, asks: { kind: 'chords', qualities: ['7', 'm7b5'], keys: SIX } },
      { id: 'sevenths-all', name: 'All four, twelve keys', tempo: 70, asks: { kind: 'chords', qualities: ['maj7', 'm7', '7', 'm7b5'], keys: TWELVE } },
      { id: 'sevenths-boss', name: 'Boss — with dim7 and m6', boss: true, tempo: 75, asks: { kind: 'chords', qualities: ['maj7', 'm7', '7', 'm7b5', 'dim7', 'm6'], keys: TWELVE } },
    ],
  },
  {
    id: 'ii-V-I',
    name: 'ii–V–I',
    blurb: 'The sentence the whole language is built on.',
    difficulty: 3,
    levels: [
      { id: 'ii-V-I-flat-keys', name: 'Four flat keys', tempo: 80, asks: { kind: 'progression', progressionId: 'ii-V-I', keys: ['C', 'F', 'Bb', 'Eb'] } },
      { id: 'ii-V-I-sharp-keys', name: 'Four more', tempo: 80, asks: { kind: 'progression', progressionId: 'ii-V-I', keys: ['Ab', 'Db', 'G', 'D'] } },
      { id: 'ii-V-I-boss', name: 'Boss — all twelve keys', boss: true, tempo: 80, asks: { kind: 'progression', progressionId: 'ii-V-I', keys: TWELVE } },
    ],
  },
];

/** Every chord a level asks for, in order. */
export function asksFor(level) {
  const source = level.asks;
  if (source.kind === 'progression') {
    const symbols = source.keys.flatMap(key =>
      getProgression(source.progressionId, key).bars.flatMap(bar => bar.chords.map(chord => chord.symbol)));
    // The library writes ii–V–I as '| Dm7 | G7 | Cmaj7 | % |', because a tune holds the I for two
    // bars. A drill asks for it once: a repeat here would be a chord you already answered.
    return symbols.filter((symbol, at) => symbol !== symbols[at - 1]);
  }
  return source.keys.flatMap(key => source.qualities.map(quality => `${key}${quality}`));
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
 * The path as the map draws it: which units and levels are open, and the stars in each.
 * A level opens when the one before it has a star; a unit opens when the unit before it has
 * beaten its boss. `stars` is { levelId: stars }.
 */
export function pathState(stars = {}) {
  let unitOpen = true;
  return PATH.map(unit => {
    const open = unitOpen;
    let levelOpen = open;
    const levels = unit.levels.map(level => {
      const earned = stars[level.id] ?? 0;
      const state = { level, stars: earned, unlocked: levelOpen };
      levelOpen = open && earned > 0;      // the next one waits for a star on this one
      return state;
    });
    const boss = unit.levels.at(-1);
    unitOpen = open && (stars[boss.id] ?? 0) > 0;
    return {
      unit,
      unlocked: open,
      levels,
      stars: levels.reduce((sum, entry) => sum + entry.stars, 0),
      maxStars: unit.levels.length * 3,
    };
  });
}

/** → { unit, level } or null. */
export function levelById(id) {
  for (const unit of PATH) {
    const level = unit.levels.find(entry => entry.id === id);
    if (level) return { unit, level };
  }
  return null;
}
