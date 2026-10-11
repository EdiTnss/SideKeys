<script lang="ts">
  import Game from './screens/Game.svelte';
  import Path from './screens/Path.svelte';
  import Today from './screens/Today.svelte';
  import type { LevelPlan, Unit } from './game/level.svelte';
  import { xpFor } from './bridge/theory';
  import {
    loadProgress, saveProgress, recordRun, playsToday, dayStamp,
    streak, secondsOn, outcomesFor, dueReviews, nextLevel, reviewLevel,
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

  /**
   * A finished run, priced and filed. The XP is worked out *before* the run is recorded, because
   * the price depends on how many times this level has already paid out today.
   */
  function finish({ stars, attempts, seconds }: { stars: number; attempts: unknown[]; seconds: number }) {
    if (!playing) return 0;
    const { missed, cleared } = outcomesFor(attempts);
    const xp = xpFor({
      stars,
      difficulty: playing.unit.difficulty,
      playsToday: playsToday(progress, playing.plan.id, today),
    });
    progress = recordRun(progress, { levelId: playing.plan.id, stars, xp, today, seconds, missed, cleared });
    saveProgress(progress);
    return xp;
  }

  function startReview() {
    const plan = reviewLevel(due.map(entry => entry.quality)) as LevelPlan & { difficulty: number };
    // The review is not on the path, so it carries its own one-level "unit" for the XP price.
    playing = { unit: { id: 'review', name: 'Your training', blurb: '', difficulty: plan.difficulty, levels: [plan] }, plan };
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
      onplay={(unit, plan) => (playing = { unit, plan })}
      onreview={startReview}
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
