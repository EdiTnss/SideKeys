<script lang="ts">
  import type { scoreRun } from '../bridge/theory';
  import { SQUARES } from '../bridge/game';
  import { copyText } from '../lib/clipboard';
  import Glossed from '../lib/Glossed.svelte';
  import { sayDecimal, sayProblem, t } from '../lib/locale.svelte';
  import { verdictSound } from '../lib/verdictSound.svelte';
  import { onMount } from 'svelte';

  type Score = NonNullable<ReturnType<typeof scoreRun>>;
  type Weakness = { key: string; problem: string; count: number; kind: string; degree: string | null } | null;

  let { name, score, weakness, timed, threshold, tempo, grid = null, share = null,
        official = true, before = 0, onagain, ontimed = null, onpractise = null, onhow = null, onnext = null, onexit }: {
    name: string;
    score: Score;
    weakness: Weakness;
    timed: boolean;
    threshold: number;
    /** The level's tempo, said on the way to the third star. */
    tempo: number;
    /** One square per chord, for the daily challenge. A level has none. */
    grid?: string[] | null;
    /** The text the button copies — always the official pass, so a replay cannot inflate it. */
    share?: string | null;
    /** False on a replay of a challenge already played today. */
    official?: boolean;
    /** The level's stars before this pass. */
    before?: number;
    onagain: () => void;
    /** The same level on the clock: offered when two stars are in and the third needs it. */
    ontimed?: (() => void) | null;
    /** A drill on the weak spot, when there is one. */
    onpractise?: (() => void) | null;
    /** The page that explains what this level asks for. */
    onhow?: (() => void) | null;
    /** The level after this one, when this run opened it (or it was open already). */
    onnext?: (() => void) | null;
    onexit: () => void;
  } = $props();

  const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

  // The stars fill one by one, each with a knock and a few sparks, and a new record is crowned
  // after the last (review of 2026-10-30, #18; Edi chose S1 "Sparks" on 2026-11-02). Zero stars
  // stay still and silent. The challenge has no record of its own here, so it is never crowned.
  const FIRST = 250;
  const GAP = 300;
  const SPARKS = [0, 1, 2, 3, 4, 5];
  let shown = $state(0);
  let crowned = $state(false);
  // `before` arrives a moment after the screen does (Game files the run in an effect), so this is
  // read when the crown is due, not when the screen opens.
  const newBest = $derived(!grid && score.stars > before);

  onMount(() => {
    const count = score.stars;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let n = 0; n < count; n += 1) {
      timers.push(setTimeout(() => { shown = n + 1; verdictSound.star(n); }, FIRST + n * GAP));
    }
    timers.push(setTimeout(() => {
      if (!newBest) return;
      crowned = true;
      verdictSound.best();
    }, FIRST + count * GAP + 120));
    return () => timers.forEach(clearTimeout);
  });

  const spark = (position: number, at: number) => {
    const angle = (Math.PI * 2 * at) / SPARKS.length + position;
    const reach = 30 + ((position * 7 + at * 5) % 12);
    return `--dx: ${(Math.cos(angle) * reach).toFixed(1)}px; --dy: ${(Math.sin(angle) * reach).toFixed(1)}px`;
  };

  let copied = $state(false);
  let showText = $state(false);

  async function copy() {
    if (!share) return;
    copied = await copyText(share);
    // A clipboard that refuses is nobody's fault, so put the text on screen to copy by hand.
    showText = !copied;
  }
</script>

