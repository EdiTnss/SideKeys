// What one voicing earns, for the stars in docs/spec-game.md. Pure, no DOM.
//
// The predicates read the analyzer's own verdict instead of building a second opinion on top of
// it: the analyzer already decided which findings are reproaches (warnings) and which are
// observations (info), and a star that disagreed with it would be a second source of truth.

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
