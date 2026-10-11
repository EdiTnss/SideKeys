<script lang="ts">
  import Keyboard from '../lib/Keyboard.svelte';
  import Result from './Result.svelte';
  import { createInstrument } from '../lib/instrument.svelte';
  import { createLevel, type LevelPlan } from '../game/level.svelte';
  import {
    analyzeVoicing, isRight, isClean,
    roleClasses, missingClasses, armedClasses, midiToName,
  } from '../bridge/theory';

  let { unit, plan, onfinish, onexit }: {
    unit: { name: string; difficulty: number };
    plan: LevelPlan;
    onfinish: (run: { stars: number; attempts: unknown[]; seconds: number }) => number;
    onexit: () => void;
  } = $props();

  // A level is built once, from the plan this screen was mounted with. App.svelte wraps the
  // screen in {#key plan.id}, so picking another level remounts it rather than swapping the
  // plan underneath a run in progress — which is what the warning below would be about.
  // svelte-ignore state_referenced_locally
  const level = createLevel(plan);
  let recorded = $state(false);
  let xp = $state(0);

  // One run is recorded once: the effect fires again on every change while the result is up.
  $effect(() => {
    if (level.finished && level.score && !recorded) {
      recorded = true;
      xp = onfinish({ stars: level.score.stars, attempts: level.attempts, seconds: level.seconds });
    }
  });

  let analysis = $state<ReturnType<typeof analyzeVoicing> | null>(null);
  let judged = $state<string | null>(null);
  let anticipated = $state(false);
  let classes = $state<Record<number, string>>({});

  const instrument = createInstrument({ onVoicing: judge, onNext: skip });

  function judge(notes: number[], { startedAt }: { startedAt: number | null }) {
    // Which chord this answers is the level's decision, not the screen's: timed, a voicing that
    // started in the last half beat of a bar belongs to the next one.
    const answered = level.answer(notes, startedAt);
    if (!answered) return;        // played during the count-in, or after the last bar
    analysis = answered.analysis;
    judged = answered.symbol;
    anticipated = answered.anticipated;
    classes = { ...roleClasses(answered.analysis), ...missingClasses(answered.analysis) };
  }

  function skip() {
    level.skip();
    clearVerdict();
  }

  function startTimed() {
    clearVerdict();
    level.start();
  }

  function again() {
    level.restart();
    recorded = false;
    xp = 0;
    clearVerdict();
  }

  function clearVerdict() {
    instrument.cancelCapture();
    analysis = null;
    judged = null;
    anticipated = false;
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
    else if (event.code === 'Space' && !level.timed) { event.preventDefault(); skip(); }
  }

  const warnings = $derived(analysis ? analysis.messages.filter((m: { level: string }) => m.level === 'warning') : []);
  const asked = $derived({ texture: level.texture });
  const star = $derived(!analysis ? null : isClean(analysis, asked) ? 'Clean' : isRight(analysis, asked) ? 'Right' : null);
  // Right notes in the wrong shape is the one failure with no warning behind it, so the screen
  // has to say it itself: the analyzer was asked about the chord, not about the exercise.
  const shapeMiss = $derived(
    analysis && !star && !warnings.length
      ? analysis.messages.find((m: { code: string }) => m.code === 'type')?.text ?? 'another shape'
      : null);
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={event => instrument.keyUp(event.code)} />

