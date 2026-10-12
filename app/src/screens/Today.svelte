<script lang="ts">
  import type { LevelPlan, Unit } from '../game/level.svelte';
  import { SQUARES } from '../bridge/game';
  import { copyText } from '../lib/clipboard';

  type Review = { quality: string; misses: number; hits: number };
  type Challenge = { number: number; states: string[] | null; share: string | null };

  let { streak, minutes, goal, next, reviews, pending, challenge,
        onplay, onreview, onchallenge, ontraining, ontheory, onpath }: {
    streak: number;
    minutes: number;
    goal: number;
    next: { unit: Unit; level: LevelPlan; stars: number } | null;
    reviews: Review[];
    /** Queued but not due yet — missed today, back tomorrow. Saying "nothing due" would lie. */
    pending: number;
    /** The day's challenge: its number, and the official grid once it has been played. */
    challenge: Challenge;
    onplay: (unit: Unit, level: LevelPlan) => void;
    onreview: () => void;
    onchallenge: () => void;
    ontraining: () => void;
    ontheory: () => void;
    onpath: () => void;
  } = $props();

  const pct = $derived(Math.min(100, Math.round((100 * minutes) / goal)));
  const clean = $derived(challenge.states?.filter(state => state === 'clean').length ?? 0);

  let copied = $state(false);
  let showText = $state(false);

  async function copy() {
    if (!challenge.share) return;
    copied = await copyText(challenge.share);
    showText = !copied;
  }
</script>

