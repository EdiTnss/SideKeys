// A sampled piano, shaped as a MIDI output port exactly like audio/synth.js, so the app can
// send to it without knowing which one it is. Browser only below the pure functions.
//
// Why samples at all: the oscillator synth is honest but thin, and DIRECTION.md puts a real
// piano sound among the things that decide whether the game feels like an instrument. The
// recordings themselves are not in the repo yet — which pack, under which licence, is Edi's
// decision (DIRECTION.md, open decision 4). Until they arrive, `app/public/piano/manifest.json`
// says "samples": null, the page reads it once, and the caller keeps the synth. No 404, no
// guessing: the same way demo/manifest.json names the demo files that exist.
//
// The files live under the shell's `public/`, because they are fetched at runtime rather than
// imported: Vite serves that folder at the root and copies it into the build. The path is
// relative, so it still resolves when the app is served from a subpath on Pages.
//
// One recording every few semitones is enough: the rest are played by shifting the nearest one,
// which is what every sampler does. Shifting more than a few semitones starts to sound like a
// tape, so the pack should hold a sample at least every three.

import { audioContext, clockStamp, toContextTime } from './context.js';
import { synthCommand } from './synth.js';

const DEFAULT_RELEASE = 0.4;
const MAX_RELEASE = 4;

/** How fast to play `sampleMidi` so it sounds as `midi`. Equal temperament, so a ratio of two. */
export function playbackRate(sampleMidi, midi) {
  return 2 ** ((midi - sampleMidi) / 12);
}

/**
 * Which recording answers for a key: the nearest one. On an exact tie the lower sample wins —
 * shifting up keeps the attack crisp, while shifting down smears it.
 */
export function nearestSample(midi, available) {
  let best = null;
  for (const candidate of available) {
    if (best === null || Math.abs(candidate - midi) < Math.abs(best - midi)) best = candidate;
  }
  return best;
}

/**
 * The manifest, checked rather than trusted: a bad file must leave the page on the synth, not
 * half-loaded. → { release, samples: [{ midi, file }] } sorted by note, or null for "no piano".
 */
export function parsePianoManifest(data) {
  if (!data || typeof data !== 'object' || data.format !== 1) return null;
  if (!data.samples || typeof data.samples !== 'object') return null;

  const samples = [];
  for (const [key, file] of Object.entries(data.samples)) {
    const midi = Number(key);
    if (!Number.isInteger(midi) || midi < 0 || midi > 127) return null;
    if (typeof file !== 'string' || file.length === 0) return null;
    samples.push({ midi, file });
  }
  if (samples.length === 0) return null;
  samples.sort((a, b) => a.midi - b.midi);

  const asked = typeof data.release === 'number' && data.release > 0 ? data.release : DEFAULT_RELEASE;
  return { release: Math.min(asked, MAX_RELEASE), samples };
}

/** 0 to 1, with the same soft curve as the synth: a quiet note is still heard, six do not clip. */
export function velocityGain(velocity) {
  const clamped = Math.max(0, Math.min(127, velocity));
  return (clamped / 127) ** 1.4;
}

/**
 * createPiano({ context, manifest, load, name, master }) → a MIDI output port:
 * { id, name, type, state, send(data, time), clear(), ready }. `manifest` is what
 * parsePianoManifest returned; `load(file)` fetches one recording as an ArrayBuffer, so the
 * loading can be swapped in a test or pointed at another folder.
 */
export function createPiano({
  context = null,
  manifest,
  load,
  baseUrl = '',
  name = 'Piano',
  master = 0.8,
} = {}) {
  let ctx = context;
  let out = null;
  const buffers = new Map();        // sample midi → AudioBuffer
  const voices = new Map();         // `${channel}:${note}` → the sources sounding for it

  function ready() {
    ctx ??= audioContext();
    if (!out) {
      out = ctx.createGain();
      out.gain.value = master;
      out.connect(ctx.destination);
    }
    return ctx;
  }

  // Every recording is fetched once, up front: a piano that loads a note the first time you
  // play it would be late exactly when it matters.
  const loaded = (async () => {
    const context_ = ready();
    await Promise.all(manifest.samples.map(async ({ midi, file }) => {
      const data = await load(`${baseUrl}${file}`);
      buffers.set(midi, await context_.decodeAudioData(data));
    }));
    return true;
  })();

  function start({ channel, note, velocity }, at) {
    const sample = nearestSample(note, [...buffers.keys()]);
    if (sample === null) return;
    const source = ctx.createBufferSource();
    source.buffer = buffers.get(sample);
    source.playbackRate.value = playbackRate(sample, note);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(velocityGain(velocity), at);
    source.connect(gain).connect(out);
    source.start(at);

    const key = `${channel}:${note}`;
    if (!voices.has(key)) voices.set(key, []);
    voices.get(key).push({ source, gain });
    source.onended = () => {
      const sounding = voices.get(key);
      if (!sounding) return;
      const at_ = sounding.findIndex(voice => voice.source === source);
      if (at_ >= 0) sounding.splice(at_, 1);
      if (sounding.length === 0) voices.delete(key);
    };
  }

  function release(key, at) {
    for (const { source, gain } of voices.get(key) ?? []) {
      // A piano key does not stop, it decays: the damper takes the string down over a moment.
      gain.gain.cancelScheduledValues(at);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + manifest.release);
      source.stop(at + manifest.release + 0.02);
    }
    voices.delete(key);
  }

  function send(data, time) {
    const command = synthCommand(data);
    if (!command) return;
    ready();
    const stamped = time ? toContextTime(time, clockStamp(ctx)) : ctx.currentTime;
    const at = Math.max(ctx.currentTime, stamped);
    if (command.kind === 'on') start(command, at);
    else if (command.kind === 'off') release(`${command.channel}:${command.note}`, at);
    else for (const key of [...voices.keys()]) if (key.startsWith(`${command.channel}:`)) release(key, at);
  }

  return {
    id: 'piano',
    name,
    type: 'output',
    state: 'connected',
    send,
    clear() {
      const at = ready().currentTime;
      for (const key of [...voices.keys()]) release(key, at);
    },
    /** Resolves when every recording is decoded; the caller can wait before announcing it. */
    ready: loaded,
  };
}

/**
 * Fetches the manifest and, if it names any recordings, returns a piano port. Anything missing
 * or malformed returns null, and the caller stays on the synth — a silent instrument would be
 * worse than a thin one.
 */
export async function loadPiano({ baseUrl = 'piano/', fetch: fetchIt = globalThis.fetch, context = null } = {}) {
  try {
    const response = await fetchIt(`${baseUrl}manifest.json`);
    if (!response.ok) return null;
    const manifest = parsePianoManifest(await response.json());
    if (!manifest) return null;
    const piano = createPiano({
      context,
      manifest,
      baseUrl,
      load: async file => {
        const sample = await fetchIt(file);
        if (!sample.ok) throw new Error(`piano sample missing: ${file}`);
        return sample.arrayBuffer();
      },
    });
    await piano.ready;
    return piano;
  } catch {
    return null;
  }
}
