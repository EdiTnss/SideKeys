#!/usr/bin/env node
// Measures a truly cold first visit to the published game, for the P1 definition of done in
// docs/PRODUCT.md: "a new visitor goes from opening the page to a first chord played".
//
// Each run starts headless Chrome on a brand-new profile — no HTTP cache, no service worker, no
// stored progress — loads the page over the real network, and drives it the way a new visitor
// has to: wait for the Play button, press it, wait for the chord, play it on the letter keys,
// wait for the verdict. It does all of that as fast as a machine can, so what comes out is the
// floor. Everything a person adds on top is reading and deciding, which this cannot measure.
//
//   node tools/cold-start.mjs            three runs on this connection
//   node tools/cold-start.mjs 5 slow     five runs throttled to a slow 4G link
//
// No dependencies: Chrome's DevTools protocol over Node's own WebSocket and fetch (Node 22+).
// CHROME and SIDEKEYS_URL override the browser and the page.
//
// The name avoids the patterns `node --test` takes for test files (see quiet-report.mjs).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PAGE = process.env.SIDEKEYS_URL ?? 'https://editnss.github.io/SideKeys/';
const CHROME = process.env.CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const runs = Number(process.argv[2] ?? 3);
const slow = process.argv[3] === 'slow';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Runs inside the page from the first line of the document, so nothing is missed. The 120 ms the
// keys are held and the 300 ms the capture waits before judging are part of the "verdict" time:
// they are how the game works, not how long it took to load.
const DRIVER = `(() => {
  if (window.top !== window) return;
  const marks = {};
  window.__marks = marks;
  const until = async find => { for (;;) { const found = find(); if (found) return found; await new Promise(r => setTimeout(r, 4)); } };
  const LETTERS = { C: ['KeyA','KeyD','KeyG'], F: ['KeyF','KeyH','KeyK'], G: ['KeyG','KeyJ','KeyL'], D: ['KeyS','KeyT','KeyH'] };
  (async () => {
    const play = await until(() => document.querySelector('.hero .go'));
    marks.playButton = performance.now();
    play.click();
    await until(() => document.querySelector('.ask'));
    marks.chordAsked = performance.now();
    marks.asked = document.querySelector('.ask').textContent.trim();
    const codes = LETTERS[marks.asked] ?? LETTERS.C;
    for (const code of codes) window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    for (const code of codes) window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    const verdict = await until(() => document.querySelector('.verdict .star'));
    marks.verdict = performance.now();
    marks.verdictText = verdict.textContent.replace(/\\s+/g, ' ').trim();
    await until(() => /piano samples/.test(document.querySelector('.status')?.textContent ?? ''));
    marks.piano = performance.now();
  })();
})();`;

async function connect(port) {
  for (let tries = 0; tries < 100; tries += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find(target => target.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(100);
  }
  throw new Error('Chrome did not open its debugging port');
}

/** A DevTools-protocol session over one WebSocket: send(method, params) resolves with the result. */
function session(url) {
  const socket = new WebSocket(url);
  const waiting = new Map();
  let next = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !waiting.has(message.id)) return;
    const { resolve, reject } = waiting.get(message.id);
    waiting.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  });
  const ready = new Promise(resolve => socket.addEventListener('open', resolve));
  const send = async (method, params = {}) => {
    await ready;
    next += 1;
    const id = next;
    const answer = new Promise((resolve, reject) => waiting.set(id, { resolve, reject }));
    socket.send(JSON.stringify({ id, method, params }));
    return answer;
  };
  return { send, close: () => socket.close() };
}

async function once(port) {
  const profile = mkdtempSync(join(tmpdir(), 'sidekeys-cold-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank',
  ], { stdio: 'ignore' });
  try {
    const cdp = session(await connect(port));
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Runtime.enable');
    if (slow) {
      // Roughly a slow 4G link: 150 ms of latency, 1.6 Mbit/s down, 750 kbit/s up.
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750,
      });
    }
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: DRIVER });
    await cdp.send('Page.navigate', { url: PAGE });

    const read = async expression => (await cdp.send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
    let marks = null;
    for (let tries = 0; tries < 900; tries += 1) {
      marks = await read('window.__marks ? JSON.stringify(window.__marks) : null').catch(() => null);
      if (marks && JSON.parse(marks).piano) break;
      await sleep(100);
    }
    // performance.now() counts from the start of the navigation, so every mark is "since the
    // page was opened". Resource Timing gives the bytes that actually crossed the network.
    const timing = JSON.parse(await read(`JSON.stringify((() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint');
      const resources = performance.getEntriesByType('resource');
      const marks = window.__marks ?? {};
      const sum = list => list.reduce((total, entry) => total + (entry.transferSize || 0), 0);
      const before = limit => resources.filter(entry => entry.responseEnd <= limit);
      return {
        responseStart: nav.responseStart,
        firstPaint: paint ? paint.startTime : null,
        bytesToVerdict: nav.transferSize + sum(before(marks.verdict ?? Infinity)),
        requestsToVerdict: 1 + before(marks.verdict ?? Infinity).length,
        bytesTotal: nav.transferSize + sum(resources),
        requestsTotal: 1 + resources.length,
      };
    })())`));
    cdp.close();
    return { ...JSON.parse(marks ?? '{}'), ...timing };
  } finally {
    chrome.kill();
    await sleep(600);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file for a moment */ }
  }
}

const ms = value => (value == null ? '     —' : String(Math.round(value)).padStart(6));
const kb = value => `${(value / 1024).toFixed(0)} KB`;
console.log(`${PAGE}  ·  a new profile each run  ·  ${slow ? 'slow 4G (150 ms, 1.6 Mbit/s)' : 'this connection, unthrottled'}`);
console.log('run  first byte  first paint  Play there  chord asked  verdict  piano in    by the verdict      in all');
const results = [];
for (let run = 1; run <= runs; run += 1) {
  const result = await once(9333 + run);
  results.push(result);
  console.log(`${String(run).padStart(3)}  ${ms(result.responseStart)}      ${ms(result.firstPaint)}      ${ms(result.playButton)}       ${ms(result.chordAsked)}   ${ms(result.verdict)}    ${ms(result.piano)}    ${kb(result.bytesToVerdict)} in ${result.requestsToVerdict}    ${kb(result.bytesTotal)} in ${result.requestsTotal}    "${result.verdictText}"`);
}
const median = key => {
  const sorted = results.map(result => result[key]).filter(value => value != null).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
console.log(`median (ms): Play button ${Math.round(median('playButton'))}, verdict ${Math.round(median('verdict'))}, piano loaded ${Math.round(median('piano'))}`);
// Node on Windows can trip a libuv assertion when it exits with sockets still closing; let them.
await sleep(300);
