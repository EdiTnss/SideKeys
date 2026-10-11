<script lang="ts">
  import Game from './screens/Game.svelte';
</script>

<header>
  <span class="logo">
    <svg width="24" height="24" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="14" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
      <rect x="24" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
      <rect x="34" y="16" width="7" height="32" rx="2" fill="currentColor"></rect>
      <rect x="45" y="22" width="7" height="32" rx="2" fill="var(--accent)"></rect>
    </svg>
    Side<span class="accent">Keys</span>
  </span>
  <span class="tag">shell · the loop, first</span>
</header>

<main>
  <Game />
</main>

<style>
  header {
    display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
    padding: 16px 32px; border-bottom: 1px solid var(--border);
  }
  .logo {
    display: flex; align-items: center; gap: 10px;
    font-weight: 600; font-size: 17px; letter-spacing: -0.03em; color: var(--ink);
  }
  .accent { color: var(--accent); }
  .tag { margin-left: auto; font-size: 13px; color: var(--ink-muted); }
</style>
