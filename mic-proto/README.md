# mic-proto — can a microphone replace the MIDI cable?

A measuring instrument, not a feature. SideKeys reads voicings from a MIDI
keyboard; this asks whether [basic-pitch](https://github.com/spotify/basic-pitch-ts)
could read them from a microphone instead, well enough for an app whose whole job
is telling a pianist which note was wrong.

The bar was set before any code was written, in [docs/PRODUCT.md](../docs/PRODUCT.md):
**over 90% of 20 voicings identified correctly, with the exact octave.**

**Answer: no. 45% on the 20, with a ceiling of 72% on 93.** The numbers and the
reasoning are in [docs/spec-mic.md](../docs/spec-mic.md) (Romanian, like the rest
of `docs/`). Nothing here ships: `src/` does not import from this folder, and the
app still has zero npm dependencies.

## Why it lives outside src/

`@spotify/basic-pitch` brings TensorFlow.js with it. The app's rule is zero npm
dependencies, so this folder keeps its own `package.json`, exactly like `worker/`.

## Running it

```
npm install          # once, in this folder
node build-corpus.mjs
node measure.js --set gate --chain laptop
```

- `--set tune|gate|extra|all` — which voicings (the split is fixed in `corpus.json`)
- `--chain direct|laptop|harsh` — how much acoustic path to simulate
- `--thresholds 0.5,0.4` / `--floors 0.12` — reader parameters, swept in one pass
- `--wav` — also write the audio it measured, to `clips/`

## The pieces

| file | what it does |
|---|---|
| `corpus.js`, `build-corpus.mjs` | rebuild the corpus from a recorded session in `harness/sessions/`: real note times, real velocities, the chord symbol and the verdict the app gave |
| `synth.js` | a piano-ish tone written from scratch, so measuring needs no recording and no sample library |
| `degrade.js` | room, laptop-microphone bass rolloff and noise floor, as fixed filters |
| `model.js` | loads the graph model from the npm package's own files, without `tfjs-node` |
| `read.js` | four ways to turn model output into a set of notes, plus the oracle that says whether any threshold could have worked |
| `metrics.js` | exact set match (the gate), and whether the app's verdict would have changed |
| `measure.js` | the runner and the report |
| `inspect.mjs` | the activation profile of one voicing, for designing a reading rule on evidence |
| `smoke.mjs` | one chord end to end: does the model load and answer at all |

`report-*.json` are kept as evidence, the same way `eval/reports/` are.
