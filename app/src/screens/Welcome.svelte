<script lang="ts">
  import Keyboard from '../lib/Keyboard.svelte';
  import type { Instrument } from '../lib/instrument.svelte';
  import { locale, setLocale, t } from '../lib/locale.svelte';

  // The first visit (docs/spec-ui.md): what this is, shown rather than told; what you play on;
  // where you start. Three presses, then the first chord.
  let { instrument, onstart }: {
    instrument: Instrument;
    /** The level to begin on, and whether its notes are written under the chord from the start. */
    onstart: (level: string, coach: boolean) => void;
  } = $props();

  let step = $state<1 | 2>(1);

  // C, E, G coloured as the game colours a chord tone: the verdict a first chord would get.
  const DEMO = { 60: 'role-chordTone', 64: 'role-chordTone', 67: 'role-chordTone' };

  // Until a placement test exists, the three answers only pick the first unit (Edi, 2026-10-30).
  const STARTS = [
    { level: 'triads-major', coach: true, title: 'welcome.beginner', line: 'welcome.beginnerLine' },
    { level: 'sevenths-maj-min', coach: false, title: 'welcome.chords', line: 'welcome.chordsLine' },
    { level: 'rootless-a', coach: false, title: 'welcome.jazz', line: 'welcome.jazzLine' },
  ];

  async function midi() {
    // The browser asks once; whatever it answers, the next step is the same.
    await instrument.connect();
    step = 2;
  }
</script>

<section class="welcome">
  <div class="top">
    <span class="logo">
      <svg width="24" height="24" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="14" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
        <rect x="24" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
        <rect x="34" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
        <rect x="45" y="22" width="7" height="32" rx="2" fill="var(--accent)"></rect>
      </svg>
      <span>Side<span class="accent">Keys</span></span>
    </span>
    <!-- Settings are not on screen yet, so the language is: each named in itself. -->
    <span class="language">
      <button type="button" lang="en" aria-label="English" aria-pressed={locale() === 'en'} onclick={() => setLocale('en')}>EN</button>
      <button type="button" lang="ro" aria-label="Română" aria-pressed={locale() === 'ro'} onclick={() => setLocale('ro')}>RO</button>
    </span>
  </div>

  <p class="step">{t('welcome.step', { at: step })}</p>

  {#if step === 1}
    <h1>{t('welcome.title')}</h1>
    <p class="lead">{t('welcome.lead')}</p>

    <div class="demo" aria-hidden="true">
      <div class="demo-head">
        <span class="chord">C</span>
        <span class="verdict">
          <span class="tick"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0b0c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"></path></svg></span>
          Clean — {t('inversion.root')}
        </span>
      </div>
      <Keyboard classes={DEMO} from={60} to={72} />
    </div>

    <h2>{t('welcome.device')}</h2>
    <div class="choices">
      <button type="button" class="choice" onclick={midi}>
        <span class="what">{t('welcome.midi')}</span>
        <span class="muted">{t('welcome.midiLine')}</span>
      </button>
      <button type="button" class="choice" onclick={() => (step = 2)}>
        <span class="what">{t('welcome.screen')}</span>
        <span class="muted">{t('welcome.screenLine')}</span>
      </button>
    </div>
  {:else}
    <h1>{t('welcome.where')}</h1>
    <p class="lead">{t('welcome.whereLine')}</p>
    <div class="choices column">
      {#each STARTS as start (start.level)}
        <button type="button" class="choice row" onclick={() => onstart(start.level, start.coach)}>
          <span class="words">
            <span class="what">{t(start.title)}</span>
            <span class="muted">{t(start.line)}</span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
        </button>
      {/each}
    </div>
    <button type="button" class="back" onclick={() => (step = 1)}>{t('common.back')}</button>
  {/if}
</section>

<style>
  .welcome { max-width: 560px; margin: 0 auto; padding: 16px 20px 40px; }
  .top { display: flex; align-items: center; justify-content: space-between; min-height: 44px; margin-bottom: 28px; }
  .logo { display: flex; align-items: center; gap: 9px; font-weight: 600; font-size: 17px; letter-spacing: -0.03em; }
  .accent { color: var(--accent); }
  .language { display: inline-flex; border: 1px solid #3d4247; border-radius: 10px; overflow: hidden; }
  .language button {
    padding: 6px 12px; border: none; background: none; color: var(--ink-muted);
    font: inherit; font-size: 13px; cursor: pointer;
  }
  .language button[aria-pressed='true'] { background: var(--ink); color: #0a0b0c; font-weight: 600; }
  .step { margin: 0 0 8px; font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted); }
  h1 { margin: 0 0 10px; font-size: 30px; line-height: 1.15; font-weight: 600; letter-spacing: -0.03em; }
  h2 { margin: 28px 0 12px; font-size: 18px; font-weight: 600; }
  .lead { margin: 0 0 22px; font-size: 16px; line-height: 1.5; color: var(--ink-muted); }
  .muted { color: var(--ink-muted); font-size: 14px; line-height: 1.45; }
  .demo { border: 1px solid var(--border); border-radius: 18px; background: var(--surface); padding: 18px; }
  .demo-head { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
  .chord { font-size: 44px; line-height: 1; font-weight: 600; letter-spacing: -0.04em; }
  .verdict { display: inline-flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; color: var(--chord-tone); }
  .tick { width: 24px; height: 24px; border-radius: 50%; background: var(--chord-tone); display: grid; place-items: center; }
  .choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .choices.column { grid-template-columns: minmax(0, 1fr); }
  button { font: inherit; color: var(--ink); cursor: pointer; text-align: left; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .choice {
    display: flex; flex-direction: column; gap: 4px; padding: 16px;
    border: 1px solid var(--border); border-radius: 16px; background: var(--surface);
  }
  .choice:hover { border-color: var(--ink-muted); }
  .choice.row { flex-direction: row; align-items: center; gap: 14px; padding: 18px; }
  .words { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .what { font-size: 16px; font-weight: 600; }
  .back { margin-top: 18px; padding: 10px 0; border: none; background: none; color: var(--ink-muted); font-size: 14px; }
  .back:hover { color: var(--ink); }
  @media (max-width: 420px) {
    .choices { grid-template-columns: minmax(0, 1fr); }
  }
</style>
