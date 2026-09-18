// Arrangement events (from theory/realize.js) → timed MIDI messages. Pure: the output port
// sends them with Web MIDI timestamps, which the browser delivers on time on its own, so the
// playback does not depend on JavaScript timers.
//
// Each part has its own channel (Edi's choice), so on the Genos each one can get its voice:
// piano for the melody and the left hand, bass for the bass.

export const DEFAULT_CHANNELS = Object.freeze({ melody: 1, lh: 2, bass: 3 });
const ALL_PARTS = Object.freeze({ bass: true, lh: true, melody: true });

/**
 * arrangementMessages(events, { tempo, startMs, channels, parts }) → [{ time, data }]
 * `startMs` is when beat 0 sounds, in performance.now() milliseconds. Sorted by time; at the
 * same moment note-offs come first, so a repeated note is struck again instead of cut short.
 */
export function arrangementMessages(events, { tempo, startMs, channels = DEFAULT_CHANNELS, parts = ALL_PARTS }) {
  const msPerBeat = 60000 / tempo;
  const timed = [];
  events.forEach((event, index) => {
    if (parts[event.part] === false) return;
    const status = channels[event.part] - 1;
    const on = startMs + event.beat * msPerBeat;
    const off = startMs + (event.beat + event.duration) * msPerBeat;
    timed.push({ time: on, kind: 1, index, data: [0x90 | status, event.midi, event.velocity] });
    timed.push({ time: off, kind: 0, index, data: [0x80 | status, event.midi, 0] });
  });
  timed.sort((a, b) => a.time - b.time || a.kind - b.kind || a.index - b.index);
  return timed.map(({ time, data }) => ({ time, data }));
}
