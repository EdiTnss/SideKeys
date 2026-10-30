<script lang="ts">
  import type { scoreRun } from '../bridge/theory';
  import { SQUARES } from '../bridge/game';
  import { copyText } from '../lib/clipboard';
  import Glossed from '../lib/Glossed.svelte';
  import { sayDecimal, sayProblem, t } from '../lib/locale.svelte';

  type Score = NonNullable<ReturnType<typeof scoreRun>>;
  type Weakness = { key: string; problem: string; count: number; kind: string; degree: string | null } | null;

  let { name, score, weakness, timed, threshold, tempo, grid = null, share = null,
        official = true, onagain, ontimed = null, onpractise = null, onhow = null, onnext = null, onexit }: {
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
      <svg width="52" height="52" viewBox="0 0 24 24" aria-hidden="true"
           fill={position <= score.stars ? '#f4f2ee' : 'none'}
           stroke={position <= score.stars ? 'none' : '#3a4046'} stroke-width="1.6">
        <path d="M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.7l-5.9 3.1 1.2-6.6L2.5 9.6l6.6-.9z"></path>
      </svg>
    {/each}
  </div>

  <h2>{score.label ?? t('result.notYet')}</h2>
  <p class="sub"><Glossed text={name} /></p>

  {#if grid}
    <div class="share">
      <p class="squares" role="img"
         aria-label={t('today.cleanOf', { clean: grid.filter(state => state === 'clean').length, total: grid.length })}>
        {grid.map(state => SQUARES[state as keyof typeof SQUARES] ?? SQUARES.unplayed).join('')}
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
        <span class="locked">{t('result.timedLine', { tempo })}</span>
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
  .sub { margin: 0 0 30px; color: var(--ink-muted); font-size: 15px; }
  .tiles { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
  .tile { flex: 1 1 150px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 16px; }
  .big { margin: 0 0 4px; font-family: ui-monospace, monospace; font-size: 24px; font-weight: 600; }
  .label { margin: 0; font-size: 13px; color: var(--ink-muted); }
  .share { margin: -10px 0 26px; }
  .squares { margin: 0 0 14px; font-size: 30px; line-height: 1.1; letter-spacing: 2px; word-break: break-all; }
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
