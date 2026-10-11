// The third door: the clock and the pass.
//
// Same rule as the other two — imported from ../../../src untouched, one way only. The
// metronome schedules its clicks on the AudioContext clock with a lookahead, so it does not
// drift; `positionOf` turns a performance.now() stamp into (bar, beat); and `snapshotTarget` is
// the one rule that decides which chord a captured voicing answers, shared with the harness's
// replay so the two cannot drift apart.

export { createMetronome } from '../../../src/audio/metronome.js';
export { createSession, snapshotTarget, isAnticipated, ANTICIPATION_BEATS } from '../../../src/ui/session.js';
