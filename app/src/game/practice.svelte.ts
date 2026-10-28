// One stretch of Training: a progression that loops, the attempts as they come, and the clock
// for as long as it is wanted.
//
// It has the shape of a level on purpose (`Run`, in level.svelte.ts), so the game screen drives
// either without asking which it is: the chord asked for, the one after it, where the clock
// stands, and `answer`. What it leaves out is everything a level ends in — stars, a score, a
// result screen. Training ends when the player walks away from it.
//
// Which chord a voicing answers is decided exactly as in a level, by `snapshotTarget`, so the
// anticipation rule is one rule here, on the path and in the harness.

import { parseChord, analyzeVoicing, judgeAsk, isRight, isClean, counts, compareVoicings } from '../bridge/theory';
import { createMetronome, createSession, snapshotTarget, isAnticipated } from '../bridge/time';
import type { Answer, Ask, Attempt, Run } from './level.svelte';

/** What `trainingPlan` hands over, plus the id the app gives it so a new start remounts the screen. */
export type PracticePlan = {
  id: string;
  name: string;
  tempo: number;
  endless: true;
  mode: 'drill' | 'progression';
  /** The shape a drill demands of every chord, or null. A progression demands none. */
  texture: string | string[] | null;
  progression: { timeSignature: number[]; bars: Array<{ chords: Array<{ symbol: string; beat: number }> }> };
};

/** How far the voices travelled from the chord before, for a progression: its whole point. */
export type Movement = { from: string; average: number; rating: 'smooth' | 'ok' | 'jumpy' };

export type Practice = Run & {
  readonly mode: 'drill' | 'progression';
  readonly played: number;
  readonly clean: number;
  readonly movement: Movement | null;
  /** Ends the stretch: the clock stops and the seconds played are worked out. */
  end(): void;
};

