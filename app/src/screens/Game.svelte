<script lang="ts">
  import Keyboard from '../lib/Keyboard.svelte';
  import { createInstrument } from '../lib/instrument.svelte';
  import {
    parseChord, analyzeVoicing, isRight, isClean,
    roleClasses, missingClasses, armedClasses, midiToName,
  } from '../bridge/theory';

  // A fixed ii–V–I while the loop is being built; the real sequence comes from the level.
  const ASK = ['Dm7', 'G7', 'Cmaj7'];

  let index = $state(0);
  let analysis = $state<ReturnType<typeof analyzeVoicing> | null>(null);
  let played = $state<number[]>([]);
  let classes = $state<Record<number, string>>({});

  const chord = $derived(parseChord(ASK[index]));

  // The lowest key on a 76-key Genos moves to the next chord, so a hand never leaves the
  // keyboard to click anything. That interception lives in the capture, not here.
  const instrument = createInstrument({ onVoicing: judge, onNext: next });

  function judge(notes: number[]) {
    played = notes;
    analysis = analyzeVoicing(notes, chord);
    classes = { ...roleClasses(analysis), ...missingClasses(analysis) };
  }

  function next() {
    index = (index + 1) % ASK.length;
    instrument.cancelCapture();
    analysis = null;
    played = [];
    classes = {};
  }

  // Held notes show grey while the chord is being built; the verdict paints over them when the
  // capture fires, and a release leaves the verdict standing.
  $effect(() => {
    const held = instrument.held;
    if (held.length) classes = Object.fromEntries(held.map(midi => [midi, 'held']));
  });

  function onKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
    // While the letters are a piano they are not shortcuts: a note beats a shortcut on one key.
    if (instrument.typeToPlay && instrument.keyDown(event.code)) {
      event.preventDefault();
      return;
    }
    if (event.code === 'Enter') instrument.play();
    else if (event.code === 'Escape') instrument.clear();
    else if (event.code === 'KeyZ') instrument.octaveDown();
    else if (event.code === 'KeyX') instrument.octaveUp();
    else if (event.code === 'Space') { event.preventDefault(); next(); }
  }

  const warnings = $derived(analysis ? analysis.messages.filter((m: { level: string }) => m.level === 'warning') : []);
  const star = $derived(!analysis ? null : isClean(analysis) ? 'Clean' : isRight(analysis) ? 'Right' : null);
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={event => instrument.keyUp(event.code)} />

<section class="game">
  <p class="ask">{ASK[index]}</p>
  <p class="hint">Play it. Any voicing that works counts.</p>

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

  <Keyboard classes={{ ...classes, ...armedClasses(instrument.armed) }} onkey={instrument.toggle} />

  <div class="controls">
    <button type="button" onclick={() => instrument.play()}>Play armed <kbd>Enter</kbd></button>
    <button type="button" onclick={() => instrument.clear()}>Clear <kbd>Esc</kbd></button>
    <button type="button" onclick={next}>Next chord <kbd>Space</kbd></button>
    {#if !instrument.hardware.length}
      <button type="button" class="connect" onclick={() => instrument.connect()}>Connect a MIDI keyboard</button>
    {/if}
    <span class="octave">letters start at {midiToName(instrument.octave)} <kbd>Z</kbd><kbd>X</kbd></span>
  </div>

  <p class="status {instrument.status.level}">{instrument.status.text}</p>
  {#if played.length}
    <p class="played">Captured: {played.map(midi => midiToName(midi)).join(' ')}</p>
  {/if}
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
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 18px; border: 1px solid var(--border); border-radius: 10px;
    background: var(--surface); color: var(--ink); font: inherit; font-size: 14px; cursor: pointer;
  }
  button:hover { border-color: var(--ink-muted); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button.connect { border-color: var(--accent); }
  kbd {
    font-family: ui-monospace, monospace; font-size: 11px; color: var(--ink-muted);
    border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px;
  }
  .octave { font-size: 13px; color: var(--ink-muted); display: inline-flex; align-items: center; gap: 5px; }
  .status { margin: 16px 0 0; font-size: 13px; color: var(--ink-muted); }
  .status.ok { color: var(--chord-tone); }
  .status.warn { color: var(--avoid); }
  .played { margin: 6px 0 0; font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink-muted); }
</style>
