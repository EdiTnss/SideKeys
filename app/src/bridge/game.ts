// The fourth door: the path and what the player has earned on it.
//
// Both modules are plain JS in ../../../src/game, imported untouched, for the same reason as
// the rest: `node --test` reaches them there, and the day a leaderboard needs checking, the
// server can run the same arithmetic the browser ran.

export { PATH, TWELVE, asksFor, thresholdFor, pathState, levelById, levelAfter, reviewLevel } from '../../../src/game/path.js';
export {
  emptyProgress, recordRun, dayStamp, loadProgress, saveProgress,
  streak, secondsOn, outcomesFor, dueReviews, nextLevel,
  recordChallenge, challengeResult, recordPractice,
} from '../../../src/game/progress.js';

// Training: free practice off the path — a drill or a looped progression, with no stars.
export {
  QUALITY_GROUPS, KEYS, SHAPES, TEMPO_RANGE, DEFAULT_TRAINING,
  drillPool, shapeQualities, progressionFor, progressionShapes, trainingPlan, loadTraining, saveTraining,
} from '../../../src/game/training.js';
export { PROGRESSIONS } from '../../../src/theory/progressions.js';

// The daily challenge: the same ten chords for everyone, drawn from the date. Deterministic,
// so no server and no account — and testable in Node like everything else here.
export {
  EPOCH, RUNGS, SQUARES, SHARE_URL,
  challengeNumber, dailyChallenge, challengeLevel, challengeStates, shareText,
} from '../../../src/game/challenge.js';

// The theory pages: one lesson per unit, with examples the analyzer itself has graded.
export { LESSONS, lessonFor, lessonForTexture, lessonIn, exampleNotes } from '../../../src/game/lessons.js';

// The glossary: the jazz words, explained in Romanian, with examples the analyzer has graded.
export { GLOSSARY, GLOSSARY_GROUPS, glossaryTerm } from '../../../src/game/glossary.js';

// The word beside a chord played right, never the same one twice running.
export { nextPraise } from '../../../src/game/praise.js';
