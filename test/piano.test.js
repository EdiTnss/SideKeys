// The sampled piano's arithmetic: which recording answers for a key, and how far it is shifted.
// The audio graph itself is browser-only and is checked in the page, like the synth's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestSample, playbackRate, parsePianoManifest, velocityGain, loadPiano } from '../src/audio/piano.js';

test('playbackRate: an octave up is twice the speed, the same note is untouched', () => {
  assert.equal(playbackRate(60, 60), 1);
  assert.equal(playbackRate(60, 72), 2);
  assert.equal(playbackRate(60, 48), 0.5);
  assert.ok(Math.abs(playbackRate(60, 61) - 1.059463) < 0.000001);
});

test('nearestSample: the closest recording, and the lower one when two are equally close', () => {
  const available = [36, 39, 42, 45];
  assert.equal(nearestSample(36, available), 36);
  assert.equal(nearestSample(37, available), 36);
  assert.equal(nearestSample(38, available), 39);
  // Exactly between two: take the lower and shift up, which keeps the attack crisp.
  assert.equal(nearestSample(40.5, available), 39);
  assert.equal(nearestSample(12, available), 36, 'below everything, the lowest one answers');
  assert.equal(nearestSample(96, available), 45, 'above everything, the highest one does');
  assert.equal(nearestSample(60, []), null, 'no recordings, no answer');
});

test('parsePianoManifest: reads what it wrote, and refuses anything else', () => {
  const good = parsePianoManifest({ format: 1, release: 0.4, samples: { 36: 'C2.ogg', 48: 'C3.ogg' } });
  assert.deepEqual(good, { release: 0.4, samples: [{ midi: 36, file: 'C2.ogg' }, { midi: 48, file: 'C3.ogg' }] });

  // "There are none yet" is a valid answer, and the reason the file is published empty: the page
  // asks for it once, gets a straight no, and falls back to the synth without a 404 in the console.
  assert.equal(parsePianoManifest({ format: 1, samples: null }), null);
  assert.equal(parsePianoManifest(null), null);
  assert.equal(parsePianoManifest({ format: 2, samples: { 36: 'C2.ogg' } }), null, 'a format we do not know');
  assert.equal(parsePianoManifest({ format: 1, samples: { 999: 'x.ogg' } }), null, 'not a MIDI note');
  assert.equal(parsePianoManifest({ format: 1, samples: { 36: 42 } }), null, 'not a file name');
  assert.equal(parsePianoManifest({ format: 1, samples: {} }), null, 'an empty set is no piano');
});

test('loadPiano: a recording that does not arrive leaves the synth, and says why', async t => {
  // Without the reason, a missing pack and a broken one look the same from the page: both are
  // just a thin synth where a piano should be.
  const warn = t.mock.method(console, 'warn', () => {});
  const context = {
    createGain: () => ({ gain: { value: 0 }, connect() {} }),
    destination: {},
    decodeAudioData: async () => ({}),
  };
  const manifest = { format: 1, samples: { 36: 'C2.ogg', 48: 'C3.ogg' } };
  const fetch = async url => url.endsWith('manifest.json')
    ? { ok: true, json: async () => manifest }
    : { ok: !url.endsWith('C3.ogg'), arrayBuffer: async () => new ArrayBuffer(8) };

  assert.equal(await loadPiano({ fetch, context }), null);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments.join(' '), /C3\.ogg/);
});

test('loadPiano: no recordings published is a plain no, not a warning', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const fetch = async () => ({ ok: true, json: async () => ({ format: 1, samples: null }) });
  assert.equal(await loadPiano({ fetch }), null);
  assert.equal(warn.mock.callCount(), 0);
});

test('parsePianoManifest: the release time has a sane default and a sane range', () => {
  assert.equal(parsePianoManifest({ format: 1, samples: { 36: 'a.ogg' } }).release, 0.4);
  assert.equal(parsePianoManifest({ format: 1, release: 1.2, samples: { 36: 'a.ogg' } }).release, 1.2);
  assert.equal(parsePianoManifest({ format: 1, release: -3, samples: { 36: 'a.ogg' } }).release, 0.4);
  assert.equal(parsePianoManifest({ format: 1, release: 99, samples: { 36: 'a.ogg' } }).release, 4, 'capped');
});

test('velocityGain: soft stays audible, loud never clips a six-note voicing', () => {
  assert.equal(velocityGain(0), 0);
  assert.equal(velocityGain(127), 1);
  assert.ok(velocityGain(64) > 0.3 && velocityGain(64) < 0.6, `mid velocity was ${velocityGain(64)}`);
  assert.ok(velocityGain(20) > 0.05, 'a quiet note must still be heard');
  assert.ok(velocityGain(100) < velocityGain(120));
});
