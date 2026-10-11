// The path: units, the levels inside them, and what opens what. Data plus two rules, no DOM.
//
// Every level here is one the analyzer can actually grade. Two rules were added on 2026-10-11 so
// that most of DIRECTION.md's list became gradeable: a slash chord's bass is checked
// (`analysis.slash`), and a level may demand a texture (`isRight(analysis, { texture })`).
//
// What is still missing and why: the quality table has no diminished or augmented triad, since
// a bare `dim` reads as dim7 the way charts write it; and Comping needs Gig Mode, which does not
// exist. The teaching content below is Claude's draft; the order is Edi's to correct.

import { parseChord } from '../theory/chords.js';
import { spellDegree } from '../theory/notes.js';
import { getProgression } from '../theory/progressions.js';
import { movementThreshold, DEFAULT_MOVEMENT } from '../theory/stars.js';

const SIX = ['C', 'F', 'G', 'D', 'A', 'E'];
const TWELVE = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D', 'G'];

// One chord to the bar at 120: two seconds to hear it, find it and play it (Edi, 2026-10-11).
const TEMPO = 120;

export const PATH = [
  {
    id: 'triads',
    name: 'Triads',
    blurb: 'Three notes, both hands, in every key.',
    difficulty: 1,
    levels: [
      { id: 'triads-major', name: 'Major triads', tempo: TEMPO, asks: { kind: 'chords', qualities: [''], keys: SIX } },
      { id: 'triads-minor', name: 'Minor triads', tempo: TEMPO, asks: { kind: 'chords', qualities: ['m'], keys: SIX } },
      { id: 'triads-both', name: 'Major and minor', tempo: TEMPO, asks: { kind: 'chords', qualities: ['', 'm'], keys: SIX } },
      { id: 'triads-boss', name: 'Boss — with sus4, twelve keys', boss: true, tempo: TEMPO, asks: { kind: 'chords', qualities: ['', 'm', 'sus4'], keys: TWELVE, count: 18 } },
    ],
  },
  {
    id: 'inversions',
    name: 'Inversions',
    blurb: 'The same chord, a different note underneath. The bass is the exercise.',
    difficulty: 2,
    levels: [
      { id: 'inv-major-first', name: 'First inversion', tempo: TEMPO, asks: { kind: 'slash', shapes: [{ quality: '', degree: '3' }], keys: SIX } },
      { id: 'inv-major-second', name: 'Second inversion', tempo: TEMPO, asks: { kind: 'slash', shapes: [{ quality: '', degree: '5' }], keys: SIX } },
      { id: 'inv-minor', name: 'Minor, both inversions', tempo: TEMPO, asks: { kind: 'slash', shapes: [{ quality: 'm', degree: 'b3' }, { quality: 'm', degree: '5' }], keys: SIX } },
      {
        id: 'inv-boss',
        name: 'Boss — major and minor, twelve keys',
        boss: true,
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
    difficulty: 3,
    levels: [
      { id: 'sevenths-maj-min', name: 'maj7 and m7', tempo: TEMPO, asks: { kind: 'chords', qualities: ['maj7', 'm7'], keys: SIX } },
      { id: 'sevenths-dom-half', name: 'Dominant 7 and m7b5', tempo: TEMPO, asks: { kind: 'chords', qualities: ['7', 'm7b5'], keys: SIX } },
      { id: 'sevenths-all', name: 'All four, twelve keys', tempo: TEMPO, asks: { kind: 'chords', qualities: ['maj7', 'm7', '7', 'm7b5'], keys: TWELVE, count: 16 } },
      { id: 'sevenths-boss', name: 'Boss — with dim7 and m6', boss: true, tempo: TEMPO, asks: { kind: 'chords', qualities: ['maj7', 'm7', '7', 'm7b5', 'dim7', 'm6'], keys: TWELVE, count: 18 } },
    ],
  },
  {
    id: 'shell',
    name: 'Shell voicings',
    blurb: 'Root, third and seventh. The least that still says the chord.',
    difficulty: 4,
    texture: 'shell',
    levels: [
      { id: 'shell-maj-min', name: 'maj7 and m7', tempo: TEMPO, texture: 'shell', asks: { kind: 'chords', qualities: ['maj7', 'm7'], keys: SIX } },
      { id: 'shell-dom', name: 'Dominants, twelve keys', tempo: TEMPO, texture: 'shell', asks: { kind: 'chords', qualities: ['7'], keys: TWELVE } },
      { id: 'shell-boss', name: 'Boss — all three, twelve keys', boss: true, tempo: TEMPO, texture: 'shell', asks: { kind: 'chords', qualities: ['maj7', 'm7', '7'], keys: TWELVE, count: 18 } },
    ],
  },
  {
    id: 'rootless',
    name: 'Rootless voicings',
    blurb: 'Leave the root to the bass player. Four notes, A and B shapes.',
    difficulty: 5,
    levels: [
      { id: 'rootless-a', name: 'Form A', tempo: TEMPO, texture: 'rootless-A', asks: { kind: 'chords', qualities: ['m7', '7', 'maj7'], keys: SIX, count: 12 } },
      { id: 'rootless-b', name: 'Form B', tempo: TEMPO, texture: 'rootless-B', asks: { kind: 'chords', qualities: ['m7', '7', 'maj7'], keys: SIX, count: 12 } },
      { id: 'rootless-both', name: 'Either shape, twelve keys', tempo: TEMPO, texture: ['rootless-A', 'rootless-B'], asks: { kind: 'chords', qualities: ['m7', '7', 'maj7'], keys: TWELVE, count: 16 } },
      { id: 'rootless-boss', name: 'Boss — rootless over ii–V–I', boss: true, tempo: TEMPO, texture: ['rootless-A', 'rootless-B'], asks: { kind: 'progression', progressionId: 'ii-V-I', keys: ['C', 'F', 'Bb', 'Eb'] } },
    ],
  },
  {
    id: 'drop-2',
    name: 'Drop 2',
    blurb: 'Take the second voice from the top and drop it an octave.',
    difficulty: 6,
    levels: [
      { id: 'drop2-maj-min', name: 'maj7 and m7', tempo: TEMPO, texture: 'drop-2', asks: { kind: 'chords', qualities: ['maj7', 'm7'], keys: SIX } },
      { id: 'drop2-boss', name: 'Boss — with dominants, twelve keys', boss: true, tempo: TEMPO, texture: 'drop-2', asks: { kind: 'chords', qualities: ['maj7', 'm7', '7'], keys: TWELVE, count: 18 } },
    ],
  },
  {
    id: 'quartal',
    name: 'Quartal',
    blurb: 'Fourths stacked. The modern sound, and the one the engine is strictest about.',
    difficulty: 7,
    levels: [
      // Dominants are missing on purpose: with the tightened quartal rule (at most one augmented
      // fourth), the generator offers no quartal voicing for a dominant in any key.
      { id: 'quartal-minor', name: 'Minor sevenths, twelve keys', tempo: TEMPO, texture: 'quartal', asks: { kind: 'chords', qualities: ['m7'], keys: TWELVE } },
      { id: 'quartal-boss', name: 'Boss — with maj7', boss: true, tempo: TEMPO, texture: 'quartal', asks: { kind: 'chords', qualities: ['m7', 'maj7'], keys: TWELVE, count: 18 } },
    ],
  },
  {
    id: 'ii-V-I',
    name: 'ii–V–I',
    blurb: 'The sentence the whole language is built on.',
    difficulty: 8,
    levels: [
      { id: 'ii-V-I-flat-keys', name: 'Four flat keys', tempo: TEMPO, asks: { kind: 'progression', progressionId: 'ii-V-I', keys: ['C', 'F', 'Bb', 'Eb'] } },
      { id: 'ii-V-I-sharp-keys', name: 'Four more', tempo: TEMPO, asks: { kind: 'progression', progressionId: 'ii-V-I', keys: ['Ab', 'Db', 'G', 'D'] } },
      { id: 'ii-V-I-boss', name: 'Boss — all twelve keys', boss: true, tempo: TEMPO, asks: { kind: 'progression', progressionId: 'ii-V-I', keys: TWELVE } },
    ],
  },
];

/** Every chord a level asks for, in order. `count` keeps a long cross product playable. */
export function asksFor(level) {
  const source = level.asks;
  const asks = buildAsks(source);
  return source.count ? asks.slice(0, source.count) : asks;
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
    // The bass is spelled from the chord itself, so Eb/Gb never comes out as Eb/F#.
    return source.keys.flatMap(key => source.shapes.map(shape => {
      const chord = parseChord(`${key}${shape.quality}`);
      return `${key}${shape.quality}/${spellDegree(chord.root, shape.degree)}`;
    }));
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
