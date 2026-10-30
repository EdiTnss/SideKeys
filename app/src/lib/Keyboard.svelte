<script lang="ts">
  // Drawn by the engine's own keyboard, not redrawn here: the layout maths (where a black key
  // sits, which keys carry a label) is written and working in src/ui/keyboard.js, and a second
  // copy would be a second set of bugs. Svelte owns when it is highlighted; that module owns
  // what it looks like.
  import { untrack } from 'svelte';
  import { createKeyboard } from '../../../src/ui/keyboard.js';

  type Props = {
    classes?: Record<number, string>;
    onkey?: (midi: number) => void;
    from?: number;
    to?: number;
    /** Goes up by one for every chord played right: each played key throws a few sparks. */
    burst?: number;
  };

  // C2–C6: wide enough for two hands, narrow enough that a key is clickable on a laptop.
  let { classes = {}, onkey, from = 36, to = 84, burst = 0 }: Props = $props();

  let svg = $state<SVGSVGElement | null>(null);
  let stage = $state<HTMLDivElement | null>(null);
  let keyboard = $state<{ highlight: (classes: Record<number, string>) => void } | null>(null);

  // A new range is a new element (the {#key} below), so the module draws it once and attaches its
  // pointer handler once; redrawing the old element would answer every press twice.
  $effect(() => {
    if (svg) keyboard = createKeyboard(svg, { from, to, onKey: onkey });
  });

  // Re-reads `classes` whenever the analysis changes, and after the keyboard exists.
  $effect(() => {
    keyboard?.highlight(classes);
  });

  // Each spark takes the colour of the key it leaves, by role: the fill itself is still fading
  // in from the grey of a held key at this moment, so it cannot be read off the key.
  const ROLE_COLOURS: Record<string, string> = {
    'role-chordTone': 'var(--chord-tone)',
    'role-tension': 'var(--tension)',
    'role-altered': 'var(--altered)',
    'role-avoid': 'var(--avoid)',
  };

  // A chord played right: four sparks fly up out of every played key (Edi chose this on
  // 2026-10-30, docs/spec-game.md). Next frame, so the verdict's classes are already on the keys.
  $effect(() => {
    if (!burst) return;
    untrack(() => requestAnimationFrame(sparkle));
  });

  function sparkle() {
    if (!stage || !svg || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const base = stage.getBoundingClientRect();
    for (const rect of svg.querySelectorAll('rect')) {
      const role = [...rect.classList].find(name => name in ROLE_COLOURS);
      if (!role) continue;
      const box = rect.getBoundingClientRect();
      for (let i = 0; i < 4; i++) {
        const dot = document.createElement('span');
        dot.className = 'spark';
        dot.style.left = `${box.left - base.left + box.width / 2 - 2.5}px`;
        dot.style.top = `${box.top - base.top + box.height * 0.35}px`;
        dot.style.background = ROLE_COLOURS[role];
        dot.style.setProperty('--dx', `${(Math.random() - 0.5) * 34}px`);
        dot.style.setProperty('--dy', `${-28 - Math.random() * 30}px`);
        dot.style.animationDelay = `${i * 25}ms`;
        // A hidden tab runs no animation and never says it ended: the clock clears them too.
        dot.addEventListener('animationend', () => dot.remove());
        setTimeout(() => dot.remove(), 1000);
        stage.append(dot);
      }
    }
  }
</script>

<!-- The keys answer the mouse through the module's own pointer handler. Replacing them with real
     buttons is on the list for the game screen proper, where the keyboard is the main control. -->
<div class="stage" bind:this={stage}>
  {#key `${from}-${to}`}
    <svg bind:this={svg} class="keyboard" aria-label="On-screen piano keyboard"></svg>
  {/key}
</div>

<style>
  .stage { position: relative; }
</style>
