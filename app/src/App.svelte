<script lang="ts">
  import Game from './screens/Game.svelte';
  import Path from './screens/Path.svelte';
  import type { LevelPlan } from './game/level.svelte';
  import { xpFor } from './bridge/theory';
  import { loadProgress, saveProgress, recordRun, playsToday, dayStamp } from './bridge/game';

  type Unit = { id: string; name: string; blurb: string; difficulty: number; levels: LevelPlan[] };

  // Progress lives in this browser and nowhere else for now: no account, nothing to sign up to.
  let progress = $state(loadProgress());
  let playing = $state<{ unit: Unit; plan: LevelPlan } | null>(null);

  /**
   * A finished run, priced and filed. The XP has to be worked out *before* the run is recorded,
   * because the price depends on how many times this level already paid out today.
   */
  function finish(stars: number) {
    if (!playing) return 0;
    const today = dayStamp();
    const xp = xpFor({
      stars,
      difficulty: playing.unit.difficulty,
      playsToday: playsToday(progress, playing.plan.id, today),
    });
    progress = recordRun(progress, { levelId: playing.plan.id, stars, xp, today });
    saveProgress(progress);
    return xp;
  }
</script>

<header>
  <span class="logo">
    <svg width="24" height="24" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="14" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
      <rect x="24" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
      <rect x="34" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
      <rect x="45" y="22" width="7" height="32" rx="2" fill="var(--accent)"></rect>
    </svg>
    Side<span class="accent">Keys</span>
  </span>
  <span class="tag">{progress.xp} XP</span>
</header>

<main>
  {#if playing}
    {#key playing.plan.id}
      <Game unit={playing.unit} plan={playing.plan} onfinish={finish} onexit={() => (playing = null)} />
    {/key}
  {:else}
    <Path stars={progress.stars} xp={progress.xp}
          onplay={(unit, plan) => (playing = { unit: unit as Unit, plan: plan as LevelPlan })} />
  {/if}
</main>

<style>
  header {
    display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
    padding: 16px 32px; border-bottom: 1px solid var(--border);
  }
  .logo {
    display: flex; align-items: center; gap: 10px;
    font-weight: 600; font-size: 17px; letter-spacing: -0.03em; color: var(--ink);
  }
  .accent { color: var(--accent); }
  .tag { margin-left: auto; font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink-muted); }
</style>
