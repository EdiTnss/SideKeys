<script lang="ts">
  import type { LevelPlan, Unit } from '../game/level.svelte';
  import { SQUARES } from '../bridge/game';
  import { copyText } from '../lib/clipboard';
  import Glossed from '../lib/Glossed.svelte';
  import Path from './Path.svelte';
  import { sayLevel, sayUnit, t } from '../lib/locale.svelte';

  type Review = { quality: string; misses: number; hits: number };
  type Challenge = { number: number; states: string[] | null; share: string | null };

  // The Play door (docs/spec-ui.md): one obvious step, the day's two short things beside it, and
  // the whole path under them. Nothing here is shown before it means something.
  let { stars, minutes, goal, played, next, reviews, challenge, onplay, onreview, onchallenge, ontheory }: {
    stars: Record<string, number>;
    minutes: number;
    goal: number;
    /** Whether anything has ever been played here: before that, minutes are not news. */
    played: boolean;
    next: { unit: Unit; level: LevelPlan; stars: number; played: boolean } | null;
    /** Due today. The tile is there only when this is not empty. */
    reviews: Review[];
    /** The day's challenge: its number, and the official grid once it has been played. */
    challenge: Challenge;
    onplay: (unit: Unit, level: LevelPlan) => void;
    onreview: () => void;
    onchallenge: () => void;
    ontheory: (unit: string) => void;
  } = $props();

  const pct = $derived(Math.min(100, Math.round((100 * minutes) / goal)));
  const clean = $derived(challenge.states?.filter(state => state === 'clean').length ?? 0);
  const at = $derived(next ? next.unit.levels.findIndex(level => level.id === next.level.id) + 1 : 0);
  // "Start here" until the level has been played at all: "continue" a thing never begun is a lie.
  const started = $derived(next ? next.played || played : false);

  let copied = $state(false);
  let showText = $state(false);

  async function copy() {
    if (!challenge.share) return;
    copied = await copyText(challenge.share);
    showText = !copied;
  }
</script>

