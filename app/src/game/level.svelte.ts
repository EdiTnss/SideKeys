// One level: a fixed list of chords to answer, the attempts that came back, and what they earn.
//
// The scoring itself is not here — `scoreRun`, `xpFor` and `weakSpots` live in the engine, where
// `node --test` can reach them and where a leaderboard check could one day run the same code on
// a server. This file only keeps the place in the queue.

import {
  getProgression, parseChord, scoreRun, movementThreshold, xpFor,
  emptyStats, recordAttempt, weakSpots,
} from '../bridge/theory';

export type Attempt = { symbol: string; notes: number[]; analysis: ReturnType<typeof import('../bridge/theory').analyzeVoicing> | null };

export type LevelPlan = {
  id: string;
  name: string;
  progressionId: string;
  keys: string[];
  /** The unit's place on the path, which is what XP multiplies by. Rootless is unit 5. */
  difficulty: number;
};

export const ROOTLESS_II_V_I: LevelPlan = {
  id: 'rootless-ii-V-I',
  name: 'Rootless voicings over ii–V–I',
  progressionId: 'ii-V-I',
  keys: ['C', 'F', 'Bb', 'Eb'],
  difficulty: 5,
};

type Bar = { chords: Array<{ symbol: string }> };

function asksFor(plan: LevelPlan): string[] {
  const symbols = plan.keys.flatMap(key =>
    (getProgression(plan.progressionId, key).bars as Bar[]).flatMap(bar => bar.chords.map(chord => chord.symbol)));
  // The library writes ii–V–I as '| Dm7 | G7 | Cmaj7 | % |', because a tune holds the I for two
  // bars. A drill asks for it once: a repeat here would be a chord you already answered.
  return symbols.filter((symbol, at) => symbol !== symbols[at - 1]);
}

export function createLevel(plan: LevelPlan) {
  const asks = asksFor(plan);
  let attempts = $state<Attempt[]>([]);

  const index = $derived(attempts.length);
  const done = $derived(attempts.length >= asks.length);
  const ask = $derived(done ? null : asks[index]);

  // Timed is still false everywhere: the metronome is not in the shell yet, so the third star
  // cannot be earned here. The result screen says so rather than letting it look broken.
  const score = $derived(done
    ? scoreRun({ attempts, timed: false, movementThreshold: movementThreshold(plan.progressionId) })
    : null);
  const xp = $derived(score ? xpFor({ stars: score.stars, difficulty: plan.difficulty }) : 0);

  // The one thing to fix, counted by the engine's own weak-spot rule over this run alone.
  const weakness = $derived.by(() => {
    if (!done) return null;
    let stats = emptyStats();
    for (const attempt of attempts) {
      if (!attempt.analysis) continue;
      const chord = parseChord(attempt.symbol);
      stats = recordAttempt(stats, { key: attempt.symbol.slice(chord.root.length), chord, analysis: attempt.analysis });
    }
    return weakSpots(stats, { limit: 1 })[0] ?? null;
  });

  return {
    get plan() { return plan; },
    get ask() { return ask; },
    get index() { return index; },
    get total() { return asks.length; },
    get done() { return done; },
    get score() { return score; },
    get xp() { return xp; },
    get weakness() { return weakness; },
    record(notes: number[], analysis: Attempt['analysis']) {
      if (done) return;
      attempts = [...attempts, { symbol: asks[attempts.length], notes, analysis }];
    },
    /** An ask nobody answered still counts, which is why it is kept rather than dropped. */
    skip() {
      if (done) return;
      attempts = [...attempts, { symbol: asks[attempts.length], notes: [], analysis: null }];
    },
    restart() {
      attempts = [];
    },
  };
}
