import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

// The engine lives one level up, in ../src, and is imported untouched: plain ES modules with no
// dependencies, no build step of their own, and the same files Node runs under `npm test`. Vite
// refuses to serve anything outside its root unless it is allowed, so the repo root is listed
// here. Nothing is copied into this folder, and nothing in ../src may import from here.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  // Relative, so the build can be served from a subpath on GitHub Pages without rewriting it.
  base: './',
  server: { fs: { allow: [repoRoot] } },
  build: { outDir: 'dist', emptyOutDir: true },
});