{#snippet starRow(count: number)}
  <span class="stars" role="img" aria-label={t('common.starsOf3', { count })}>
    {#each [1, 2, 3] as position (position)}
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"
           fill={position <= count ? 'var(--ink)' : 'none'}
           stroke={position <= count ? 'none' : '#3a4046'} stroke-width="2">
        <path d="M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.7l-5.9 3.1 1.2-6.6L2.5 9.6l6.6-.9z"></path>
      </svg>
    {/each}
  </span>
{/snippet}

<section class="home">
  <h1 class="hidden">{t('home.title')}</h1>

  {#if played}
    <div class="today">
      <span>{t('home.today', { minutes, goal })}</span>
      <span class="track"><span class="fill" style="width: {pct}%"></span></span>
    </div>
  {/if}

  <div class="columns">
    <div class="main">
      {#if next}
        <section class="hero">
          <p class="kicker">{started ? t('home.continue') : t('home.startHere')}</p>
          <h2><Glossed text={sayUnit(next.unit)} /></h2>
          <p class="line">
            <Glossed text={sayLevel(next.level)} /> · {t('home.levelOf', { at, total: next.unit.levels.length })}
          </p>
          {#if next.played}
            <p class="line">
              {@render starRow(next.stars)}
              {#if next.stars === 2}{t('home.thirdOnClock')}{:else if next.stars === 0}{t('today.noStars')}{/if}
            </p>
          {/if}
          <button type="button" class="go" onclick={() => onplay(next.unit, next.level)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6L19 12z"></path></svg>
            {t('today.play')}
          </button>
        </section>
      {:else}
        <section class="hero">
          <h2>{t('today.allDone')}</h2>
          <p class="line">{t('today.allDoneLine')}</p>
        </section>
      {/if}

      <div class="tiles" class:single={!reviews.length}>
        <section class="tile">
          <div class="title">
            <h2>{t('today.challenge')} <span class="number">#{challenge.number}</span></h2>
            {#if !challenge.states}<span class="badge">{t('home.new')}</span>{/if}
          </div>
          {#if challenge.states}
            <p class="squares" role="img" aria-label={t('today.cleanOf', { clean, total: challenge.states.length })}>
              {challenge.states.map(state => SQUARES[state as keyof typeof SQUARES] ?? SQUARES.unplayed).join('')}
            </p>
            <div class="row">
              <button type="button" onclick={copy}>{copied ? t('common.copied') : t('common.copyResult')}</button>
              <button type="button" onclick={onchallenge}>{t('today.playAgain')}</button>
            </div>
            {#if showText && challenge.share}
              <pre class="text">{challenge.share}</pre>
            {/if}
          {:else}
            <p class="small">{t('home.challengeLine')}</p>
            <button type="button" onclick={onchallenge}>{t('today.playChallenge')}</button>
          {/if}
        </section>

        {#if reviews.length}
          <section class="tile">
            <div class="title">
              <h2>{t('today.review')}</h2>
              <span class="due">{reviews.length}</span>
            </div>
            <p class="small">{t('home.reviewLine', { count: reviews.length })}</p>
            <button type="button" onclick={onreview}>{t('today.startReview')}</button>
          </section>
        {/if}
      </div>
    </div>

    <section class="side">
      <div class="title">
        <h2>{t('home.path')}</h2>
        <span class="small">{t('home.allOpen')}</span>
      </div>
      <Path stars={stars} current={next?.level.id ?? null} onplay={onplay} ontheory={ontheory} />
    </section>
  </div>
</section>

<style>
  .home { max-width: 1120px; margin: 0 auto; padding: 32px 40px 48px; }
  .hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .today { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; font-size: 13px; color: var(--ink-muted); }
  .track { flex: 1; max-width: 220px; height: 5px; border-radius: 999px; background: var(--border); overflow: hidden; }
  .fill { display: block; height: 100%; border-radius: 999px; background: var(--ink); }
  .columns { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 24px; align-items: start; }
  .main { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
  .hero {
    border: 1px solid var(--border); border-radius: 20px; padding: 26px 28px;
    background: linear-gradient(180deg, #16191c 0%, #101214 100%);
  }
  .kicker, .small, .line { color: var(--ink-muted); }
  .kicker { margin: 0 0 6px; font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; }
  .hero h2 { margin: 0 0 6px; font-size: 32px; font-weight: 600; letter-spacing: -0.03em; }
  .line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 14px; }
  .stars { display: inline-flex; gap: 2px; }
  .go {
    margin-top: 16px; min-height: 52px; padding: 0 30px; border-color: var(--ink);
    background: var(--ink); color: #14171a; font-size: 16px; font-weight: 600;
  }
  .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .tiles.single { grid-template-columns: minmax(0, 1fr); }
  .tile { border: 1px solid var(--border); border-radius: 16px; background: var(--surface); padding: 18px; }
  .title { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .tile h2, .side h2 { margin: 0 0 6px; font-size: 16px; font-weight: 600; }
  .side h2 { font-size: 18px; }
  .number { font-family: ui-monospace, monospace; font-size: 12px; font-weight: 400; color: var(--ink-muted); }
  .badge {
    padding: 2px 8px; border-radius: 8px; background: var(--accent); color: #0a0b0c;
    font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
  }
  .due { font-size: 14px; font-weight: 600; color: var(--avoid); }
  .small { margin: 0 0 14px; font-size: 13px; line-height: 1.45; }
  .squares { margin: 4px 0 12px; font-size: 22px; line-height: 1.15; letter-spacing: 2px; word-break: break-all; }
  .row { display: flex; flex-wrap: wrap; gap: 10px; }
  .text {
    margin: 12px 0 0; padding: 12px; border: 1px solid var(--border); border-radius: 10px;
    background: #16191c; white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: 13px; user-select: all;
  }
  .side { border: 1px solid var(--border); border-radius: 20px; background: var(--surface); padding: 20px 12px 10px; min-width: 0; }
  .side .title { padding: 0 10px 6px; }
  button {
    display: inline-flex; align-items: center; justify-content: center; gap: 9px;
    min-height: 44px; padding: 0 18px; border: 1px solid var(--border); border-radius: 12px;
    background: #16191c; color: var(--ink); font: inherit; font-size: 14px; cursor: pointer;
  }
  button:hover { border-color: var(--ink-muted); }
  button.go:hover { border-color: var(--ink); filter: brightness(0.95); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  @media (max-width: 960px) {
    .columns { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 759px) {
    .home { padding: 16px 16px 28px; }
    .hero { padding: 20px; }
    .hero h2 { font-size: 26px; }
    .go { width: 100%; }
    .tile { padding: 14px; }
    .side { border: none; background: none; padding: 6px 0 0; }
    .side .title { padding: 0 0 6px; }
  }
  @media (max-width: 420px) {
    .tiles { grid-template-columns: minmax(0, 1fr); }
  }
</style>
