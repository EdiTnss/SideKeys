// One run of one level: the chords to answer, the attempts that came back, and the clock.
//
// The level owns one question the screen must not answer for itself — *which* chord a voicing
// answers. Free, that is the chord on screen. Timed, it is the slot the voicing started on,
// pushed to the next bar when it started inside the anticipation window, and that decision is
// `snapshotTarget`'s, shared with the harness so the game and the replay cannot disagree.
//
// What a run is worth is not decided here either: `scoreRun` and `weakSpots` live in the
// engine, and the XP needs the player's progress, which belongs to the app above.

import {
  parseChord, analyzeVoicing, scoreRun, emptyStats, recordAttempt, weakSpots,
} from '../bridge/theory';
import { asksFor, thresholdFor } from '../bridge/game';
import { createMetronome, createSession, snapshotTarget, isAnticipated } from '../bridge/time';

type Analysis = ReturnType<typeof analyzeVoicing>;
/**
 * What the app hands back once a finished run has been priced and filed: the XP it paid and,
 * for the daily challenge, the grid. A level has no grid and the result screen shows stars.
 */
export type Finished = { xp: number; grid: string[] | null; share: string | null; official: boolean };

/** One chord asked for, with the shape that rung demands — null when it demands none. */
export type Ask = { symbol: string; texture: string | string[] | null };
export type Attempt = { symbol: string; notes: number[]; analysis: Analysis | null;
                        texture?: string | string[] | null };
export type Answer = { slot: number; symbol: string; anticipated: boolean; analysis: Analysis;
                       texture: string | string[] | null };
export type LevelPlan = {
  id: string;
  name: string;
  tempo: number;
  boss?: boolean;
  /**
   * No clock, by design rather than by omission: the daily challenge is free play so that the
   * grid people paste compares one thing, accuracy. The screen hides the timed run for it.
   */
  free?: boolean;
  /** Its place on the path, for the XP price. Only levels that stand on their own carry it. */
  difficulty?: number;
  /** What shape the level demands, when it demands one: 'shell', 'rootless-A', or a list. */
  texture?: string | string[];
  asks: { kind: string; [key: string]: unknown };
};

/** A unit on the path: a handful of levels ending on a boss. */
export type Unit = {
  id: string;
  name: string;
  blurb: string;
  /** Its place on the path, which is what XP multiplies by. */
  difficulty: number;
  levels: LevelPlan[];
};

