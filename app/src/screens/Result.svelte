<script lang="ts">
  import type { scoreRun } from '../bridge/theory';

  type Score = NonNullable<ReturnType<typeof scoreRun>>;
  type Weakness = { key: string; problem: string; count: number } | null;

  let { name, score, xp, weakness, timed, threshold, onagain, onexit }: {
    name: string;
    score: Score;
    xp: number;
    weakness: Weakness;
    timed: boolean;
    threshold: number;
    onagain: () => void;
    onexit: () => void;
  } = $props();

  const percent = (share: number) => `${Math.round(share * 100)}%`;
</script>

<section class="result">
  <!-- White, not magenta and not a theory colour: the accent never lands in a verdict, and an
       amber star would read as "avoid note" (assets/BRAND.md). -->
  <div class="stars" role="img" aria-label="{score.stars} of 3 stars">
    {#each [1, 2, 3] as position (position)}
      <svg width="52" height="52" viewBox="0 0 24 24" aria-hidden="true"
           fill={position <= score.stars ? '#f4f2ee' : 'none'}
           stroke={position <= score.stars ? 'none' : '#3a4046'} stroke-width="1.6">
        <path d="M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.7l-5.9 3.1 1.2-6.6L2.5 9.6l6.6-.9z"></path>
      </svg>
    {/each}
  </div>

  <h2>{score.label ?? 'Not yet'}</h2>
  <p class="sub">{name}</p>

  <div class="tiles">
    <div class="tile">
      <p class="big">+{xp}</p>
      <p class="label">XP — quality, not volume</p>
    </div>
    <div class="tile">
      <p class="big">{score.right} / {score.total}</p>
      <p class="label">right ({percent(score.rightShare)})</p>
    </div>
    <div class="tile">
      <p class="big">{score.clean} / {score.total}</p>
      <p class="label">clean ({percent(score.cleanShare)})</p>
    </div>
    <div class="tile">
      <p class="big">{score.movement === null ? '—' : score.movement.toFixed(2)}</p>
      <p class="label">semitones moved, per voice</p>
    </div>
  </div>

  <div class="fix">
    <p class="kicker">One thing to fix</p>
    {#if weakness}
      <p class="what">On <code>{weakness.key || 'major triad'}</code> chords — {weakness.problem}, {weakness.count} time{weakness.count === 1 ? '' : 's'}</p>
    {:else}
      <p class="what">Nothing to report. Every chord you played came back clean.</p>
    {/if}
  </div>

  {#if score.stars === 2 && !timed}
    <p class="locked">The third star needs the timed run — free play tops out here.</p>
  {:else if score.stars === 2 && timed && score.movement !== null}
    <p class="locked">Timed and clean. The third star wants the voices moving less: {score.movement.toFixed(2)} semitones each, and this level asks for {threshold}.</p>
  {/if}

  <div class="buttons">
    <button type="button" class="again" onclick={onagain}>Once more</button>
    <button type="button" onclick={onexit}>Back to the path</button>
  </div>
</section>

<style>
  .result { max-width: 760px; margin: 0 auto; padding: 52px 32px 48px; text-align: center; }
  .stars { display: flex; justify-content: center; gap: 12px; margin-bottom: 22px; }
  h2 { margin: 0 0 6px; font-size: 32px; font-weight: 600; letter-spacing: -0.03em; }
  .sub { margin: 0 0 30px; color: var(--ink-muted); font-size: 15px; }
  .tiles { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
  .tile { flex: 1 1 150px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 16px; }
  .big { margin: 0 0 4px; font-family: ui-monospace, monospace; font-size: 24px; font-weight: 600; }
  .label { margin: 0; font-size: 13px; color: var(--ink-muted); }
  .fix { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 20px 22px; text-align: left; }
  .kicker { margin: 0 0 8px; font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted); }
  .what { margin: 0; font-size: 17px; }
  code { font-family: ui-monospace, monospace; }
  .locked { margin: 18px 0 0; font-size: 13px; color: var(--ink-muted); }
  .buttons { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 28px; }
  button {
    padding: 14px 28px; border: 1px solid var(--border); border-radius: 12px;
    background: var(--surface); color: var(--ink); font: inherit; font-size: 16px; cursor: pointer;
  }
  button.again { background: var(--ink); color: #14171a; border-color: var(--ink); font-weight: 600; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
