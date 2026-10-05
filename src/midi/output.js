// MIDI out: sends voicings to the instrument on one channel. The message builders are pure.

export function noteOnMessages(notes, channel, velocity) {
  return notes.map(note => [0x90 | (channel - 1), note, velocity]);
}

export function noteOffMessages(notes, channel) {
  return notes.map(note => [0x80 | (channel - 1), note, 0]);
}

// Web MIDI can schedule a message but not unschedule one: `MIDIOutput.clear()` is in the spec and
// not in Chrome (checked 2026-10-05 on Chromium 152 — `MIDIOutput.prototype` carries `send` and
// nothing else). An arrangement handed over whole therefore cannot be stopped: All Notes Off
// silences what sounds at that instant and the browser delivers the rest of the piece anyway, which
// is what Edi heard on the Genos. So it goes over a slice at a time, on the same lookahead as the
// metronome: far enough ahead that the browser, not a JS timer, still decides the exact moment,
// close enough that Stop is not followed by the rest of the piece.
export const LOOKAHEAD_MS = 120;
const TICK_MS = 25;

const isNoteOff = data => (data[0] & 0xf0) === 0x80;
const isNoteOn = data => (data[0] & 0xf0) === 0x90 && data[2] > 0;
const voiceOf = data => `${data[0] & 0x0f}:${data[1]}`;

/**
 * createOutput(midiAccess, { channel }) → { select(id), playVoicing(notes, { velocity, durationMs }),
 * allNotesOff(), sendScheduled(messages), silence(channels), port, channel }.
 * `select` returns the chosen port or null.
 */
export function createOutput(midiAccess, {
  channel = 1,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  now = () => performance.now(),
} = {}) {
  let port = null;
  let queued = [];            // messages not handed to the browser yet, in time order
  let pacing = 0;             // generation, so a new arrangement or a Stop ends the chain in flight
  const sounding = new Set(); // voices whose note-on went over and whose note-off did not

  function select(id) {
    port = midiAccess.outputs.get(id) ?? null;
    return port;
  }

  function playVoicing(notes, { velocity = 90, durationMs = 1500 } = {}) {
    if (!port) return false;
    for (const message of noteOnMessages(notes, channel, velocity)) port.send(message);
    setTimer(() => {
      for (const message of noteOffMessages(notes, channel)) port.send(message);
    }, durationMs);
    return true;
  }

  function allNotesOff() {
    if (port) port.send([0xb0 | (channel - 1), 123, 0]);
  }

  /**
   * Timed messages [{ time, data }], time in performance.now() milliseconds. Only the next
   * LOOKAHEAD_MS go to the browser at a time; the rest wait here, where `silence` can still drop
   * them. Sending a new arrangement replaces whatever was waiting.
   */
  function sendScheduled(messages) {
    if (!port) return false;
    queued = [...messages].sort((a, b) => a.time - b.time);
    sounding.clear();
    const generation = ++pacing;
    const hand = () => {
      if (generation !== pacing || !port) return;
      const until = now() + LOOKAHEAD_MS;
      while (queued.length && queued[0].time <= until) {
        const { time, data } = queued.shift();
        if (isNoteOn(data)) sounding.add(voiceOf(data));
        else if (isNoteOff(data)) sounding.delete(voiceOf(data));
        port.send(data, time);
      }
      if (queued.length) setTimer(hand, TICK_MS);
    };
    hand();
    return true;
  }

  /**
   * Stops an arrangement and silences the channels: nothing waiting goes over, every voice still
   * sounding is released by name, and All Notes Off follows twice — now, and once more after the
   * lookahead window, for the note-ons the browser was already holding when Stop was pressed.
   */
  function silence(channels = [channel]) {
    if (!port) return;
    pacing += 1;
    queued = [];
    port.clear?.();            // a no-op in Chrome today; harmless where it is implemented
    for (const voice of sounding) {
      const [ch, note] = voice.split(':').map(Number);
      port.send([0x80 | ch, note, 0]);
    }
    sounding.clear();
    for (const ch of channels) port.send([0xb0 | (ch - 1), 123, 0]);
    for (const ch of channels) port.send([0xb0 | (ch - 1), 123, 0], now() + LOOKAHEAD_MS + 30);
  }

  return {
    select,
    playVoicing,
    allNotesOff,
    sendScheduled,
    silence,
    get port() { return port; },
    get channel() { return channel; },
    set channel(value) { channel = value; },
  };
}