<section class="today">
  <header class="head">
    <div>
      <h1>Today</h1>
      <p class="sub">Three things. Nothing else.</p>
    </div>
  </header>

  <div class="columns">
    <div class="main">
      {#if next}
        <section class="card hero">
          <p class="kicker">Continue the path</p>
          <h2>{next.unit.name} — {next.level.name}</h2>
          <p class="line">
            {#if next.stars === 0}Not played yet.{:else}{next.stars} of 3 stars so far.{/if}
            {next.level.tempo} bpm, one chord to the bar.
          </p>
          <button type="button" class="go" onclick={() => onplay(next.unit, next.level)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6L19 12z"></path></svg>
            Play
          </button>
        </section>
      {:else}
        <section class="card hero">
          <h2>Every open level is at three stars.</h2>
          <p class="line">Open the path and pick one to go over again.</p>
          <button type="button" class="go" onclick={onpath}>Open the path</button>
        </section>
      {/if}

      <section class="card">
        <div class="title">
          <h2>Daily challenge</h2>
          <span class="count">#{challenge.number}</span>
        </div>
        {#if challenge.states}
          <p class="squares" role="img" aria-label="{clean} of {challenge.states.length} chords clean">
            {challenge.states.map(state => SQUARES[state as keyof typeof SQUARES] ?? SQUARES.unplayed).join('')}
          </p>
          <p class="line">{clean} of {challenge.states.length} clean. Played — the grid is yours to paste.</p>
          <div class="row">
            <button type="button" onclick={copy}>{copied ? 'Copied' : 'Copy result'}</button>
            <button type="button" onclick={onchallenge}>Play again</button>
          </div>
          {#if showText && challenge.share}
            <pre class="text">{challenge.share}</pre>
          {/if}
        {:else}
          <p class="line">
            Ten chords, a triad up to a quartal — the same ten for everyone today. No clock, and
            the first pass is the one that counts.
          </p>
          <button type="button" onclick={onchallenge}>Play the challenge</button>
        {/if}
      </section>

      <section class="card">
        <div class="title">
          <!-- "Your training" until 2026-10-12, when Training became the name of free practice. -->
          <h2>Review</h2>
          <span class="count">{reviews.length} due</span>
        </div>
        {#if reviews.length}
          <ul class="spots">
            {#each reviews as review (review.quality)}
              <li>
                <code>{review.quality || 'major triad'}</code>
                <span class="misses">missed {review.misses} time{review.misses === 1 ? '' : 's'}</span>
                <span class="hits">{review.hits} of 3 clean</span>
              </li>
            {/each}
          </ul>
          <button type="button" onclick={onreview}>Start review — 12 chords</button>
        {:else if pending > 0}
          <p class="line">
            Nothing due today. {pending} {pending === 1 ? 'spot comes' : 'spots come'} back tomorrow —
            sleeping on it is the point.
          </p>
        {:else}
          <p class="line">Nothing due. Anything you missed has come back clean three times.</p>
        {/if}
      </section>
    </div>

    <div class="side">
      <section class="card">
        <div class="streak">
          <p class="big">{streak}</p>
          <p class="line">{streak === 1 ? 'day' : 'days'} in a row</p>
        </div>
        <div class="goal">
          <div class="track"><span class="fill" style="width: {pct}%"></span></div>
          <p class="line">{minutes} of {goal} minutes today</p>
        </div>
      </section>

      <section class="card">
        <h2>The path</h2>
        <p class="line">Eight units, triads through ii–V–I.</p>
        <button type="button" onclick={onpath}>Open the map</button>
      </section>

      <!-- Beside the day's three things, not among them: it is where to go when none of them
           is what is wanted, and it asks for nothing back. -->
      <section class="card">
        <h2>Training</h2>
        <p class="line">Drill any chords, or loop a progression. No stars — it still counts for today.</p>
        <button type="button" onclick={ontraining}>Open training</button>
      </section>

      <section class="card">
        <h2>Theory</h2>
        <p class="line">What a shell, a rootless voicing, a drop 2 and a quartal are — with examples you can hear.</p>
        <button type="button" onclick={ontheory}>Open the lessons</button>
      </section>
    </div>
  </div>

  <p class="credit">
    Piano:
    <a href="https://archive.org/details/SalamanderGrandPianoV3" target="_blank" rel="noreferrer">
      Salamander Grand Piano</a>
    by Alexander Holm, one velocity layer kept —
    <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>
  </p>
</section>

<style>
  .today { max-width: 900px; margin: 0 auto; padding: 32px 32px 56px; }
  .head { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; margin-bottom: 26px; }
  .head div { flex: 999 1 320px; }
  h1 { margin: 0 0 6px; font-size: 30px; font-weight: 600; letter-spacing: -0.03em; }
  .sub { margin: 0; color: var(--ink-muted); font-size: 15px; }
  .columns { display: flex; flex-wrap: wrap; gap: 20px; }
  .main { flex: 999 1 420px; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
  .side { flex: 1 1 260px; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
  .card { border: 1px solid var(--border); border-radius: 16px; background: var(--surface); padding: 22px 24px; }
  .hero { background: linear-gradient(180deg, #16191c 0%, #101214 100%); }
  .kicker { margin: 0 0 6px; font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted); }
  h2 { margin: 0 0 6px; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
  .title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; }
  .title h2 { flex-grow: 1; margin-bottom: 10px; }
  .count { font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink-muted); }
  .line { margin: 0 0 16px; font-size: 14px; color: var(--ink-muted); }
  .spots { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .spots li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; font-size: 14px; }
  code { font-family: ui-monospace, monospace; color: var(--ink); min-width: 64px; }
  .misses { color: var(--ink-muted); flex-grow: 1; }
  .hits { font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink-muted); }
  .squares { margin: 0 0 10px; font-size: 24px; line-height: 1.15; letter-spacing: 2px; word-break: break-all; }
  .row { display: flex; flex-wrap: wrap; gap: 12px; }
  .text {
    margin: 14px 0 0; padding: 12px; border: 1px solid var(--border); border-radius: 10px;
    background: #16191c; white-space: pre-wrap; font-family: ui-monospace, monospace;
    font-size: 13px; user-select: all;
  }
  .credit { margin: 28px 0 0; font-size: 12px; color: var(--ink-muted); }
  .credit a { color: inherit; }
  .credit a:hover { color: var(--ink); }
  .streak { display: flex; align-items: baseline; gap: 10px; margin-bottom: 18px; }
  .big { margin: 0; font-family: ui-monospace, monospace; font-size: 38px; font-weight: 600; line-height: 1; }
  .streak .line { margin: 0; }
  .goal .track { height: 6px; border-radius: 999px; background: var(--border); overflow: hidden; margin-bottom: 8px; }
  .goal .fill { display: block; height: 6px; border-radius: 999px; background: var(--chord-tone); }
  .goal .line { margin: 0; }
  button {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 11px 20px; border: 1px solid var(--border); border-radius: 10px;
    background: #16191c; color: var(--ink); font: inherit; font-size: 14px; cursor: pointer;
  }
  button:hover { border-color: var(--ink-muted); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button.go { background: var(--ink); color: #14171a; border-color: var(--ink); font-size: 16px; font-weight: 600; padding: 14px 26px; }
</style>
