import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

// The service worker is what makes SideKeys installable and usable with the network off. Only
// in a build: a cached shell during development hides the edit you just made. It is registered
// against the document's own base, so a deploy under a subpath (GitHub Pages) keeps working,
// and its scope is the folder it sits in, which is the whole app.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch((error: Error) => {
      // Not being installable is not worth breaking the app over: everything still runs.
      console.warn('SideKeys: no offline support this time —', error.message);
    });
  });
}

const target = document.getElementById('app');
if (!target) throw new Error('index.html has no #app to mount into');

export default mount(App, { target });
