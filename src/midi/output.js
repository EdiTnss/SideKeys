// MIDI out: sends voicings to the instrument on one channel. The message builders are pure.

export function noteOnMessages(notes, channel, velocity) {
  return notes.map(note => [0x90 | (channel - 1), note, velocity]);
}

export function noteOffMessages(notes, channel) {
  return notes.map(note => [0x80 | (channel - 1), note, 0]);
}

/**
 * createOutput(midiAccess, { channel }) → { select(id), playVoicing(notes, { velocity, durationMs }),
 * allNotesOff(), port, channel }. `select` returns the chosen port or null.
 */
export function createOutput(midiAccess, { channel = 1, setTimer = (fn, ms) => setTimeout(fn, ms) } = {}) {
  let port = null;

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

  /** Timed messages [{ time, data }], time in performance.now() milliseconds; the browser delivers them. */
  function sendScheduled(messages) {
    if (!port) return false;
    for (const { time, data } of messages) port.send(data, time);
    return true;
  }

  /** Drops what is still queued (where the port can) and sends All Notes Off on each channel. */
  function silence(channels = [channel]) {
    if (!port) return;
    port.clear?.();
    for (const ch of channels) port.send([0xb0 | (ch - 1), 123, 0]);
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
