<script module lang="ts">
  // Which term is open, across every sentence on the screen: one explanation at a time.
  const tip = $state<{ open: string | null }>({ open: null });
  let instances = 0;
</script>

<script lang="ts">
  // A sentence of the game with its jazz words underlined, in Romanian; a click on one says what
  // it means, in the glossary's short words. In English the sentence is drawn as it is — the
  // glossary is Romanian, and English gets nothing new (Edi, 2026-10-27).
  //
  // Not for text inside a button (a level on the map, a chip in Training): a term there would be
  // a button inside a button, and its click would start the level instead.
  import { GLOSSARY, glossaryTerm } from '../bridge/game';
  import { splitTerms } from '../../../src/i18n/terms.js';
  import { locale } from './locale.svelte';

  let { text }: { text: string } = $props();

  const self = `glossed-${(instances += 1)}`;
  const parts = $derived(locale() === 'ro' ? splitTerms(text, GLOSSARY) : [{ text }]);

  function toggle(event: MouseEvent, key: string) {
    // The window's click closes whatever is open; this one must not reach it.
    event.stopPropagation();
    tip.open = tip.open === key ? null : key;
  }
</script>

<svelte:window onclick={() => { if (tip.open?.startsWith(`${self}:`)) tip.open = null; }}
               onkeydown={event => { if (event.key === 'Escape' && tip.open?.startsWith(`${self}:`)) tip.open = null; }} />

{#each parts as part, i (i)}
  {#if part.term}
    {@const key = `${self}:${i}`}
    {@const entry = glossaryTerm(part.term) as { name: string; short: string } | null}
    <span class="glossed">
      <button type="button" class="term" aria-expanded={tip.open === key}
              onclick={event => toggle(event, key)}>{part.text}</button>
      {#if tip.open === key && entry}
        <span class="tip" role="tooltip"><b>{entry.name}</b> {entry.short}</span>
      {/if}
    </span>
  {:else}{part.text}{/if}
{/each}

<style>
  .glossed { position: relative; }
  .term {
    padding: 0; border: none; background: none; cursor: help;
    font: inherit; letter-spacing: inherit; color: inherit;
    text-decoration: underline dotted; text-decoration-thickness: 1px; text-underline-offset: 3px;
  }
  .term:hover, .term[aria-expanded='true'] { text-decoration-style: solid; }
  .term:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
  .tip {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 20;
    width: max-content; max-width: min(300px, 80vw);
    padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px;
    background: #1d2125; box-shadow: 0 6px 24px rgb(0 0 0 / 0.4);
    font-family: Sora, system-ui, sans-serif; font-size: 13px; font-weight: 400; line-height: 1.5;
    letter-spacing: normal; text-align: left; text-transform: none; color: var(--ink); white-space: normal;
  }
  .tip b { display: block; margin-bottom: 2px; font-weight: 600; }
</style>
