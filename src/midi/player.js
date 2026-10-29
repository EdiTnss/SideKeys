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

/**
 * The events of one form, played `times` times in a row, each pass `totalBeats` later; only `part`
 * when one is named. For comping over the app's bass: the form loops, and so does the bass line.
 *
 * @param {{ beat: number, duration: number, part: string, midi: number, velocity: number }[]} events
 * @param {{ totalBeats: number, times: number, part?: string | null }} options
 */
export function repeatEvents(events, { totalBeats, times, part = null }) {
  const kept = part ? events.filter(event => event.part === part) : events;
  const looped = [];
  for (let pass = 0; pass < times; pass++) {
    for (const event of kept) looped.push({ ...event, beat: event.beat + pass * totalBeats });
  }
  return looped;
}

/**
 * How many passes of the form to schedule: enough for `minutes` of playing, or one when the form
 * does not loop. Stop silences whatever is still waiting, so scheduling ahead costs nothing.
 *
 * @param {{ totalBeats: number, tempo: number, minutes?: number, loop?: boolean }} options
 */
export function loopTimes({ totalBeats, tempo, minutes = 20, loop = true }) {
  if (!loop) return 1;
  return Math.ceil((minutes * tempo) / totalBeats);
}