<section class="result">
 <div class="summary">
  <!-- White, not magenta and not a theory colour: the accent never lands in a verdict, and an
       amber star would read as "avoid note" (assets/BRAND.md). -->
  <div class="stars" role="img" aria-label={t('common.starsOf3', { count: score.stars })}>
    {#each [1, 2, 3] as position (position)}
      <span class="slot">
        <svg width="52" height="52" viewBox="0 0 24 24" aria-hidden="true" class:pop={position <= shown}
             fill={position <= shown ? '#f4f2ee' : 'none'}
             stroke={position <= shown ? 'none' : '#3a4046'} stroke-width="1.6">
          <path d="M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.7l-5.9 3.1 1.2-6.6L2.5 9.6l6.6-.9z"></path>
        </svg>
        {#if position <= shown}
          {#each SPARKS as at (at)}<span class="spark" style={spark(position, at)}></span>{/each}
        {/if}
      </span>
    {/each}
  </div>

  <h2>{score.label ?? t('result.notYet')}</h2>
  {#if crowned}
    <p class="best"><span class="crown">{t('result.newBest')}</span></p>
  {/if}
  <!-- A pass below the record says the record stands: three empty stars after a missed run on
       the clock read as if the two already earned were gone (review of 2026-10-30, #18). The
       challenge keeps its own rule, the first pass of the day. -->
  {#if !grid && before > score.stars}
    <p class="best">{t('result.bestStays', { stars: '★'.repeat(before) })}</p>
  {/if}
  <p class="sub"><Glossed text={name} /></p>

  {#if grid}
    <div class="share">
      <p class="squares" role="img"
         aria-label={t('today.cleanOf', { clean: grid.filter(state => state === 'clean').length, total: grid.length })}>
        {#each grid as state, at (at)}<span class:unplayed={!(state in SQUARES) || state === 'unplayed'}>{SQUARES[state as keyof typeof SQUARES] ?? SQUARES.unplayed}</span>{/each}
      </p>
      {#if official}
        <div class="row">
          <button type="button" onclick={copy}>{copied ? t('common.copied') : t('common.copyResult')}</button>
        </div>
      {:else}
        <p class="note">{t('result.practiceRun')}</p>
        <div class="row">
          <button type="button" onclick={copy}>{copied ? t('common.copied') : t('result.copyFirst')}</button>
        </div>
      {/if}
      {#if showText && share}
        <pre class="text">{share}</pre>
      {/if}
    </div>
  {/if}

  <div class="tiles">
    <div class="tile">
      <p class="big">{score.right} / {score.total}</p>
      <p class="label">{t('result.right', { percent: percent(score.rightShare) })}</p>
    </div>
    <div class="tile">
      <p class="big">{score.clean} / {score.total}</p>
      <p class="label">{t('result.clean', { percent: percent(score.cleanShare) })}</p>
    </div>
    <!-- Only on the clock: the third star is earned there, and a free pass with skipped chords
         measures two neighbours at best, a number that means nothing to anyone. -->
    {#if timed}
      <div class="tile">
        <p class="big">{score.movement === null ? '—' : sayDecimal(score.movement, 2)}</p>
        <p class="label">{t('result.moved')}</p>
      </div>
    {/if}
  </div>
 </div>

 <!-- Every ending leads somewhere (docs/spec-ui.md): the thing to fix, the third star, the next level. -->
 <div class="next">
  <p class="kicker">{t('result.whatNext')}</p>
  <div class="fix">
    {#if weakness}<p class="kicker warn">{t('result.fix')}</p>{/if}
    {#if weakness}
      <!-- A plain major triad has no suffix to show in code type, so it is said in words. -->
      {#if weakness.key}
        <p class="what">{t('result.on')} <code>{weakness.key}</code> {t('result.weakness', { problem: sayProblem(weakness), count: weakness.count })}</p>
      {:else}
        <p class="what">{t('result.onMajor', { problem: sayProblem(weakness), count: weakness.count })}</p>
      {/if}
    {:else if score.played === 0}
      <p class="what">{t('result.nothingPlayed')}</p>
    {:else if score.played < score.total}
      <!-- "Every chord you played came back clean" was true and still misleading after nine
           skipped chords out of ten (review of 2026-10-30, #9). -->
      <p class="what">{t(timed ? 'result.unanswered' : 'result.skipped', { count: score.total - score.played })}</p>
    {:else}
      <p class="what">{t('result.nothing')}</p>
    {/if}
    {#if (weakness && onpractise) || onhow}
      <div class="row left">
        {#if weakness && onpractise}
          <button type="button" class="small" onclick={onpractise}>{t('result.practise', { chord: weakness.key || t('common.majorTriad') })}</button>
        {/if}
        {#if onhow}
          <button type="button" class="small" onclick={onhow}>{t('game.howBuilt')}</button>
        {/if}
      </div>
    {/if}
  </div>

  {#if grid}
    <p class="locked">{t('result.noClock')}</p>
  {:else if ontimed}
    <div class="card timed">
      <span class="words">
        <span class="title">{t('result.timedTitle')}</span>
        <span class="locked">{t('result.timedLine', { tempo, threshold: sayDecimal(threshold) })}</span>
      </span>
      <button type="button" class="small" onclick={ontimed}>{t('result.try')}</button>
    </div>
  {:else if score.stars === 2 && !timed}
    <p class="locked">{t('result.needTimed')}</p>
  {:else if score.stars === 2 && timed && score.movement !== null}
    <p class="locked">{t('result.needSmooth', { movement: sayDecimal(score.movement, 2), threshold: sayDecimal(threshold) })}</p>
  {/if}

  <!-- One button leads, and it is the way forward when there is one: a level just passed should
       be a single press away from the next, not a trip back to the map (Edi, 2026-10-12). -->
  <div class="buttons">
    {#if onnext}
      <button type="button" class="primary" onclick={onnext}>{t('result.next')} →</button>
    {/if}
    <button type="button" class:primary={!onnext} onclick={onagain}>{t('result.again')}</button>
    <button type="button" class="quiet" onclick={onexit}>{t('result.backToPath')}</button>
  </div>
 </div>
</section>

<style>
  .result {
    max-width: 1080px; margin: 0 auto; padding: 52px 40px 48px;
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 56px; align-items: center;
  }
  .summary { text-align: center; }
  .next { display: flex; flex-direction: column; gap: 12px; }
  .next > .kicker { margin: 0; }
  .kicker.warn { color: var(--avoid); }
  .row.left { justify-content: flex-start; margin-top: 14px; flex-wrap: wrap; }
  button.small { padding: 10px 16px; font-size: 14px; border-color: #3d4247; }
  .card { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 16px 18px; }
  .timed { display: flex; align-items: center; gap: 14px; }
  .words { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .title { font-size: 15px; font-weight: 600; }
  .timed .locked { margin: 0; }
  button.quiet { border: none; background: none; color: var(--ink-muted); }
  button.quiet:hover { color: var(--ink); }
  @media (max-width: 860px) {
    .result { grid-template-columns: minmax(0, 1fr); gap: 28px; padding: 32px 16px 40px; }
  }
  .stars { display: flex; justify-content: center; gap: 12px; margin-bottom: 22px; }
  h2 { margin: 0 0 6px; font-size: 32px; font-weight: 600; letter-spacing: -0.03em; }
  .best { margin: 0 0 6px; font-size: 15px; color: var(--ink); }
  .slot { position: relative; width: 52px; height: 52px; }
  .slot svg { display: block; overflow: visible; }
  .pop, .crown { animation: pop 380ms cubic-bezier(.2, 1.6, .4, 1) both; }
  @keyframes pop { 0% { opacity: 0; transform: scale(.4); } 60% { opacity: 1; transform: scale(1.18); } 100% { opacity: 1; transform: none; } }
  .crown {
    display: inline-block; padding: 3px 12px; border: 1px solid var(--ink); border-radius: 999px;
    font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
  }
  .spark {
    position: absolute; left: 24px; top: 24px; width: 4px; height: 4px; border-radius: 50%;
    background: #f4f2ee; pointer-events: none; animation: spark 620ms cubic-bezier(.15, .7, .3, 1) forwards;
  }
  @keyframes spark { from { opacity: 1; transform: none; } to { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(.3); } }
  @media (prefers-reduced-motion: reduce) {
    .pop, .crown { animation: none; }
    .spark { display: none; }
  }
  .sub { margin: 0 0 30px; color: var(--ink-muted); font-size: 15px; }
  .tiles { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
  .tile { flex: 1 1 150px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 16px; }
  .big { margin: 0 0 4px; font-family: ui-monospace, monospace; font-size: 24px; font-weight: 600; }
  .label { margin: 0; font-size: 13px; color: var(--ink-muted); }
  /* The ten squares stay on one row: a square is about 1.37 em wide plus its 2 px of spacing, so
     the size follows the width the grid has (review of 2026-10-30, #6). */
  .share { margin: -10px 0 26px; container-type: inline-size; }
  .squares { margin: 0 0 14px; font-size: min(30px, calc(7cqi - 2px)); line-height: 1.1; letter-spacing: 2px; white-space: nowrap; }
  /* A chord skipped is grey on screen, not white: a beginner skips the jazz shapes every day, and
     a row of white reads as a page left blank. The pasted grid keeps ⬜, since no emoji is grey. */
  .squares .unplayed { opacity: 0.35; }
  .row { display: flex; justify-content: center; gap: 12px; }
  .row button { padding: 10px 20px; font-size: 14px; }
  .note { margin: 0 0 12px; font-size: 13px; color: var(--ink-muted); }
  .text {
    margin: 14px auto 0; max-width: 420px; padding: 12px; border: 1px solid var(--border);
    border-radius: 10px; background: var(--surface); text-align: left; white-space: pre-wrap;
    font-family: ui-monospace, monospace; font-size: 13px; user-select: all;
  }
  .fix { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 20px 22px; text-align: left; }
  .kicker { margin: 0 0 8px; font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted); }
  .what { margin: 0; font-size: 17px; }
  code { font-family: ui-monospace, monospace; }
  .locked { margin: 18px 0 0; font-size: 13px; color: var(--ink-muted); }
  .buttons { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 28px; }
  button {
    padding: 14px 28px; border: 1px solid var(--border); border-radius: 12px;
    background: var(--surface); color: var(--ink); font: inherit; font-size: 16px; cursor: pointer;
  }
  button.primary { background: var(--ink); color: #14171a; border-color: var(--ink); font-weight: 600; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
