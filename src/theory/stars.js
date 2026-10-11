// What one voicing earns, for the stars in docs/spec-game.md. Pure, no DOM.
//
// The predicates read the analyzer's own verdict instead of building a second opinion on top of
// it: the analyzer already decided which findings are reproaches (warnings) and which are
// observations (info), and a star that disagreed with it would be a second source of truth.

import { compareVoicings } from './voiceLeading.js';

/**
 * Right (★): the chord that was asked for is there, and nothing foreign is. Avoid notes, a muddy
 * register and doublings do not spoil it — those are what Clean adds.
 */
export function isRight(analysis) {
  return analysis.missing.length === 0 && analysis.wrong.length === 0;
}

/**
 * Clean (★★): nothing to reproach at all. Warnings are `missing`, `wrong`, `avoid` and `muddy`;
 * `rootless`, `caution`, `doubling` and `type` are info, so a doubled root an octave down — the
 * ordinary thing to play with two hands — stays clean. Clean implies Right, because the first
 * two warnings are exactly what Right tests.
 */
export function isClean(analysis) {
  return analysis.messages.every(message => message.level !== 'warning');
}

// ---- The run ------------------------------------------------------------------------------

/** Right needs this share of the chords asked; Clean needs this share. Edi, 2026-10-11. */
export const RIGHT_SHARE = 0.6;
export const CLEAN_SHARE = 0.8;

/**
 * Semitones of movement per voice allowed for the third star. 1.5 is what `compareVoicings`
 * has called "smooth" since Phase 2, so the star names a threshold the engine already had. The
 * two exceptions are measured, not felt: the table and the method are in docs/spec-game.md.
 */
export const DEFAULT_MOVEMENT = 1.5;
export const MOVEMENT_THRESHOLDS = Object.freeze({
  'ii-V-I': 1.25,        // voice leads almost for free (0.75 measured): the common bar is too low
  turnaround: 1.75,      // the bass moves in thirds (1.25 measured), the dearest in the library
});

export function movementThreshold(progressionId) {
  return MOVEMENT_THRESHOLDS[progressionId] ?? DEFAULT_MOVEMENT;
}

const LABELS = [null, 'Right', 'Clean', 'Smooth'];

/**
 * One pass turned into stars. An ask nobody answered stays in `attempts` with no analysis: it
 * counts in the denominator, because a chord you did not reach is a chord you did not play.
 *
 * @param {{
 *   attempts: Array<{ symbol: string, notes: number[], analysis: any }>,
 *   timed?: boolean,
 *   movementThreshold?: number,
 * }} run
 * @returns {{ stars: number, label: string | null, total: number, right: number, clean: number,
 *             rightShare: number, cleanShare: number, movement: number | null }}
 */
export function scoreRun({ attempts, timed = false, movementThreshold: limit = DEFAULT_MOVEMENT }) {
  const total = attempts.length;
  const answered = attempts.filter(attempt => attempt.analysis);
  const right = answered.filter(attempt => isRight(attempt.analysis)).length;
  const clean = answered.filter(attempt => isClean(attempt.analysis)).length;
  const rightShare = total ? right / total : 0;
  const cleanShare = total ? clean / total : 0;
  const movement = meanMovement(attempts);

  let stars = 0;
  if (rightShare >= RIGHT_SHARE) stars = 1;
  if (stars === 1 && cleanShare >= CLEAN_SHARE) stars = 2;
  if (stars === 2 && timed && movement !== null && movement <= limit) stars = 3;

  return { stars, label: LABELS[stars], total, right, clean, rightShare, cleanShare, movement };
}

/**
 * Semitones per voice, averaged over the chord *changes*. A chord held across two bars is not a
 * change and never enters the average, or sitting still would look like perfect voice leading.
 * No change at all → null, and the third star has nothing to stand on.
 */
function meanMovement(attempts) {
  const moves = [];
  let previous = null;
  for (const attempt of attempts) {
    if (!attempt.analysis || !attempt.notes.length) continue;
    if (previous && previous.symbol !== attempt.symbol) {
      moves.push(compareVoicings(previous.notes, attempt.notes).averageMove);
    }
    previous = attempt;
  }
  if (!moves.length) return null;
  return moves.reduce((sum, move) => sum + move, 0) / moves.length;
}

/**
 * XP from quality and difficulty, never from volume (docs/spec-game.md). `difficulty` is the
 * unit's place on the path, 1 for Triads; `playsToday` is how many times this level was already
 * cleared today, so the second pass pays half and the rest pay nothing. The level stays playable
 * for as long as anyone likes — only the XP stops.
 */
export function xpFor({ stars, difficulty, playsToday = 0 }) {
  if (stars <= 0) return 0;
  const base = stars * difficulty;
  if (playsToday === 0) return base;
  if (playsToday === 1) return Math.round(base / 2);
  return 0;
}
