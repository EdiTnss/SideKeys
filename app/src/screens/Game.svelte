<script lang="ts">
  import Keyboard from '../lib/Keyboard.svelte';
  import {
    parseChord, analyzeVoicing, isRight, isClean, roleClasses, missingClasses, midiToName,
  } from '../bridge/theory';

  // A fixed ii–V–I while the loop is being built. The real sequence comes from the level, and
  // the notes will come from the instrument; both are the next step, not this one.
  const ASK = ['Dm7', 'G7', 'Cmaj7'];

  let index = $state(0);
  let held = $state<number[]>([]);

  const chord = $derived(parseChord(ASK[index]));
  // Two notes is the least the analyzer can classify; below that there is nothing to say yet.
  const analysis = $derived(held.length >= 2 ? analyzeVoicing(held, chord) : null);
  const classes = $derived(
    analysis
      ? { ...roleClasses(analysis), ...missingClasses(analysis) }
      : Object.fromEntries(held.map(midi => [midi, 'held'])),
  );
  const warnings = $derived(analysis ? analysis.messages.filter((m: { level: string }) => m.level === 'warning') : []);
  const star = $derived(!analysis ? null : isClean(analysis) ? 'Clean' : isRight(analysis) ? 'Right' : null);

  function toggle(midi: number) {
    held = held.includes(midi)
      ? held.filter(note => note !== midi)
      : [...held, midi].sort((a, b) => a - b);
  }

  function next() {
    index = (index + 1) % ASK.length;
    held = [];
  }
</script>

<section class="game">
  <p class="ask">{ASK[index]}</p>
  <p class="hint">Click the keys to build a voicing. Any voicing that works counts.</p>

  <div class="verdict" aria-live="polite">
    {#if !analysis}
      <p class="waiting">—</p>
    {:else if star}
      <p class="star {star.toLowerCase()}">{star}{analysis.voicing.type ? ` — ${analysis.voicing.type}` : ''}</p>
    {:else}
      <p class="star none">{warnings[0].text}</p>
    {/if}

    {#if analysis && warnings.length}
      <ul class="messages">
        {#each warnings as message (message.text)}
          <li>{message.text}</li>
        {/each}
      </ul>
    {/if}
  </div>

  <Keyboard {classes} onkey={toggle} />

  <div class="controls">
    <button type="button" onclick={next}>Next chord</button>
    <button type="button" onclick={() => (held = [])} disabled={held.length === 0}>Clear</button>
    <span class="played">{held.map(midi => midiToName(midi)).join(' ') || 'nothing yet'}</span>
  </div>
</section>

<style>
  .game { max-width: 1100px; margin: 0 auto; padding: 24px 32px 48px; }
  .ask { margin: 24px 0 6px; font-size: 96px; line-height: 1; font-weight: 600; letter-spacing: -0.05em; }
  .hint { margin: 0 0 28px; color: var(--ink-muted); font-size: 15px; }
  .verdict { min-height: 96px; }
  .star { margin: 0 0 8px; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
  .star.clean { color: var(--chord-tone); }
  .star.right { color: var(--ink); }
  .star.none { color: var(--avoid); }
  .waiting { margin: 0; font-size: 24px; color: var(--ink-muted); }
  .messages { margin: 0; padding-left: 20px; color: var(--ink-muted); font-size: 14px; }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 20px; }
  button {
    padding: 10px 18px; border: 1px solid var(--border); border-radius: 10px;
    background: var(--surface); color: var(--ink); font: inherit; font-size: 14px; cursor: pointer;
  }
  button:hover:not(:disabled) { border-color: var(--ink-muted); }
  button:disabled { opacity: 0.45; cursor: default; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .played { font-family: ui-monospace, monospace; font-size: 14px; color: var(--ink-muted); }
</style>
