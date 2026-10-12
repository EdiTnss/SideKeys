<script lang="ts">
  import type { PracticePlan } from '../game/practice.svelte';
  import {
    QUALITY_GROUPS, KEYS, SHAPES, TEMPO_RANGE, PROGRESSIONS,
    drillPool, shapeQualities, progressionFor, trainingPlan, loadTraining, saveTraining,
  } from '../bridge/game';

  type Settings = {
    mode: 'drill' | 'progression';
    qualities: string[];
    keys: string[];
    shape: string;
    progression: string;
    key: string;
    tempo: number;
  };

  let { last = null, onstart, onback }: {
    /** The stretch just finished, said once on the way back in. */
    last?: { minutes: number; played: number; clean: number } | null;
    onstart: (plan: Omit<PracticePlan, 'id'>) => void;
    onback: () => void;
  } = $props();

  // The choices are remembered from one visit to the next: nobody wants to untick nine keys
  // again every morning. A convenience of this browser, nothing more.
  let settings = $state(loadTraining() as Settings);
  $effect(() => saveTraining($state.snapshot(settings)));

  const shape = $derived(SHAPES.find(entry => entry.id === settings.shape) ?? SHAPES[0]);
  // The chords the engine has a voicing for in the shape demanded. The rest are greyed out
  // rather than hidden, so it is plain that a quartal dominant was not forgotten: it is not there.
  const available = $derived(shapeQualities(settings.shape) as string[]);
  const pool = $derived(drillPool(settings) as Array<{ symbol: string }>);
  const leftOut = $derived(settings.qualities.filter(quality => !available.includes(quality)));
  const chart = $derived(
    (progressionFor(settings.progression, settings.key) as { key: string; bars: Array<{ chords: Array<{ symbol: string }> }> }));
  const ready = $derived(settings.mode === 'progression' || pool.length > 0);

  const named = (quality: string) => quality || 'major';
  const progressions = Object.entries(PROGRESSIONS as Record<string, { name: string }>);

  function toggle(list: 'qualities' | 'keys', item: string) {
    const chosen = settings[list];
    settings[list] = chosen.includes(item) ? chosen.filter(entry => entry !== item) : [...chosen, item];
  }

  function start() {
    const plan = trainingPlan($state.snapshot(settings)) as Omit<PracticePlan, 'id'> | null;
    if (plan) onstart(plan);
  }
</script>

