// The fourth door: the path and what the player has earned on it.
//
// Both modules are plain JS in ../../../src/game, imported untouched, for the same reason as
// the rest: `node --test` reaches them there, and the day a leaderboard needs checking, the
// server can run the same arithmetic the browser ran.

export { PATH, asksFor, thresholdFor, pathState, levelById, reviewLevel } from '../../../src/game/path.js';
export {
  emptyProgress, recordRun, playsToday, dayStamp, loadProgress, saveProgress,
  streak, secondsOn, outcomesFor, dueReviews, nextLevel,
} from '../../../src/game/progress.js';
