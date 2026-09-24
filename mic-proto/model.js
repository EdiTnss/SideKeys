// Loads the basic-pitch graph model from the files inside the npm package.
//
// The browser build of TensorFlow.js fetches models over HTTP and has no file://
// handler -- that one lives in @tensorflow/tfjs-node, which needs a native build.
// A graph model only needs an object with load(), so we read the two files
// ourselves and hand them over. No native code, no extra dependency.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import * as tf from '@tensorflow/tfjs';
import { BasicPitch } from '@spotify/basic-pitch';

const require = createRequire(import.meta.url);

export function modelDir() {
  const pkg = require.resolve('@spotify/basic-pitch/package.json');
  return path.join(path.dirname(pkg), 'model');
}

async function fileHandler(dir) {
  const json = JSON.parse(await readFile(path.join(dir, 'model.json'), 'utf8'));
  const specs = [];
  const buffers = [];
  for (const group of json.weightsManifest) {
    specs.push(...group.weights);
    for (const file of group.paths) {
      buffers.push(await readFile(path.join(dir, file)));
    }
  }
  const all = Buffer.concat(buffers);
  return {
    load: async () => ({
      modelTopology: json.modelTopology,
      weightSpecs: specs,
      weightData: all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength),
      format: json.format,
      generatedBy: json.generatedBy,
      convertedBy: json.convertedBy,
      signature: json.signature,
      userDefinedMetadata: json.userDefinedMetadata,
      modelInitializer: json.modelInitializer,
    }),
  };
}

export async function loadBasicPitch(dir = modelDir()) {
  await tf.ready();
  const handler = await fileHandler(dir);
  return new BasicPitch(tf.loadGraphModel(handler));
}