<section class="training">
  <header class="head">
    <div>
      <h1>Training</h1>
      <p class="sub">
        Practise anything, for as long as you like. No stars and nothing to open — the minutes
        count, and what you miss comes back in Review.
      </p>
    </div>
    <button type="button" class="back" onclick={onback}>← Back</button>
  </header>

  {#if last}
    <p class="last">
      Last stretch: {last.minutes < 1 ? 'under a minute' : `${last.minutes} min`} ·
      {last.played} {last.played === 1 ? 'chord' : 'chords'} · {last.clean} clean
    </p>
  {/if}

  <div class="modes" role="group" aria-label="What to practise">
    <button type="button" class:on={settings.mode === 'drill'} aria-pressed={settings.mode === 'drill'}
            onclick={() => (settings.mode = 'drill')}>
      Drill
      <span>one chord at a time, drawn at random</span>
    </button>
    <button type="button" class:on={settings.mode === 'progression'} aria-pressed={settings.mode === 'progression'}
            onclick={() => (settings.mode = 'progression')}>
      Progression
      <span>a set of changes, round and round</span>
    </button>
  </div>

  <div class="card">
    {#if settings.mode === 'drill'}
      <div class="field">
        <h2>Chords</h2>
        {#each QUALITY_GROUPS as group (group.name)}
          <div class="chips" role="group" aria-label={group.name}>
            <span class="group">{group.name}</span>
            {#each group.qualities as quality (quality)}
              <button type="button" class="chip mono" class:on={settings.qualities.includes(quality)}
                      aria-pressed={settings.qualities.includes(quality)}
                      disabled={!available.includes(quality)}
                      title={available.includes(quality) ? undefined : `No ${shape.label.toLowerCase()} voicing for this chord`}
                      onclick={() => toggle('qualities', quality)}>{named(quality)}</button>
            {/each}
          </div>
        {/each}
      </div>

      <div class="field">
        <h2>
          Keys
          <span class="quick">
            <button type="button" class="link" onclick={() => (settings.keys = [...KEYS])}>all</button>
            <button type="button" class="link" onclick={() => (settings.keys = [])}>none</button>
          </span>
        </h2>
        <div class="chips" role="group" aria-label="Keys">
          {#each KEYS as key (key)}
            <button type="button" class="chip mono" class:on={settings.keys.includes(key)}
                    aria-pressed={settings.keys.includes(key)}
                    onclick={() => toggle('keys', key)}>{key}</button>
          {/each}
        </div>
      </div>

      <div class="field">
        <h2>Shape</h2>
        <div class="chips" role="group" aria-label="Shape">
          {#each SHAPES as entry (entry.id)}
            <button type="button" class="chip" class:on={settings.shape === entry.id}
                    aria-pressed={settings.shape === entry.id}
                    onclick={() => (settings.shape = entry.id)}>{entry.label}</button>
          {/each}
        </div>
      </div>
    {:else}
      <div class="field">
        <h2>Progression</h2>
        <div class="chips" role="group" aria-label="Progression">
          {#each progressions as [id, entry] (id)}
            <button type="button" class="chip" class:on={settings.progression === id}
                    aria-pressed={settings.progression === id}
                    onclick={() => (settings.progression = id)}>{entry.name}</button>
          {/each}
        </div>
      </div>

      <div class="field">
        <h2>Key</h2>
        <div class="chips" role="group" aria-label="Key">
          {#each KEYS as key (key)}
            <button type="button" class="chip mono" class:on={settings.key === key}
                    aria-pressed={settings.key === key}
                    onclick={() => (settings.key = key)}>{key}</button>
          {/each}
        </div>
        <!-- The changes as a chart writes them, so the key that was picked can be read before it
             is played. In Db and Gb a minor tune is written from C# and F#, and this shows it. -->
        <p class="chart">| {chart.bars.map(bar => bar.chords.map(chord => chord.symbol).join(' ')).join(' | ')} |</p>
      </div>
    {/if}

    <div class="field">
      <h2>Tempo</h2>
      <label class="tempo">
        <input type="range" min={TEMPO_RANGE.min} max={TEMPO_RANGE.max} step="2" bind:value={settings.tempo} />
        <span class="bpm">{settings.tempo} bpm</span>
      </label>
      <p class="note">For the metronome, which you start from the keyboard screen when you want it.</p>
    </div>

    <div class="go-row">
      <button type="button" class="go" disabled={!ready} onclick={start}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6L19 12z"></path></svg>
        Start
      </button>
      {#if settings.mode === 'drill'}
        <p class="note">
          {#if pool.length === 0 && (!settings.qualities.length || !settings.keys.length)}
            Pick at least one chord and one key.
          {:else if pool.length === 0}
            None of these chords has a {shape.label.toLowerCase()} voicing. Pick another shape, or other chords.
          {:else}
            {pool.length} {pool.length === 1 ? 'chord' : 'chords'} to draw from{#if leftOut.length}; {leftOut.map(named).join(', ')}
              left out — no {shape.label.toLowerCase()} voicing{/if}.
          {/if}
        </p>
      {/if}
    </div>
  </div>
</section>

<style>
  .training { max-width: 900px; margin: 0 auto; padding: 32px 32px 56px; }
  .head { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px; margin-bottom: 22px; }
  .head div { flex: 999 1 320px; }
  h1 { margin: 0 0 6px; font-size: 30px; font-weight: 600; letter-spacing: -0.03em; }
  .sub { margin: 0; max-width: 60ch; color: var(--ink-muted); font-size: 15px; }
  .last { margin: 0 0 18px; font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink-muted); }
  .modes { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
  .modes button {
    flex: 1 1 240px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
    padding: 16px 20px; border-radius: 14px; font-size: 17px; font-weight: 600; text-align: left;
  }
  .modes button span { font-size: 13px; font-weight: 400; color: var(--ink-muted); }
  .modes button.on { border-color: var(--ink); background: #16191c; }
  .card { border: 1px solid var(--border); border-radius: 16px; background: var(--surface); padding: 22px 24px; }
  .field { margin-bottom: 24px; }
  h2 {
    display: flex; align-items: baseline; gap: 14px;
    margin: 0 0 10px; font-size: 12px; font-weight: 500; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--ink-muted);
  }
  .quick { display: inline-flex; gap: 10px; letter-spacing: 0; text-transform: none; }
  .chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
  .group { flex: 0 0 132px; font-size: 13px; color: var(--ink-muted); }
  button {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 11px 20px; border: 1px solid var(--border); border-radius: 10px;
    background: #16191c; color: var(--ink); font: inherit; font-size: 14px; cursor: pointer;
  }
  button:hover:not(:disabled) { border-color: var(--ink-muted); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button:disabled { opacity: 0.32; cursor: not-allowed; }
  .back { padding: 8px 14px; font-size: 13px; }
  .chip { padding: 7px 13px; border-radius: 999px; font-size: 13px; }
  .chip.mono { font-family: ui-monospace, monospace; }
  /* White, like every other chosen thing in the shell: the accent is for the way forward, and a
     theory colour here would read as a verdict on the chord. */
  .chip.on { background: var(--ink); color: #14171a; border-color: var(--ink); }
  .link { padding: 0; border: none; background: none; font-size: 12px; color: var(--ink-muted); text-decoration: underline; }
  .link:hover:not(:disabled) { color: var(--ink); }
  .chart { margin: 12px 0 0; font-family: ui-monospace, monospace; font-size: 13px; line-height: 1.7; color: var(--ink-muted); }
  .tempo { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
  .tempo input { flex: 1 1 260px; max-width: 420px; accent-color: var(--ink); }
  .bpm { font-family: ui-monospace, monospace; font-size: 15px; }
  .note { margin: 8px 0 0; font-size: 13px; color: var(--ink-muted); }
  .go-row { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; }
  .go-row .note { margin: 0; flex: 1 1 260px; }
  button.go { background: var(--ink); color: #14171a; border-color: var(--ink); font-size: 16px; font-weight: 600; padding: 14px 26px; }
</style>