{#if level.finished && level.score}
  <Result name="{unit.name} · {level.plan.name}" score={level.score} xp={xp} weakness={level.weakness}
          timed={level.timed} threshold={level.threshold} onagain={again} onexit={onexit} />
{:else}
  <section class="game">
    <div class="progress">
      <span class="count">{level.index + 1} / {level.total}</span>
      <span class="track"><span class="fill" style="width: {(100 * level.answered) / level.total}%"></span></span>
      <span class="level">
        <button type="button" class="exit" onclick={onexit}>← Back</button>
        {level.plan.name}
        {#if level.timed}<span class="timed">· timed, {level.plan.tempo} bpm</span>{/if}
      </span>
    </div>

    {#if level.countIn !== null}
      <p class="ask counting">{level.countIn}</p>
      <p class="hint">Count-in. One chord per bar from the next one.</p>
    {:else}
      <p class="ask">{level.ask}</p>
      <p class="hint">
        {#if level.timed}
          Bar {level.at?.bar ?? 1}, beat {level.at?.beat ?? 1}. Play it before the bar turns.
        {:else if level.texture}
          Play it as {[].concat(level.texture as never).join(' or ')}.
        {:else}
          Play it. Any voicing that works counts.
        {/if}
      </p>
    {/if}

    <div class="verdict" aria-live="polite">
      {#if !analysis}
        <p class="waiting">—</p>
      {:else if star}
        <p class="star {star.toLowerCase()}">
          <span class="judged">{judged}{anticipated ? ', anticipated' : ''}</span>
          {star}{analysis.voicing.type ? ` — ${analysis.voicing.type}` : ''}
        </p>
      {:else if shapeMiss}
        <p class="star none">
          <span class="judged">{judged}</span>
          Right notes, wrong shape — that is {shapeMiss}.
        </p>
      {:else}
        <p class="star none">
          <span class="judged">{judged}{anticipated ? ', anticipated' : ''}</span>
          {warnings[0].text}
        </p>
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
      {#if level.timed}
        <button type="button" class="stop" onclick={() => level.stop()}>Stop the run</button>
      {:else}
        <button type="button" class="start" onclick={startTimed}>Start the timed run</button>
      {/if}
      <button type="button" onclick={() => instrument.play()}>Play armed <kbd>Enter</kbd></button>
      <button type="button" onclick={() => instrument.clear()}>Clear <kbd>Esc</kbd></button>
      {#if !level.timed}
        <button type="button" onclick={skip}>Skip <kbd>Space</kbd></button>
      {/if}
      {#if !instrument.hardware.length}
        <button type="button" class="connect" onclick={() => instrument.connect()}>Connect a MIDI keyboard</button>
      {/if}
      <span class="octave">letters start at {midiToName(instrument.octave)} <kbd>Z</kbd><kbd>X</kbd></span>
    </div>

    <p class="status {instrument.status.level}">{instrument.status.text}</p>
  </section>
{/if}

<style>
  .game { max-width: 1100px; margin: 0 auto; padding: 24px 32px 48px; }
  .progress { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
  .count { font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink-muted); }
  .track { flex-grow: 1; height: 4px; border-radius: 999px; background: var(--border); overflow: hidden; }
  .fill { display: block; height: 4px; border-radius: 999px; background: var(--ink); }
  .level { font-size: 13px; color: var(--ink-muted); display: inline-flex; align-items: center; gap: 10px; }
  .exit { padding: 4px 10px; font-size: 12px; border-radius: 8px; }
  .timed { font-family: ui-monospace, monospace; }
  .ask { margin: 18px 0 6px; font-size: 96px; line-height: 1; font-weight: 600; letter-spacing: -0.05em; }
  .ask.counting { color: var(--ink-muted); }
  .hint { margin: 0 0 24px; color: var(--ink-muted); font-size: 15px; }
  .verdict { min-height: 92px; }
  .star { margin: 0 0 8px; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
  .star.clean { color: var(--chord-tone); }
  .star.right { color: var(--ink); }
  .star.none { color: var(--avoid); }
  .judged { font-family: ui-monospace, monospace; font-size: 15px; color: var(--ink-muted); margin-right: 6px; }
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
  button.start { background: var(--ink); color: #14171a; border-color: var(--ink); font-weight: 600; }
  button.connect { border-color: var(--accent); }
  kbd {
    font-family: ui-monospace, monospace; font-size: 11px; color: var(--ink-muted);
    border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px;
  }
  .octave { font-size: 13px; color: var(--ink-muted); display: inline-flex; align-items: center; gap: 5px; }
  .status { margin: 16px 0 0; font-size: 13px; color: var(--ink-muted); }
  .status.ok { color: var(--chord-tone); }
  .status.warn { color: var(--avoid); }
</style>
