<script lang="ts">
  import { pathState } from '../bridge/game';
  import type { LevelPlan, Unit } from '../game/level.svelte';
  import { sayBlurb, sayLevel, sayUnit } from '../lib/locale.svelte';

  type Entry = {
    unit: Unit;
    /** Its place on the path, counted from one: the number in the dot. */
    number: number;
    stars: number;
    maxStars: number;
    levels: Array<{ level: LevelPlan; stars: number; unlocked: boolean }>;
  };

  let { stars, onplay, ontheory }: {
    stars: Record<string, number>;
    onplay: (unit: Unit, level: LevelPlan) => void;
    /** The page that explains a unit: every unit on the path has one. */
    ontheory: (unit: string) => void;
  } = $props();

  const units = $derived(pathState(stars) as Entry[]);
</script>

<section class="path">
  <header class="head">
    <div>
      <h1>The Path</h1>
      <p class="sub">Playing from chords, triads through jazz. Every unit is open: start where you are.</p>
    </div>
  </header>

  <ol class="units">
    {#each units as entry (entry.unit.id)}
      <li class="unit">
        <div class="rail">
          <span class="dot" class:done={entry.stars > 0}>{entry.number}</span>
          <span class="line"></span>
        </div>

        <div class="card">
          <div class="title">
            <h2>{sayUnit(entry.unit)}</h2>
            <span class="count">{entry.stars} / {entry.maxStars} stars</span>
          </div>
          <p class="blurb">
            {sayBlurb(entry.unit)}
            <button type="button" class="theory" onclick={() => ontheory(entry.unit.id)}>What is it?</button>
          </p>

          <ul class="levels">
            {#each entry.levels as item (item.level.id)}
              <li class="level">
                {#if item.unlocked}
                  <button type="button" onclick={() => onplay(entry.unit, item.level)}>
                    <span class="name">{sayLevel(item.level)}</span>
                    <span class="stars" aria-label="{item.stars} of 3 stars">
                      {#each [1, 2, 3] as position (position)}
                        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"
                             fill={position <= item.stars ? '#f4f2ee' : 'none'}
                             stroke={position <= item.stars ? 'none' : '#3a4046'} stroke-width="2">
                          <path d="M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.7l-5.9 3.1 1.2-6.6L2.5 9.6l6.6-.9z"></path>
                        </svg>
                      {/each}
                    </span>
                    <span class="tempo">{item.level.tempo} bpm</span>
                  </button>
                {:else}
                  <span class="shut">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="9" rx="2"></rect>
                      <path d="M8.5 11V8a3.5 3.5 0 017 0v3"></path>
                    </svg>
                    {sayLevel(item.level)}
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      </li>
    {/each}
  </ol>

  <p class="note">
    Inversions, shell and rootless units are missing on purpose: the analyzer does not judge a
    required bass or a required texture yet, and a level it cannot grade would be a lie.
  </p>
</section>

<style>
  .path { max-width: 860px; margin: 0 auto; padding: 32px 32px 56px; }
  .head { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; margin-bottom: 30px; }
  .head div { flex: 999 1 380px; }
  h1 { margin: 0 0 6px; font-size: 30px; font-weight: 600; letter-spacing: -0.03em; }
  .sub { margin: 0; color: var(--ink-muted); font-size: 15px; }
  .units { list-style: none; margin: 0; padding: 0; }
  .unit { display: flex; gap: 20px; }
  .rail { display: flex; flex-direction: column; align-items: center; width: 36px; flex-shrink: 0; }
  .dot {
    width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--border); background: var(--surface);
    display: flex; align-items: center; justify-content: center;
    font-family: ui-monospace, monospace; font-size: 14px; color: var(--ink-muted);
  }
  .dot.done { border-color: var(--chord-tone); color: var(--chord-tone); }
  .line { flex-grow: 1; width: 2px; background: var(--border); }
  .unit:last-child .line { display: none; }
  .card {
    flex-grow: 1; min-width: 0; border: 1px solid var(--border); border-radius: 14px;
    background: var(--surface); padding: 18px 20px; margin-bottom: 18px;
  }
  .title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; }
  h2 { margin: 0; font-size: 18px; font-weight: 600; flex-grow: 1; }
  .count { font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink-muted); }
  .blurb { margin: 4px 0 14px; font-size: 14px; color: var(--ink-muted); }
  .levels { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  button {
    width: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
    padding: 11px 14px; border: 1px solid var(--border); border-radius: 10px;
    background: #16191c; color: var(--ink); font: inherit; font-size: 14px; text-align: left; cursor: pointer;
  }
  button:hover { border-color: var(--ink-muted); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  /* A link in the sentence, not another row of the unit: the levels are what the card is for. */
  button.theory {
    width: auto; display: inline; margin-left: 6px; padding: 0; border: none; background: none;
    font-size: 13px; color: var(--ink-muted); text-decoration: underline;
  }
  button.theory:hover { color: var(--ink); }
  .name { flex-grow: 1; }
  .stars { display: inline-flex; gap: 3px; }
  .tempo { font-family: ui-monospace, monospace; font-size: 12px; color: var(--ink-muted); }
  .shut {
    display: flex; align-items: center; gap: 10px; padding: 11px 14px;
    font-size: 14px; color: #5c646b;
  }
  .note { margin: 26px 0 0; font-size: 12px; color: #5c646b; line-height: 1.6; }
</style>