export function createPractice(plan: PracticePlan): Practice {
  const session = createSession(plan.progression, { loop: true });
  const asks: Ask[] = session.slots.map((slot: { symbol: string }) => ({ symbol: slot.symbol, texture: plan.texture }));
  const barCount = plan.progression.bars.length;

  // Every attempt in the order it was played. Not reactive: only the counts are shown, and
  // the list itself is read once, when the stretch is filed.
  const history: Attempt[] = [];
  let played = $state(0);
  let clean = $state(0);
  let movement = $state<Movement | null>(null);
  let current = $state(0);
  let finished = $state(false);
  let timed = $state(false);
  let countIn = $state<number | null>(null);
  let at = $state<{ bar: number; beat: number } | null>(null);
  let seconds = $state(0);
  // Minutes practised count playing, not the screen being open: from the first answer to the
  // last one, so a keyboard left alone for a quarter of an hour is not a quarter of an hour.
  let firstAnswerAt: number | null = null;
  let lastAnswerAt: number | null = null;
  let metronome: ReturnType<typeof createMetronome> | null = null;
  // On the clock, which time round each chord was last answered: a bar keeps its first answer,
  // and in a loop "this bar" is a chord and a chorus, not a chord alone.
  const standing = new Map<number, number>();

  const ask = $derived(finished ? null : asks[current]);
  // On the clock the next bar is the next bar, even when it holds the same chord. Without one,
  // a chord already answered is not asked for again, so the next one is the next *change*.
  const next = $derived(finished ? null : asks[timed ? (current + 1) % asks.length : following(current)]);

  /** The slot after `from` that holds another chord; `from` itself when there is only one. */
  function following(from: number) {
    for (let step = 1; step < asks.length; step += 1) {
      const slot = (from + step) % asks.length;
      if (asks[slot].symbol !== asks[from].symbol) return slot;
    }
    return (from + 1) % asks.length;
  }

  function timedTarget(startedAt: number | null) {
    if (!metronome) return null;
    const position = metronome.positionOf(startedAt ?? performance.now());
    const target = snapshotTarget({ mode: 'progression', session, started: true, timed: true, position });
    if (!target) return null;     // the count-in: there is no chord before the first one
    const anticipated = isAnticipated(session, position, target.slot);
    // An anticipated voicing answers the bar after the one it started in.
    const chorus = Math.floor((position.bar - 1 + (anticipated ? 1 : 0)) / barCount);
    return { slot: target.slot, symbol: target.symbol, anticipated, chorus };
  }

  function stopClock() {
    metronome?.stop();
    metronome = null;
    timed = false;
    countIn = null;
    at = null;
  }

  function onBeat({ bar, beat, countIn: counting }: { bar: number; beat: number; countIn: boolean }) {
    if (counting) {
      countIn = beat;
      return;
    }
    countIn = null;
    const location = session.locate(bar, beat);
    if (!location) return;
    // The bar inside the chorus, which is the one written on a chart: bar 13 of a blues is bar 1.
    at = { bar: ((bar - 1) % barCount) + 1, beat };
    current = location.index;
  }

  return {
    get plan() { return plan; },
    get mode() { return plan.mode; },
    get ask() { return ask; },
    get next() { return next; },
    get index() { return current; },
    get total() { return asks.length; },
    get answered() { return played; },
    get played() { return played; },
    get clean() { return clean; },
    get movement() { return movement; },
    get finished() { return finished; },
    get timed() { return timed; },
    get countIn() { return countIn; },
    get at() { return at; },
    get attempts() { return history; },
    get seconds() { return seconds; },
    // A level ends in these three; training has no end to earn them at.
    get score() { return null; },
    get weakness() { return null; },
    get threshold() { return 0; },

    answer(notes: number[], startedAt: number | null = null): Answer | null {
      if (finished) return null;
      const target = timed
        ? timedTarget(startedAt)
        : { slot: current, symbol: asks[current].symbol, anticipated: false, chorus: 0 };
      if (!target) return null;
      const { chorus, ...where } = target;
      const now = performance.now();
      firstAnswerAt ??= now;
      lastAnswerAt = now;
      const analysis = judgeAsk(notes, target.symbol);
      // On the clock a bar keeps its first answer: a second voicing in it is judged and shown,
      // but it is not counted, and what it got wrong is not held against the chord.
      const counted = counts({ timed, answered: timed && standing.get(target.slot) === chorus });
      if (!counted) {
        movement = null;
        return { ...where, texture: plan.texture, analysis, counted };
      }
      if (timed) standing.set(target.slot, chorus);
      const before = history.at(-1);
      // Only a change of chord is a step to measure: the same chord struck twice went nowhere.
      const compared = plan.mode === 'progression' && before && before.symbol !== target.symbol && before.notes.length
        ? compareVoicings(before.notes, notes)
        : null;
      movement = compared?.rating
        ? { from: before!.symbol, average: compared.averageMove, rating: compared.rating as Movement['rating'] }
        : null;
      history.push({ symbol: target.symbol, notes, analysis, texture: plan.texture });
      played += 1;
      if (isClean(analysis, { texture: plan.texture })) clean += 1;
      // As on the path: without the clock a miss stays on the chord until it is played right.
      if (!timed && isRight(analysis, { texture: plan.texture })) current = following(target.slot);
      return { ...where, texture: plan.texture, analysis, counted };
    },

    /** Without the clock: on to the next chord, and nothing is held against the one passed over. */
    skip() {
      if (finished || timed) return;
      movement = null;
      current = following(current);
    },

    /** Starts the clock from the top: a bar of count-in, then the progression in time, round and round. */
    start() {
      stopClock();
      standing.clear();
      current = 0;
      movement = null;
      timed = true;
      metronome = createMetronome({
        tempo: plan.tempo,
        timeSignature: plan.progression.timeSignature,
        countInBars: 1,
        onBeat,
      });
      metronome.start();
    },

    /** Stops the clock and nothing else: the stretch goes on, without it, from the chord it was on. */
    stop: stopClock,

    /** A level starts over; a stretch of training has no beginning to go back to. */
    restart() {},

    end() {
      stopClock();
      seconds = firstAnswerAt === null || lastAnswerAt === null ? 0 : Math.round((lastAnswerAt - firstAnswerAt) / 1000);
      finished = true;
    },

    dispose: stopClock,
  };
}
