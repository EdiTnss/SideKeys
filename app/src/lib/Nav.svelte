<script lang="ts" module>
  export type Tab = 'play' | 'practice' | 'learn' | 'settings';
</script>

<script lang="ts">
  import type { Instrument } from './instrument.svelte';
  import { t } from './locale.svelte';

  // The three doors (docs/spec-ui.md). On a narrow screen they are tabs along the bottom, with
  // the keyboard and the streak in a bar along the top; from 760 px up all of it is one column on
  // the left, where there is room to say under each door what it is for.
  let { tab, instrument, streak, onnav }: {
    tab: Tab;
    /** The app's one instrument: the navigation says whether a keyboard is there, and connects one. */
    instrument: Instrument;
    /** Days in a row. Nothing is shown before the first one: a zero is not news. */
    streak: number;
    onnav: (tab: Tab) => void;
  } = $props();

  const doors = [
    { id: 'play', label: 'nav.play', hint: 'nav.playHint' },
    { id: 'practice', label: 'nav.practice', hint: 'nav.practiceHint' },
    { id: 'learn', label: 'nav.learn', hint: 'nav.learnHint' },
  ] as const;
</script>

{#snippet logo()}
  <button type="button" class="logo" onclick={() => onnav('play')}>
    <svg width="24" height="24" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="14" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
      <rect x="24" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
      <rect x="34" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
      <rect x="45" y="22" width="7" height="32" rx="2" fill="var(--accent)"></rect>
    </svg>
    <span>Side<span class="accent">Keys</span></span>
  </button>
{/snippet}

{#snippet keyboardState(long: boolean)}
  {#if instrument.hardware.length}
    <span class="chip" title={instrument.hardware.join(', ')}>
      <span class="dot" aria-hidden="true"></span>
      <span class="name">{instrument.hardware.join(', ')}</span>{#if long}<span class="muted"> · {t('nav.connected')}</span>{/if}
    </span>
  {:else}
    <button type="button" class="chip connect" onclick={() => instrument.connect()}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
      {long ? t('header.connect') : t('nav.connect')}
    </button>
  {/if}
{/snippet}

{#snippet flame()}
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--avoid)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.2 3 2.5 3-1-3 0-5.5 0-8z"></path></svg>
{/snippet}

{#snippet gear()}
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path></svg>
{/snippet}

{#snippet door(id: string)}
  {#if id === 'play'}
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4.5v15L19.5 12z"></path></svg>
  {:else if id === 'practice'}
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l3 18H6z"></path><path d="M12 14l5-8"></path></svg>
  {:else}
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"></path><path d="M4 21V5M9 7h6"></path></svg>
  {/if}
{/snippet}

<!-- Narrow screens only: the keyboard, the streak and the way to settings, in one row. -->
<header class="top">
  {@render logo()}
  {@render keyboardState(false)}
  {#if streak > 0}
    <span class="chip streak" title={t('nav.streak', { count: streak })}>{@render flame()}{streak}</span>
  {/if}
  <button type="button" class="icon" class:on={tab === 'settings'} aria-label={t('nav.settings')}
          aria-current={tab === 'settings' ? 'page' : undefined} onclick={() => onnav('settings')}>{@render gear()}</button>
</header>

<aside class="rail">
  <div class="brand">{@render logo()}</div>
  <nav aria-label={t('nav.label')}>
    {#each doors as entry (entry.id)}
      <button type="button" class="door" class:on={tab === entry.id}
              aria-current={tab === entry.id ? 'page' : undefined} onclick={() => onnav(entry.id)}>
        {@render door(entry.id)}
        <span class="words">
          <span class="label">{t(entry.label)}</span>
          <span class="hint">{t(entry.hint)}</span>
        </span>
      </button>
    {/each}
  </nav>
  <div class="foot">
    {#if streak > 0}
      <span class="row">{@render flame()}{t('nav.streak', { count: streak })}</span>
    {/if}
    <span class="row">{@render keyboardState(true)}</span>
    {#if !instrument.hardware.length && instrument.status.level === 'warn'}
      <!-- A press with no answer reads as a button that does not work, so the reason is said here. -->
      <span class="warn" role="status">{t('header.noInput')}</span>
    {/if}
    <button type="button" class="row link" class:on={tab === 'settings'}
            aria-current={tab === 'settings' ? 'page' : undefined} onclick={() => onnav('settings')}>
      {@render gear()}{t('nav.settings')}
    </button>
  </div>
</aside>
{#if !instrument.hardware.length && instrument.status.level === 'warn'}
  <p class="warn narrow" role="status">{t('header.noInput')}</p>
{/if}

<style>
  .logo {
    display: flex; align-items: center; gap: 9px; padding: 0; border: none; background: none; cursor: pointer;
    font-family: inherit; font-weight: 600; font-size: 17px; letter-spacing: -0.03em; color: var(--ink);
  }
  .accent { color: var(--accent); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 8px; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px; min-width: 0; height: 32px; padding: 0 11px;
    border: 1px solid var(--border); border-radius: 16px; background: none;
    font: inherit; font-size: 13px; color: var(--ink);
  }
  .chip .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; }
  .chip.connect { cursor: pointer; border-color: var(--accent); }
  .chip.streak { font-weight: 600; }
  .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--chord-tone); }
  .muted { color: var(--ink-muted); }
  .icon {
    display: grid; place-items: center; width: 44px; height: 44px; padding: 0;
    border: none; background: none; color: var(--ink-muted); cursor: pointer;
  }
  .icon.on, .icon:hover { color: var(--ink); }
  .warn { margin: 0; font-size: 12px; line-height: 1.4; color: var(--avoid); }

  /* ---- Narrow: a bar on top, the doors along the bottom ---- */
  .top {
    position: sticky; top: 0; z-index: 5;
    display: flex; align-items: center; gap: 8px; padding: 8px 6px 8px 16px;
    background: var(--bg); border-bottom: 1px solid var(--border);
  }
  .top .logo { margin-right: auto; }
  .warn.narrow { padding: 8px 16px; border-bottom: 1px solid var(--border); }
  .rail {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 5;
    border-top: 1px solid var(--border); background: #0d0f11;
    padding: 6px 8px calc(10px + env(safe-area-inset-bottom));
  }
  .brand, .foot { display: none; }
  nav { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .door {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    min-height: 52px; padding: 4px; border: none; border-radius: 12px; background: none; cursor: pointer;
    font: inherit; color: var(--ink-muted);
  }
  .door .hint { display: none; }
  .door .label { font-size: 12px; }
  .door.on { color: var(--ink); }
  .door.on svg { color: var(--accent); }
  .door.on .label { font-weight: 600; }

  /* ---- Wide: one column on the left ---- */
  @media (min-width: 760px) {
    .top, .warn.narrow { display: none; }
    .rail {
      top: 0; right: auto; width: 248px;
      display: flex; flex-direction: column; gap: 32px;
      padding: 24px 14px 20px; border-top: none; border-right: 1px solid var(--border);
    }
    .brand { display: block; padding: 0 10px; }
    .brand .logo { font-size: 19px; }
    nav { display: flex; flex-direction: column; gap: 4px; }
    .door {
      flex-direction: row; justify-content: flex-start; gap: 12px; min-height: 0;
      padding: 10px 12px; border: 1px solid transparent; text-align: left;
    }
    .door:hover { background: #121518; }
    .door.on { background: #14171a; border-color: var(--border); }
    .words { display: flex; flex-direction: column; gap: 1px; }
    .door .label { font-size: 15px; font-weight: 500; color: inherit; }
    .door.on .label { color: var(--ink); }
    .door .hint { display: block; font-size: 12px; color: var(--ink-muted); }
    .foot { margin-top: auto; display: flex; flex-direction: column; gap: 6px; }
    .row {
      display: flex; align-items: center; gap: 10px; padding: 6px 10px;
      font-size: 14px; color: var(--ink);
    }
    .row .chip { height: auto; padding: 0; border: none; font-size: 14px; }
    .row .chip.connect { padding: 6px 12px; border: 1px solid var(--accent); border-radius: 10px; }
    .row .chip .name { max-width: 150px; }
    .foot .warn { padding: 0 10px; }
    .link {
      padding: 10px; border: none; border-radius: 10px; background: none; cursor: pointer;
      font: inherit; font-size: 14px; color: var(--ink-muted); text-align: left;
    }
    .link:hover, .link.on { color: var(--ink); background: #121518; }
  }
</style>
