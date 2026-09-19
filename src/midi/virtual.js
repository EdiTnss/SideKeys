// A MIDI access with no hardware behind it, shaped like the one navigator.requestMIDIAccess()
// gives: ports in maps, messages to an input's onmidimessage, send(data, time) on an output.
// The app cannot tell it from the real thing, which is the point: the browser pane (no Web MIDI
// permission) and the harness drive the app through it, and in Phase 4 the on-screen keyboard
// becomes a virtual input and the Web Audio synth a virtual output. Pure, runs in Node.

/**
 * createVirtualMidi({ inputs, outputs, now }) → { access, send(data, { input, timeStamp }), sent, clearSent() }
 * `sent` holds every message the app sent to an output: { port, data, time }.
 */
export function createVirtualMidi({
  inputs = ['Virtual input'],
  outputs = ['Virtual output'],
  now = () => globalThis.performance?.now() ?? Date.now(),
} = {}) {
  const sent = [];
  const port = (type, name, i) => ({ id: `virtual-${type}-${i + 1}`, name, manufacturer: 'Voicing Lab', type, state: 'connected', connection: 'open' });

  const inputPorts = inputs.map((name, i) => ({ ...port('input', name, i), onmidimessage: null }));
  const outputPorts = outputs.map((name, i) => {
    const output = port('output', name, i);
    output.send = (data, time) => { sent.push({ port: output.id, data: [...data], time: time ?? now() }); };
    // Like the real clear(): what is still queued for later never leaves.
    output.clear = () => {
      const at = now();
      for (let k = sent.length - 1; k >= 0; k--) {
        if (sent[k].port === output.id && sent[k].time > at) sent.splice(k, 1);
      }
    };
    return output;
  });

  const access = {
    inputs: new Map(inputPorts.map(input => [input.id, input])),
    outputs: new Map(outputPorts.map(output => [output.id, output])),
    onstatechange: null,
    sysexEnabled: false,
  };

  /** Delivers a message on an input, as a keyboard would. */
  function send(data, { input = inputPorts[0]?.id, timeStamp = now() } = {}) {
    const target = access.inputs.get(input);
    if (!target) throw new Error(`There is no virtual input "${input}".`);
    target.onmidimessage?.({ data: Uint8Array.from(data), timeStamp, target });
  }

  return { access, send, sent, clearSent: () => { sent.length = 0; } };
}
