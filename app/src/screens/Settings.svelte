<script lang="ts">
  import type { Instrument } from '../lib/instrument.svelte';
  import { locale, setLocale, t } from '../lib/locale.svelte';

  /** The Buttondown newsletter the form subscribes to (README links the same one). */
  const BUTTONDOWN = 'EdiTns';

  // What used to crowd the header: the keyboard's sound, the language, the newsletter and the
  // way to the Lab (docs/spec-ui.md). Reached from the gear in the navigation.
  let { instrument, streak, minutes, goal }: {
    instrument: Instrument;
    streak: number;
    minutes: number;
    goal: number;
  } = $props();

  const pct = $derived(Math.min(100, Math.round((100 * minutes) / goal)));
</script>

<section class="settings">
  <h1>{t('settings.title')}</h1>

  <section class="card progress">
    <p class="streak"><span class="big">{streak}</span> {t('settings.streak', { count: streak })}</p>
    <div class="track"><span class="fill" style="width: {pct}%"></span></div>
    <p class="muted">{t('today.minutes', { minutes, goal })}</p>
  </section>

  <section class="card list">
    <div class="item">
      <span class="label">{t('settings.keyboard')}</span>
      {#if !instrument.hardware.length}
        <button type="button" class="connect" onclick={() => instrument.connect()}>{t('header.connect')}</button>
      {/if}
    </div>
    {#if instrument.hardware.length}
      <!-- A controller has no sound of its own, a Genos has: the app cannot tell which, so the
           player says, once per keyboard. On until they do (Edi, 2026-10-29). -->
      {#each instrument.hardware as name (name)}
        {@const on = instrument.soundFor(name)}
        <div class="item">
          <span class="label"><span class="dot" aria-hidden="true"></span>{name}</span>
          <span class="switch-row">
            <span class="muted small">{t('header.sound')}</span>
            <button type="button" class="switch" role="switch" aria-checked={on}
                    aria-label={`${t('header.sound')}: ${name}`} title={t('header.soundHint')}
                    onclick={() => instrument.setSoundFor(name, !on)}><span></span></button>
          </span>
        </div>
      {/each}
      <p class="muted small pad">{t('header.soundHint')}</p>
    {:else}
      <p class="muted small pad">{instrument.status.level === 'warn' ? t('header.noInput') : t('settings.noKeyboard')}</p>
    {/if}
    <div class="item">
      <span class="label">{t('settings.language')}</span>
      <!-- Each language is named in itself, so someone who cannot read the other one still finds their own. -->
      <span class="segmented">
        <button type="button" lang="en" aria-label="English" aria-pressed={locale() === 'en'} onclick={() => setLocale('en')}>EN</button>
        <button type="button" lang="ro" aria-label="Română" aria-pressed={locale() === 'ro'} onclick={() => setLocale('ro')}>RO</button>
      </span>
    </div>
  </section>

  <a class="card lab" href="./lab/">
    <span>
      <span class="label">{t('settings.lab')}</span>
      <span class="muted small">{t('settings.labLine')}</span>
    </span>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path></svg>
  </a>

  <!-- Buttondown keeps the addresses and sends the double opt-in; the page only posts the form,
       in a new tab, so the game stays where it was. -->
  <section class="card">
    <h2>{t('today.news')}</h2>
    <p class="muted small">{t('today.newsLine')}</p>
    <form class="news" action={`https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN}`}
          method="post" target="_blank">
      <input type="email" name="email" required autocomplete="email"
             placeholder={t('today.newsEmail')} aria-label={t('today.newsEmail')} />
      <input type="hidden" name="embed" value="1" />
      <button type="submit">{t('today.subscribe')}</button>
    </form>
  </section>
</section>

<style>
  .settings { max-width: 640px; margin: 0 auto; padding: 32px 40px 48px; display: flex; flex-direction: column; gap: 16px; }
  h1 { margin: 0 0 4px; font-size: 28px; font-weight: 600; letter-spacing: -0.03em; }
  h2 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
  .card { border: 1px solid var(--border); border-radius: 16px; background: var(--surface); padding: 18px; }
  .muted { margin: 0; color: var(--ink-muted); }
  .small { font-size: 13px; line-height: 1.45; }
  .streak { display: flex; align-items: baseline; gap: 10px; margin: 0 0 14px; font-size: 14px; color: var(--ink-muted); }
  .big { font-size: 36px; font-weight: 600; line-height: 1; color: var(--ink); }
  .track { height: 6px; border-radius: 999px; background: var(--border); overflow: hidden; margin-bottom: 8px; }
  .fill { display: block; height: 100%; border-radius: 999px; background: var(--ink); }
  .list { padding: 4px 0; }
  .item { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 18px; border-bottom: 1px solid #1b1f22; }
  .item:last-child { border-bottom: none; }
  .label { flex: 1; display: flex; flex-direction: column; gap: 3px; font-size: 15px; }
  .item .label { flex-direction: row; align-items: center; gap: 10px; }
  .pad { padding: 0 18px 12px; border-bottom: 1px solid #1b1f22; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--chord-tone); }
  .switch-row { display: inline-flex; align-items: center; gap: 10px; }
  .switch {
    position: relative; width: 44px; height: 26px; padding: 0; border: none; border-radius: 13px;
    background: var(--border); cursor: pointer;
  }
  .switch span {
    position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
    background: var(--ink-muted); transition: transform 120ms ease-out;
  }
  .switch[aria-checked='true'] { background: var(--ink); }
  .switch[aria-checked='true'] span { transform: translateX(18px); background: #0a0b0c; }
  .segmented { display: inline-flex; border: 1px solid #3d4247; border-radius: 10px; overflow: hidden; }
  .segmented button {
    padding: 6px 14px; border: none; background: none; color: var(--ink-muted);
    font: inherit; font-size: 13px; cursor: pointer;
  }
  .segmented button[aria-pressed='true'] { background: var(--ink); color: #0a0b0c; font-weight: 600; }
  .lab { display: flex; align-items: center; gap: 14px; color: var(--ink); text-decoration: none; }
  .lab > span { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .lab .label { font-weight: 600; }
  .lab:hover { border-color: var(--ink-muted); }
  .lab svg { color: var(--ink-muted); }
  .news { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .news input[type='email'] {
    flex: 1 1 160px; min-width: 0; min-height: 44px; padding: 0 12px; border: 1px solid #3d4247;
    border-radius: 10px; background: var(--bg); color: var(--ink); font: inherit; font-size: 14px;
  }
  .connect, .news button {
    min-height: 40px; padding: 0 14px; border: 1px solid var(--accent); border-radius: 10px;
    background: none; color: var(--ink); font: inherit; font-size: 14px; cursor: pointer;
  }
  .news button { border-color: var(--ink); background: var(--ink); color: #0a0b0c; font-weight: 600; }
  button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  @media (max-width: 759px) {
    .settings { padding: 16px 16px 28px; }
  }
</style>
