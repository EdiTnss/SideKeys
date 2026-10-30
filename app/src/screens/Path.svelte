<script lang="ts">
  import { pathState } from '../bridge/game';
  import type { LevelPlan, Unit } from '../game/level.svelte';
  import Glossed from '../lib/Glossed.svelte';
  import { sayBlurb, sayLevel, sayUnit, t } from '../lib/locale.svelte';

  type Entry = {
    unit: Unit;
    /** Its place on the path, counted from one: the number in the dot. */
    number: number;
    stars: number;
    maxStars: number;
    levels: Array<{ level: LevelPlan; stars: number; unlocked: boolean }>;
  };

  // The path as a list under the day's step, on the Play door: one row a unit, opened to its
  // levels on a press. The unit with the next level in it starts open.
  let { stars, current = null, onplay, ontheory }: {
    stars: Record<string, number>;
    /** The level "Continue" points at, so its unit can start open and be marked. */
    current?: string | null;
    onplay: (unit: Unit, level: LevelPlan) => void;
    /** The page that explains a unit: every unit on the path has one. */
    ontheory: (unit: string) => void;
  } = $props();

  const units = $derived(pathState(stars) as Entry[]);
  const here = $derived(units.find(entry => entry.levels.some(item => item.level.id === current))?.unit.id ?? null);
  // svelte-ignore state_referenced_locally
  let open = $state<string | null>(here);
</script>

<ol class="units">
  {#each units as entry (entry.unit.id)}
    {@const done = entry.stars === entry.maxStars}
    {@const isHere = entry.unit.id === here}
    <li class="unit" class:here={isHere}>
      <button type="button" class="head" aria-expanded={open === entry.unit.id}
              onclick={() => (open = open === entry.unit.id ? null : entry.unit.id)}>
        <span class="badge" class:done class:current={isHere && !done}>
          {#if done}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>
          {:else}{entry.number}{/if}
        </span>
        <span class="name">
          <span class="title"><Glossed text={sayUnit(entry.unit)} /></span>
          <span class="bar"><span class="fill" class:done style="width: {(100 * entry.stars) / entry.maxStars}%"></span></span>
        </span>
        <span class="count">{entry.stars}/{entry.maxStars} ★</span>
      </button>

      {#if open === entry.unit.id}
        <div class="body">
          <p class="blurb">
            {sayBlurb(entry.unit)}
            <button type="button" class="theory" onclick={() => ontheory(entry.unit.id)}>{t('path.what')}</button>
          </p>
          <ul class="levels">
            {#each entry.levels as item (item.level.id)}
              <li>
                <!-- Every unit is open, but a level inside one may still wait for the one before it. -->
                <button type="button" class="level" class:next={item.level.id === current}
                        disabled={!item.unlocked} onclick={() => onplay(entry.unit, item.level)}>
                  <span class="level-name">
                    {#if !item.unlocked}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8.5 11V8a3.5 3.5 0 017 0v3"></path></svg>
                    {/if}
                    {sayLevel(item.level)}
                  </span>
                  <span class="stars" aria-label={t('common.starsOf3', { count: item.stars })}>
                    {#each [1, 2, 3] as position (position)}
                      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"
                           fill={position <= item.stars ? '#f4f2ee' : 'none'}
                           stroke={position <= item.stars ? 'none' : '#3a4046'} stroke-width="2">
                        <path d="M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.7l-5.9 3.1 1.2-6.6L2.5 9.6l6.6-.9z"></path>
                      </svg>
                    {/each}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </li>
  {/each}
</ol>

<style>
  .units { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .unit { border: 1px solid transparent; border-radius: 12px; }
  .unit.here { background: #14171a; border-color: #3d4247; }
  button { font: inherit; color: var(--ink); cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .head {
    width: 100%; display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 6px 10px;
    border: none; border-radius: 12px; background: none; text-align: left;
  }
  .head:hover { background: #121518; }
  .unit.here .head:hover { background: none; }
  .badge {
    flex: none; width: 28px; height: 28px; border-radius: 50%; border: 1px solid #3d4247;
    display: grid; place-items: center; font-size: 12px; color: var(--ink-muted);
  }
  .badge.done { border: none; background: var(--chord-tone); color: #0a0b0c; }
  .badge.current { border: none; background: var(--ink); color: #0a0b0c; font-weight: 600; }
  .name { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .title { font-size: 14px; }
  .unit.here .title { font-weight: 600; }
  .bar { height: 3px; border-radius: 2px; background: var(--border); overflow: hidden; }
  .fill { display: block; height: 100%; background: var(--ink); }
  .fill.done { background: var(--chord-tone); }
  .count { flex: none; width: 58px; text-align: right; font-size: 12px; color: var(--ink-muted); }
  .body { padding: 0 10px 12px 50px; }
  .blurb { margin: 2px 0 10px; font-size: 13px; line-height: 1.45; color: var(--ink-muted); }
  .theory { display: inline; margin-left: 4px; padding: 0; border: none; background: none; font-size: 13px; color: var(--ink-muted); text-decoration: underline; }
  .theory:hover { color: var(--ink); }
  .levels { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .level {
    width: 100%; display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px;
    border: 1px solid var(--border); border-radius: 10px; background: #16191c; text-align: left; font-size: 14px;
  }
  .level:hover:not(:disabled) { border-color: var(--ink-muted); }
  .level.next { border-color: var(--ink); }
  .level:disabled { cursor: default; color: #5c646b; background: none; }
  .level-name { flex: 1; display: inline-flex; align-items: center; gap: 8px; }
  .stars { display: inline-flex; gap: 2px; }
</style>
