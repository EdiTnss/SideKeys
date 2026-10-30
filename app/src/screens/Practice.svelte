<script lang="ts">
  import { loadTraining } from '../bridge/game';
  import { sayProgression, sayShape, t } from '../lib/locale.svelte';
  import { SHAPES } from '../bridge/game';

  type Mode = 'drill' | 'progression';

  // The Practice door (docs/spec-ui.md): the last thing practised, one press away, and the three
  // kinds of practice under it, each said in a line. The choices themselves stay on Training.
  let { last = null, onresume, onchoose }: {
    /** The stretch just finished, said once on the way back in. */
    last?: { minutes: number; played: number; clean: number } | null;
    /** Starts again with the choices saved last time. */
    onresume: () => void;
    /** Opens the choices for one kind of practice. */
    onchoose: (mode: Mode) => void;
  } = $props();

  const saved = loadTraining() as {
    mode: Mode; qualities: string[]; keys: string[]; shape: string; progression: string; key: string; tempo: number;
  };
  const shape = SHAPES.find(entry => entry.id === saved.shape) ?? SHAPES[0];
  const resumeTitle = saved.mode === 'progression'
    ? () => t('practice.inKey', { name: sayProgression(saved.progression), key: saved.key })
    : () => saved.qualities.map(quality => quality || t('training.major')).join(', ');
  const resumeLine = saved.mode === 'progression'
    ? () => `${sayShape(shape)} · ${saved.tempo} bpm`
    : () => `${sayShape(shape)} · ${t('practice.keys', { count: saved.keys.length })} · ${saved.tempo} bpm`;
  // A drill with nothing to draw from cannot be resumed; its choices are where to fix that.
  const resumable = saved.mode === 'progression' || (saved.qualities.length > 0 && saved.keys.length > 0);
</script>

<section class="practice">
  <header>
    <h1>{t('practice.title')}</h1>
    <p class="muted">{t('practice.sub')}</p>
  </header>

  {#if last}
    <p class="last">
      {t('training.last', {
        time: last.minutes < 1 ? t('training.underMinute') : t('training.minutes', { count: last.minutes }),
        chords: t('common.chords', { count: last.played }),
        clean: last.clean,
      })}
    </p>
  {/if}

  {#if resumable}
    <button type="button" class="resume" onclick={onresume}>
      <span class="words">
        <span class="kicker">{t('practice.resume')}</span>
        <span class="what">{resumeTitle()}</span>
        <span class="muted small">{resumeLine()}</span>
      </span>
      <span class="play" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6L19 12z"></path></svg>
      </span>
      <span class="hidden">{t('practice.start')}</span>
    </button>
  {/if}

  <p class="kicker or">{t('practice.or')}</p>
  <div class="cards">
    <button type="button" class="card" onclick={() => onchoose('drill')}>
      <span class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg></span>
      <span class="words">
        <span class="what">{t('practice.drill')}</span>
        <span class="muted small">{t('practice.drillLine')}</span>
      </span>
    </button>
    <button type="button" class="card" onclick={() => onchoose('progression')}>
      <span class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"></path><path d="M3 11V9a3 3 0 0 1 3-3h15"></path><path d="M7 22l-4-4 4-4"></path><path d="M21 13v2a3 3 0 0 1-3 3H3"></path></svg></span>
      <span class="words">
        <span class="what">{t('practice.loop')}</span>
        <span class="muted small">{t('practice.loopLine')}</span>
      </span>
    </button>
    <!-- The comping report lives in the Lab for now (docs/spec-comping.md), in English. -->
    <a class="card" href="./lab/">
      <span class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12h3l3-8 4 16 3-8h7"></path></svg></span>
      <span class="words">
        <span class="what">{t('practice.comping')} <span class="tag">{t('practice.advanced')}</span></span>
        <span class="muted small">{t('practice.compingLine')}</span>
      </span>
    </a>
  </div>
</section>

<style>
  .practice { max-width: 1000px; margin: 0 auto; padding: 32px 40px 48px; display: flex; flex-direction: column; gap: 18px; }
  h1 { margin: 0 0 6px; font-size: 28px; font-weight: 600; letter-spacing: -0.03em; }
  .muted { margin: 0; color: var(--ink-muted); }
  .small { font-size: 14px; line-height: 1.45; }
  .hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .last { margin: 0; font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink-muted); }
  .kicker { font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted); }
  .or { margin: 6px 0 -4px; }
  button, a { font: inherit; color: var(--ink); text-align: left; text-decoration: none; cursor: pointer; }
  button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .resume {
    display: flex; align-items: center; gap: 18px; padding: 18px 22px;
    border: 1px solid #3d4247; border-radius: 18px; background: #14171a;
  }
  .resume:hover { border-color: var(--ink-muted); }
  .words { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .what { font-size: 17px; font-weight: 600; }
  .play {
    flex: none; width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center;
    background: var(--ink); color: #0a0b0c;
  }
  .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .card {
    display: flex; flex-direction: column; gap: 12px; padding: 20px;
    border: 1px solid var(--border); border-radius: 18px; background: var(--surface);
  }
  .card:hover { border-color: var(--ink-muted); }
  .icon { width: 46px; height: 46px; border-radius: 12px; background: #1b1f22; display: grid; place-items: center; }
  .tag {
    margin-left: 6px; padding: 2px 7px; border: 1px solid #3d4247; border-radius: 8px; vertical-align: 2px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-muted);
  }
  @media (max-width: 900px) {
    .cards { grid-template-columns: minmax(0, 1fr); }
    .card { flex-direction: row; align-items: flex-start; }
  }
  @media (max-width: 759px) {
    .practice { padding: 16px 16px 28px; }
  }
</style>