export function createLevel(plan: LevelPlan) {
  const asks = asksFor(plan) as Ask[];
  const threshold = thresholdFor(plan) as number;
  // One chord per bar, no loop: the pass ends when the metronome walks past the last bar.
  const progression = {
    timeSignature: [4, 4],
    bars: asks.map(ask => ({ chords: [{ symbol: ask.symbol, beat: 1 }] })),
  };
  const session = createSession(progression, { loop: false });

  let answers = $state<Array<Attempt | null>>(asks.map(() => null));
  // Minutes practised count playing, not the screen being open: the clock starts on the first
  // answer and stops when the run ends.
  let firstAnswerAt: number | null = null;
  let seconds = $state(0);
  let current = $state(0);
  let finished = $state(false);
  let timed = $state(false);
  let countIn = $state<number | null>(null);
  let at = $state<{ bar: number; beat: number } | null>(null);
  let metronome: ReturnType<typeof createMetronome> | null = null;

  const ask = $derived(finished ? null : asks[current]);
  // The chord after this one, for the screen to show beside it. A chord first seen on beat one
  // cannot be played on beat one: reading a bar ahead is what a chart allows, and what landing
  // in time needs (Edi, at the Genos, 2026-10-12). Null on the last chord.
  const next = $derived(finished ? null : asks[current + 1] ?? null);
  const attempts = $derived(asks.map((item, slot) =>
    answers[slot] ?? { symbol: item.symbol, notes: [], analysis: null, texture: item.texture }));
  const score = $derived(finished
    ? scoreRun({ attempts, timed, movementThreshold: threshold, texture: plan.texture ?? null })
    : null);

  // The one thing to fix, counted by the engine's own weak-spot rule over this run alone.
  const weakness = $derived.by(() => {
    if (!finished) return null;
    let stats = emptyStats();
    for (const attempt of attempts) {
      if (!attempt.analysis) continue;
      const chord = parseChord(attempt.symbol);
      stats = recordAttempt(stats, { key: attempt.symbol.slice(chord.root.length), chord, analysis: attempt.analysis });
    }
    return weakSpots(stats, { limit: 1 })[0] ?? null;
  });

  function timedTarget(startedAt: number | null) {
    if (!metronome) return null;
    const position = metronome.positionOf(startedAt ?? performance.now());
    const target = snapshotTarget({ mode: 'progression', session, started: true, timed: true, position });
    if (!target) return null;     // the count-in, or past the last bar: nothing to answer
    return { slot: target.slot, symbol: target.symbol, anticipated: isAnticipated(session, position, target.slot) };
  }

  function finish() {
    seconds = firstAnswerAt === null ? 0 : Math.round((performance.now() - firstAnswerAt) / 1000);
    metronome?.stop();
    metronome = null;
    countIn = null;
    at = null;
    finished = true;
  }

  function onBeat({ bar, beat, countIn: counting }: { bar: number; beat: number; countIn: boolean }) {
    if (counting) {
      countIn = beat;
      return;
    }
    countIn = null;
    const location = session.locate(bar, beat);
    if (!location) {              // walked past the last bar
      finish();
      return;
    }
    at = { bar, beat };
    current = location.index;
  }

  return {
    get plan() { return plan; },
    get threshold() { return threshold; },
    get texture() { return plan.texture ?? null; },
    get ask() { return ask; },
    get next() { return next; },
    get index() { return current; },
    get total() { return asks.length; },
    get answered() { return answers.filter(Boolean).length; },
    get finished() { return finished; },
    get timed() { return timed; },
    get countIn() { return countIn; },
    get at() { return at; },
    get score() { return score; },
    get attempts() { return attempts; },
    get seconds() { return seconds; },
    get weakness() { return weakness; },

    /**
     * A captured voicing: analysed against the chord it answers, stored in that slot, and in
     * free play followed by the next chord. Returns what was judged, for the screen to show, or
     * null when the voicing answers nothing (played during the count-in, or after the end).
     */
    answer(notes: number[], startedAt: number | null = null): Answer | null {
      if (finished) return null;
      const target = timed
        ? timedTarget(startedAt)
        : { slot: current, symbol: asks[current].symbol, anticipated: false };
      if (!target) return null;
      if (firstAnswerAt === null) firstAnswerAt = performance.now();
      // The shape demanded belongs to the rung that was answered, and timed — anticipated —
      // that need not be the rung on screen.
      const texture = asks[target.slot]?.texture ?? null;
      const analysis = analyzeVoicing(notes, parseChord(target.symbol));
      answers[target.slot] = { symbol: target.symbol, notes, analysis, texture };
      if (!timed) {
        if (current + 1 >= asks.length) finish();
        else current += 1;
      }
      return { ...target, texture, analysis };
    },

    /** Free play only: an ask nobody answered still counts, so it is stored as a miss. */
    skip() {
      if (finished || timed) return;
      answers[current] = { symbol: asks[current].symbol, notes: [], analysis: null,
                           texture: asks[current].texture };
      if (current + 1 >= asks.length) finish();
      else current += 1;
    },

    /** Starts the timed pass: a bar of count-in, then one chord per bar at the level's tempo. */
    start() {
      this.restart();
      timed = true;
      metronome = createMetronome({ tempo: plan.tempo, timeSignature: [4, 4], countInBars: 1, onBeat });
      metronome.start();
    },

    stop: finish,

    restart() {
      metronome?.stop();
      metronome = null;
      answers = asks.map(() => null);
      firstAnswerAt = null;
      seconds = 0;
      current = 0;
      finished = false;
      timed = false;
      countIn = null;
      at = null;
      session.reset?.();
    },
  };
}
