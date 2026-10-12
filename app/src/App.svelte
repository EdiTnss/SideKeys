<script lang="ts">
  import Game from './screens/Game.svelte';
  import Path from './screens/Path.svelte';
  import Today from './screens/Today.svelte';
  import Training from './screens/Training.svelte';
  import type { Attempt, Finished, LevelPlan, Unit } from './game/level.svelte';
  import type { PracticePlan } from './game/practice.svelte';
  import { createInstrument } from './lib/instrument.svelte';
  import { isClean } from './bridge/theory';
  import {
    loadProgress, saveProgress, recordRun, recordPractice, dayStamp,
    streak, secondsOn, outcomesFor, dueReviews, nextLevel, levelAfter, reviewLevel,
    recordChallenge, challengeResult, challengeLevel, challengeNumber, challengeStates,
    shareText,
  } from './bridge/game';

  /** Fifteen minutes is the daily goal until someone asks to change it. */
  const GOAL_MINUTES = 15;

  // One instrument for the whole visit, so the keyboard is connected once and stays connected
  // from one level to the next. The screens borrow it; none of them owns it.
  const instrument = createInstrument();

  // Progress lives in this browser and nowhere else for now: no account, nothing to sign up to.
  let progress = $state(loadProgress());
  let screen = $state<'today' | 'path' | 'training'>('today');
  let playing = $state<{ unit: Unit; plan: LevelPlan | PracticePlan } | null>(null);
  // What the stretch of training just finished came to, said once on the way back to its screen.
  let lastTraining = $state<{ minutes: number; played: number; clean: number } | null>(null);
  let trainingRuns = 0;

  const today = $derived(dayStamp());
  const due = $derived(dueReviews(progress, today));
  const pending = $derived(Object.keys(progress.review ?? {}).length - due.length);
  const next = $derived(nextLevel(progress.stars, progress.last));

  // The level after the one being played, offered once this one has a star. Inside a unit that
  // is what opens the next level; across units nothing is locked, but a run that earned nothing
  // should lead with "Once more", not with the way past it. Off the path there is nothing after.
  const following = $derived.by(() => {
    if (!playing || !(progress.stars[playing.plan.id] > 0)) return null;
    const after = levelAfter(playing.plan.id) as { unit: Unit; level: LevelPlan } | null;
    return after && { unit: after.unit, plan: after.level };
  });

  // The day's challenge: its number always, its grid only once it has been played. The share
  // text is built from the stored pass, never from the run just finished, so a practice run
  // cannot change what gets pasted.
  const official = $derived(challengeResult(progress, today));
  const challenge = $derived({
    number: challengeNumber(today),
    states: official?.states ?? null,
    share: official ? shareText({ number: official.number, states: official.states }) : null,
  });

  /** A finished run, filed. For the daily challenge it also hands back the grid. */
  function finish({ stars, attempts, seconds }:
                  { stars: number; attempts: Attempt[]; seconds: number }): Finished {
    if (!playing) return { grid: null, share: null, official: true };
    const { missed, cleared } = outcomesFor(attempts);
    const isChallenge = playing.unit.id === 'challenge';
    // Only the pass played cold is the official one: a replay is practice, and must not change
    // the grid someone pastes (Edi, 2026-10-11).
    const first = isChallenge && !challengeResult(progress, today);
    // A challenge run still counts as playing: the minutes, the streak and the weak spots it
    // turned up are the same as any other run’s.
    // One key for the challenge rather than one per day: its stars come from `progress.challenge`,
    // so a key per date would grow for ever and be read by nothing. The plan keeps its dated id,
    // which is what remounts the screen for a new day.
    const levelId = isChallenge ? 'challenge' : playing.plan.id;
    let filed = recordRun(progress, { levelId, stars, today, seconds, missed, cleared });
    const grid = isChallenge ? (challengeStates(attempts) as string[]) : null;
    if (first && grid) {
      filed = recordChallenge(filed, { date: today, number: challengeNumber(today), states: grid, stars });
    }
    progress = filed;
    saveProgress(progress);
    const stored = challengeResult(progress, today);
    return {
      grid,
      share: stored ? shareText({ number: stored.number, states: stored.states }) : null,
      official: first,
    };
  }

  function startChallenge() {
    const plan = challengeLevel(today) as LevelPlan;
    // Not on the path, so it carries its own one-level "unit", like the review.
    playing = { unit: { id: 'challenge', name: '', blurb: '', levels: [plan] }, plan };
  }

  function startReview() {
    const plan = reviewLevel(due.map(entry => entry.quality)) as LevelPlan;
    // The review is not on the path, so it carries its own one-level "unit".
    playing = { unit: { id: 'review', name: '', blurb: '', levels: [plan] }, plan };
  }

  /**
   * A stretch of training, filed. It is playing, so the minutes and the weak spots count; it is
   * not the path, so no star is filed and "continue" stays where it was (Edi, 2026-10-12).
   * It does not look at `playing`: the logo clears that first, and the screen only reports the
   * stretch as it is torn down.
   */
  function finishTraining({ attempts, seconds }: { attempts: Attempt[]; seconds: number }) {
    const { missed, cleared } = outcomesFor(attempts);
    progress = recordPractice(progress, { today, seconds, missed, cleared });
    saveProgress(progress);
    lastTraining = {
      minutes: Math.round(seconds / 60),
      played: attempts.length,
      clean: attempts.filter(attempt =>
        attempt.analysis && isClean(attempt.analysis, { texture: attempt.texture ?? null })).length,
    };
  }

  function startTraining(plan: Omit<PracticePlan, 'id'>) {
    trainingRuns += 1;
    // A fresh id each time, so starting again remounts the screen instead of reusing the last run.
    playing = {
      unit: { id: 'training', name: '', blurb: '', levels: [] },
      plan: { ...plan, id: `training-${trainingRuns}` },
    };
  }

  function leaveGame() {
    playing = null;
    screen = 'today';
  }
