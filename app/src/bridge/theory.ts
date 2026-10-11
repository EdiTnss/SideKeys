// The only door between the shell and the engine.
//
// Everything below is imported from ../../../src, untouched: the same files Node runs under
// `npm test` at the repo root, with no dependencies and no build step. The rule that makes this
// safe is one-way — the shell imports from src/, and nothing in src/ may ever import from here.
// Keeping the imports in one file means that rule is visible in one diff instead of scattered
// through the screens.

export { parseChord, ChordParseError } from '../../../src/theory/chords.js';
export { analyzeVoicing } from '../../../src/theory/analyzer.js';
export { isRight, isClean, scoreRun, movementThreshold, xpFor } from '../../../src/theory/stars.js';
export { getProgression, PROGRESSIONS } from '../../../src/theory/progressions.js';

// Practice statistics: the same recorder the old page uses, so "one thing to fix" on the result
// screen is counted exactly like the weak spots in the Lab, not by a second rule.
export { emptyStats, recordAttempt, weakSpots } from '../../../src/ui/stats.js';
export { compareVoicings } from '../../../src/theory/voiceLeading.js';
export { midiToName, octave, spellDegree } from '../../../src/theory/notes.js';

// Pure mappers that turn an analysis into keyboard classes. They touch no DOM, and they are
// tested in test/render.test.js, so the shell reuses them rather than growing a second copy.
export { roleClasses, missingClasses, heldClasses, armedClasses } from '../../../src/ui/render.js';
