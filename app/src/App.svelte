<script lang="ts">
  import Game from './screens/Game.svelte';
  import Path from './screens/Path.svelte';
  import Today from './screens/Today.svelte';
  import type { Attempt, Finished, LevelPlan, Unit } from './game/level.svelte';
  import { xpFor } from './bridge/theory';
  import {
    loadProgress, saveProgress, recordRun, playsToday, dayStamp,
    streak, secondsOn, outcomesFor, dueReviews, nextLevel, reviewLevel,
    recordChallenge, challengeResult, challengeLevel, challengeNumber, challengeStates,
    shareText, CHALLENGE_DIFFICULTY,
  } from './bridge/game';

  /** Fifteen minutes is the daily goal until someone asks to change it. */
  const GOAL_MINUTES = 15;

  // Progress lives in this browser and nowhere else for now: no account, nothing to sign up to.
  let progress = $state(loadProgress());
  let screen = $state<'today' | 'path'>('today');
  let playing = $state<{ unit: Unit; plan: LevelPlan } | null>(null);

  const today = $derived(dayStamp());
  const due = $derived(dueReviews(progress, today));
  const pending = $derived(Object.keys(progress.review ?? {}).length - due.length);
  const next = $derived(nextLevel(progress.stars));

  // The day's challenge: its number always, its grid only once it has been played. The share
  // text is built from the stored pass, never from the run just finished, so a practice run
  // cannot change what gets pasted.
  const official = $derived(challengeResult(progress, today));
  const challenge = $derived({
    number: challengeNumber(today),
    states: official?.states ?? null,
    share: official ? shareText({ number: official.number, states: official.states }) : null,
  });

  /**
   * A finished run, priced and filed. The XP is worked out *before* the run is recorded, because
   * the price depends on how many times this level has already paid out today.
   */
  function finish({ stars, attempts, seconds }:
                  { stars: number; attempts: Attempt[]; seconds: number }): Finished {
    if (!playing) return { xp: 0, grid: null, share: null, official: true };
    const { missed, cleared } = outcomesFor(attempts);
    const isChallenge = playing.unit.id === 'challenge';
    // The challenge pays on the pass played cold and never again that day: a replay is
    // practice (Edi, 2026-10-11). A level instead pays less the second time, which is what
    // `playsToday` is for, so the two caps stay separate rather than one pretending to be both.
    const first = isChallenge && !challengeResult(progress, today);
    const xp = isChallenge && !first ? 0 : xpFor({
      stars,
      difficulty: playing.unit.difficulty,
      playsToday: isChallenge ? 0 : playsToday(progress, playing.plan.id, today),
    });
    // A challenge run still counts as playing: the minutes, the streak and the weak spots it
    // turned up are the same as any other run’s.
    let filed = recordRun(progress, { levelId: playing.plan.id, stars, xp, today, seconds, missed, cleared });
    const grid = isChallenge ? (challengeStates(attempts) as string[]) : null;
    if (first && grid) {
      filed = recordChallenge(filed, { date: today, number: challengeNumber(today), states: grid, stars, xp });
    }
    progress = filed;
    saveProgress(progress);
    const stored = challengeResult(progress, today);
    return {
      xp,
      grid,
      share: stored ? shareText({ number: stored.number, states: stored.states }) : null,
      official: first,
    };
  }

  function startChallenge() {
    const plan = challengeLevel(today) as LevelPlan;
    // Not on the path, so it carries its own one-level "unit" for the XP price, like the review.
    playing = {
      unit: { id: 'challenge', name: '', blurb: '', difficulty: CHALLENGE_DIFFICULTY, levels: [plan] },
      plan,
    };
  }

  function startReview() {
    const plan = reviewLevel(due.map(entry => entry.quality)) as LevelPlan & { difficulty: number };
    // The review is not on the path, so it carries its own one-level "unit" for the XP price.
    playing = { unit: { id: 'review', name: '', blurb: '', difficulty: plan.difficulty, levels: [plan] }, plan };
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
  <span class="tag">{progress.xp} XP</span>
</header>

<main>
  {#if playing}
    {#key playing.plan.id}
      <Game unit={playing.unit} plan={playing.plan} onfinish={finish} onexit={leaveGame} />
    {/key}
  {:else if screen === 'path'}
    <Path stars={progress.stars} xp={progress.xp} onplay={(unit, plan) => (playing = { unit, plan })} />
  {:else}
    <Today
      streak={streak(progress, today)}
      minutes={Math.round(secondsOn(progress, today) / 60)}
      goal={GOAL_MINUTES}
      xp={progress.xp}
      next={next as { unit: Unit; level: LevelPlan; stars: number } | null}
      reviews={due}
      pending={pending}
      challenge={challenge}
      onplay={(unit, plan) => (playing = { unit, plan })}
      onreview={startReview}
      onchallenge={startChallenge}
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
  .tag { margin-left: auto; font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink-muted); }
</style>
