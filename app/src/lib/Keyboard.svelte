<script lang="ts">
  // Drawn by the engine's own keyboard, not redrawn here: the layout maths (where a black key
  // sits, which keys carry a label) is written and working in src/ui/keyboard.js, and a second
  // copy would be a second set of bugs. Svelte owns when it is highlighted; that module owns
  // what it looks like.
  import { createKeyboard } from '../../../src/ui/keyboard.js';

  type Props = {
    classes?: Record<number, string>;
    onkey?: (midi: number) => void;
    from?: number;
    to?: number;
  };

  // C2–C6: wide enough for two hands, narrow enough that a key is clickable on a laptop.
  let { classes = {}, onkey, from = 36, to = 84 }: Props = $props();

  let svg = $state<SVGSVGElement | null>(null);
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
</script>

<!-- The keys answer the mouse through the module's own pointer handler. Replacing them with real
     buttons is on the list for the game screen proper, where the keyboard is the main control. -->
{#key `${from}-${to}`}
  <svg bind:this={svg} class="keyboard" aria-label="On-screen piano keyboard"></svg>
{/key}
