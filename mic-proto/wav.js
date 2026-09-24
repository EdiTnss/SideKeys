// 16-bit PCM mono WAV, written and read by hand. The prototype records at the
// model's own rate (22050), so nothing here ever resamples.
export function writeWav(samples, sampleRate) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + samples.length * 2, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);            // PCM header size
  bytes.writeUInt16LE(1, 20);             // format: PCM
  bytes.writeUInt16LE(1, 22);             // channels
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28); // byte rate
  bytes.writeUInt16LE(2, 32);             // block align
  bytes.writeUInt16LE(16, 34);            // bits per sample
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    bytes.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return bytes;
}

export function readWav(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let format = null;
  let channels = 1;
  let sampleRate = 0;
  let bits = 16;
  let data = null;
  let at = 12;
  while (at + 8 <= bytes.length) {
    const id = bytes.toString('ascii', at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    const body = at + 8;
    if (id === 'fmt ') {
      format = bytes.readUInt16LE(body);
      channels = bytes.readUInt16LE(body + 2);
      sampleRate = bytes.readUInt32LE(body + 4);
      bits = bytes.readUInt16LE(body + 14);
    } else if (id === 'data') {
      data = bytes.subarray(body, body + size);
    }
    at = body + size + (size % 2); // chunks are word-aligned
  }
  if (!format || !data) throw new Error('missing fmt or data chunk');
  const frames = data.length / (channels * (bits / 8));
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const at = (i * channels + c) * (bits / 8);
      if (format === 3 && bits === 32) sum += data.readFloatLE(at);
      else if (bits === 16) sum += data.readInt16LE(at) / 32768;
      else if (bits === 32) sum += data.readInt32LE(at) / 2147483648;
      else if (bits === 8) sum += (data[at] - 128) / 128;
      else throw new Error(`unsupported sample format: ${format} / ${bits} bit`);
    }
    out[i] = sum / channels; // the model wants mono
  }
  return { sampleRate, channels, bits, samples: out };
}
