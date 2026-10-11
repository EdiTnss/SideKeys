import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Svelte 5, runes only: no stores, no `export let`, no reactive `$:` labels. One dialect in the
// shell means one dialect to read and to explain (CLAUDE.md), and no mixing of the two eras.
export default {
  preprocess: vitePreprocess(),
  compilerOptions: { runes: true },
};