</script>

<header>
  <button type="button" class="logo" onclick={leaveGame}>
    <svg width="24" height="24" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="14" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
      <rect x="24" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
      <rect x="34" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
      <rect x="45" y="22" width="7" height="32" rx="2" fill="var(--accent)"></rect>
    </svg>
    Side<span class="accent">Keys</span>
  </button>
  <!-- The keyboard is the app's, not a level's, so it is connected here and shown on every
       screen. Once the browser has been told yes, later visits find it without being asked. -->
  <span class="midi">
    {#if instrument.hardware.length}
      <span class="dot" aria-hidden="true"></span>{instrument.hardware.join(', ')}
    {:else}
      <button type="button" class="connect" onclick={() => instrument.connect()}>Connect a MIDI keyboard</button>
    {/if}
  </span>
</header>

<main>
  {#if playing}
    {#key playing.plan.id}
      <!-- Leaving a level goes back to the screen it was opened from; the logo goes to Today. -->
      <Game unit={playing.unit} plan={playing.plan} instrument={instrument} onfinish={finish}
            onpractice={finishTraining}
            onnext={following ? () => (playing = following) : null}
            onexit={() => (playing = null)} />
    {/key}
  {:else if screen === 'path'}
    <Path stars={progress.stars} onplay={(unit, plan) => (playing = { unit, plan })} />
  {:else if screen === 'training'}
    <Training last={lastTraining} onstart={startTraining} onback={() => (screen = 'today')} />
  {:else}
    <Today
      streak={streak(progress, today)}
      minutes={Math.round(secondsOn(progress, today) / 60)}
      goal={GOAL_MINUTES}
      next={next as { unit: Unit; level: LevelPlan; stars: number } | null}
      reviews={due}
      pending={pending}
      challenge={challenge}
      onplay={(unit, plan) => (playing = { unit, plan })}
      onreview={startReview}
      onchallenge={startChallenge}
      ontraining={() => (screen = 'training')}
      onpath={() => (screen = 'path')} />
  {/if}
</main>

<style>
  header {
    display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
    padding: 16px 32px; border-bottom: 1px solid var(--border);
  }
  .logo {
    display: flex; align-items: center; gap: 10px;
    padding: 0; border: none; background: none; cursor: pointer;
    font-family: inherit; font-weight: 600; font-size: 17px; letter-spacing: -0.03em; color: var(--ink);
  }
  .logo:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 6px; }
  .accent { color: var(--accent); }
  .midi {
    margin-left: auto; display: inline-flex; align-items: center; gap: 8px;
    font-size: 13px; color: var(--ink-muted);
  }
  /* The same green the status line under the keyboard already uses for "MIDI in". */
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--chord-tone); }
  .connect {
    padding: 6px 12px; border: 1px solid var(--accent); border-radius: 8px;
    background: none; color: var(--ink); font: inherit; font-size: 13px; cursor: pointer;
  }
  .connect:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
