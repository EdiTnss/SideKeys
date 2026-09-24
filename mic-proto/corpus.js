// The corpus is not invented: it is what Edi actually played on Genos on
// 2026-09-19, reconstructed from the recorded tape in harness/sessions/.
// Each item keeps the real note-on times and velocities, the chord it was played
// against, and the verdict the app gave at the time.
import { readFileSync } from 'node:fs';

const RELEASE_TAIL_MS = 80; // dampers land fast, but not instantly

export function readTape(file) {
  const events = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const text = line.trim().replace(/,$/, '');
    if (!text.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(text);
      if (parsed.type) events.push(parsed);
    } catch { /* the wrapper lines are not events */ }
  }
  return events;
}

// note-on / note-off pairs, with velocity, across the whole session
function notesPlayed(events) {
  const open = new Map(); // note -> { note, velocity, onMs }
  const played = [];
  for (const event of events) {
    if (event.type !== 'midi') continue;
    const [status, note, velocity] = event.data;
    const kind = status & 0xf0;
    if (kind === 0x90 && velocity > 0) {
      if (open.has(note)) {
        const held = open.get(note);
        held.offMs = event.t;
        played.push(held);
      }
      open.set(note, { note, velocity, onMs: event.t });
    } else if (kind === 0x80 || (kind === 0x90 && velocity === 0)) {
      const held = open.get(note);
      if (held) {
        held.offMs = event.t;
        played.push(held);
        open.delete(note);
      }
    }
  }
  for (const held of open.values()) {
    held.offMs = held.onMs + 2000; // still down when the tape ended
    played.push(held);
  }
  return played.sort((a, b) => a.onMs - b.onMs);
}

export function buildCorpus(file) {
  const events = readTape(file);
  const played = notesPlayed(events);
  const items = [];

  for (const snapshot of events.filter(e => e.type === 'snapshot')) {
    const wanted = new Set(snapshot.notes);
    // A note belongs to this voicing if it was down when the snapshot fired.
    const voices = played
      .filter(n => wanted.has(n.note) && n.onMs <= snapshot.t && n.offMs > snapshot.startedAt)
      .map(n => ({ ...n, offMs: n.offMs + RELEASE_TAIL_MS }));

    // Keep one voice per note: the one sounding at the snapshot.
    const byNote = new Map();
    for (const voice of voices) {
      const seen = byNote.get(voice.note);
      if (!seen || voice.onMs > seen.onMs) byNote.set(voice.note, voice);
    }
    const chosen = [...byNote.values()].sort((a, b) => a.note - b.note);
    if (chosen.length !== snapshot.notes.length) continue; // incomplete, skip it

    const firstOn = Math.min(...chosen.map(v => v.onMs));
    items.push({
      id: `g${String(items.length + 1).padStart(2, '0')}`,
      symbol: snapshot.target ? snapshot.target.symbol : null,
      notes: snapshot.notes,
      verdict: snapshot.verdict,
      // times relative to the first note of the voicing
      voices: chosen.map(v => ({
        note: v.note,
        velocity: v.velocity,
        onSec: (v.onMs - firstOn) / 1000,
        offSec: (v.offMs - firstOn) / 1000,
      })),
      // the debounce fired here, so this is when the app judged the chord
      judgedAtSec: (snapshot.t - firstOn) / 1000,
      spreadSec: (Math.max(...chosen.map(v => v.onMs)) - firstOn) / 1000,
      lowest: snapshot.notes[0],
      highest: snapshot.notes[snapshot.notes.length - 1],
      size: snapshot.notes.length,
      hasProblem: Boolean(snapshot.verdict &&
        (snapshot.verdict.missing.length || snapshot.verdict.wrong.length)),
    });
  }
  return items;
}

// The split is fixed here, before anything is measured: 10 items to tune
// thresholds on, 20 for the number that decides the gate. Stratified by size,
// deterministic, and spread across the session rather than taken in a block.
export function splitCorpus(items, { tune = 10, gate = 20 } = {}) {
  // Edi repeated voicings in the drill. A repeat is worth keeping in the corpus
  // (stage 0 runs all of it) but wastes a slot in the 30 he would play again:
  // synthesis is deterministic, so the same note set answers the same twice.
  const seen = new Set();
  const unique = items.filter(item => {
    const key = item.notes.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const bucketOf = item => (item.size <= 3 ? 'small' : item.size <= 4 ? 'four'
    : item.size <= 5 ? 'five' : item.size <= 6 ? 'six' : 'big');
  const buckets = new Map();
  for (const item of unique) {
    const key = bucketOf(item);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  // inside a bucket, walk it evenly instead of taking the first few
  const queues = [...buckets.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([key, list]) => {
      const step = Math.max(1, Math.floor(list.length / Math.ceil((tune + gate) / buckets.size)));
      const picked = [];
      for (let i = 0; i < list.length; i += step) picked.push(list[i]);
      for (const item of list) if (!picked.includes(item)) picked.push(item);
      return { key, picked };
    });

  const order = [];
  for (let round = 0; order.length < unique.length; round++) {
    let added = false;
    for (const queue of queues) {
      if (queue.picked[round]) { order.push(queue.picked[round]); added = true; }
    }
    if (!added) break;
  }
  const marked = new Map();
  order.slice(0, tune).forEach(item => marked.set(item.id, 'tune'));
  order.slice(tune, tune + gate).forEach(item => marked.set(item.id, 'gate'));
  return items.map(item => ({ ...item, set: marked.get(item.id) || 'extra' }));
}
