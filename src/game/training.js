// Training: free practice, outside the path. What can be chosen, which of those choices can be
// played, and the run the screen is handed. No DOM beyond localStorage.
//
// A drill here is what a level is — chords asked for one at a time, in a shape or in none —
// without an end, without stars and without anything to open (Edi, 2026-10-12). It is built
// from the same parts on purpose: `chartSymbol` spells the chords, and the oracle that keeps an
// unplayable level off the path, the engine's own voicing generator, keeps an unplayable chord
// out of the drill. A progression is the library's, with its bars as written.

import { parseChord, chartSymbol } from '../theory/chords.js';
import { suggestVoicings } from '../theory/voicings.js';
import { getProgression, PROGRESSIONS } from '../theory/progressions.js';
import { storageKey } from '../storage.js';
import { TWELVE } from './path.js';

/** The twelve keys, in the order the path walks them: round the cycle of fourths. */
export const KEYS = TWELVE;

/** What a drill can ask for, grouped the way the screen lays them out. '' is the major triad. */
export const QUALITY_GROUPS = Object.freeze([
  { name: 'Triads', qualities: ['', 'm', 'sus4'] },
  { name: 'Sevenths', qualities: ['maj7', 'm7', '7', 'm7b5', 'dim7', 'm6', '6', '6/9', 'mMaj7', '7sus4'] },
  { name: 'Altered dominants', qualities: ['7b9', '7#11', '7alt'] },
]);
const QUALITIES = QUALITY_GROUPS.flatMap(group => group.qualities);

/** The shape a drill can demand. `texture` is what the stars compare the voicing against. */
export const SHAPES = Object.freeze([
  { id: 'any', label: 'Any voicing', texture: null },
  { id: 'shell', label: 'Shell', texture: 'shell' },
  { id: 'rootless-A', label: 'Rootless A', texture: 'rootless-A' },
  { id: 'rootless-B', label: 'Rootless B', texture: 'rootless-B' },
  { id: 'rootless', label: 'Rootless, A or B', texture: ['rootless-A', 'rootless-B'] },
  { id: 'drop-2', label: 'Drop 2', texture: 'drop-2' },
  { id: 'quartal', label: 'Quartal', texture: 'quartal' },
]);

export const TEMPO_RANGE = Object.freeze({ min: 40, max: 240 });

/**
 * How many bars a drill is drawn for before it comes round again. It has to end somewhere,
 * because the clock answers "which chord is this bar's" from a list; at one chord a bar this is
 * seventeen minutes at 120, and nobody recognises the five-hundred-and-thirteenth chord.
 */
export const DRILL_BARS = 512;

/**
 * What the Training screen lets someone choose, and what it remembers between visits.
 *
 * @typedef {{
 *   mode: 'drill' | 'progression',
 *   qualities: readonly string[],
 *   keys: readonly string[],
 *   shape: string,
 *   progression: string,
 *   key: string,
 *   tempo: number,
 * }} TrainingSettings
 */

/** @type {Readonly<TrainingSettings>} */
export const DEFAULT_TRAINING = Object.freeze({
  mode: 'drill',
  qualities: Object.freeze(['maj7', 'm7', '7']),
  keys: Object.freeze([...KEYS]),
  shape: 'any',
  progression: 'ii-V-I',
  key: 'C',
  tempo: 120,
});

const textureOf = shape => SHAPES.find(entry => entry.id === shape)?.texture ?? null;

// The generator is asked once per chord and shape: the screen asks again on every change of a
// choice, and the answer cannot change.
const playable = new Map();
function canPlay(symbol, texture) {
  if (!texture) return true;
  const wanted = [].concat(texture);
  const key = `${symbol}|${wanted.join()}`;
  if (!playable.has(key)) {
    playable.set(key, suggestVoicings(parseChord(symbol)).some(candidate => wanted.includes(candidate.type)));
  }
  return playable.get(key);
}

/**
 * Every chord a drill with these choices can ask for: each quality in each key, spelled as a
 * chart spells it, less the ones the engine has no voicing for in the shape demanded. An empty
 * pool is a real answer — a quartal dominant does not exist here — and the screen says so.
 *
 * @param {{ qualities: readonly string[], keys: readonly string[], shape: string }} choices
 * @returns {Array<{ symbol: string, texture: string | string[] | null }>}
 */
export function drillPool({ qualities, keys, shape }) {
  const texture = textureOf(shape);
  return keys
    .flatMap(key => qualities.map(quality => chartSymbol(key, quality)))
    .filter(symbol => canPlay(symbol, texture))
    .map(symbol => ({ symbol, texture }));
}

/**
 * The qualities a shape exists for in at least one key, in the order they are offered, so the
 * screen can grey out the rest instead of letting someone pick a drill with nothing in it.
 *
 * @param {string} shape
 * @returns {string[]}
 */
export function shapeQualities(shape) {
  const texture = textureOf(shape);
  return QUALITIES.filter(quality => KEYS.some(key => canPlay(chartSymbol(key, quality), texture)));
}

/**
 * `count` chords drawn from the pool, never the same one twice running. The run loops, so the
 * last one also avoids the first. A pool of one has nothing else to offer and repeats.
 *
 * @template T
 * @param {Array<T & { symbol: string }>} pool
 * @param {number} count
 * @param {() => number} [random]
 * @returns {Array<T & { symbol: string }>}
 */
export function drawDrill(pool, count, random = Math.random) {
  if (!pool.length) return [];
  const drawn = [];
  for (let at = 0; at < count; at += 1) {
    const before = drawn[at - 1]?.symbol;
    const after = at === count - 1 ? drawn[0]?.symbol : undefined;
    let candidates = pool.filter(ask => ask.symbol !== before && ask.symbol !== after);
    if (!candidates.length) candidates = pool.filter(ask => ask.symbol !== before);
    if (!candidates.length) candidates = pool;
    drawn.push(candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]);
  }
  return drawn;
}

// The two keys that have a sharp name worth using. In Gb a major ii–V–I is Abm7 Db7 Gbmaj7 and
// reads as it should; the minor one ends on Gbm6, and the jazz blues passes through Dbm7 —
// chords nobody writes (see `chartSymbol`). Those are written in F#, and likewise C# for Db.
const SHARP_KEYS = { Db: 'C#', Gb: 'F#' };

const awkward = progression => progression.bars
  .flatMap(bar => bar.chords)
  .filter(({ symbol }) => {
    const { root } = parseChord(symbol);
    return chartSymbol(root, symbol.slice(root.length)) !== symbol;
  }).length;

/**
 * A library progression in a key, with its bars and its chords per bar as written, spelled from
 * the sharp name of the key when the flat one would write Dbm or Gbm.
 *
 * @param {string} id A key of PROGRESSIONS.
 * @param {string} key
 * @returns {ReturnType<typeof getProgression>}
 */
export function progressionFor(id, key) {
  const flat = getProgression(id, key);
  const sharpKey = SHARP_KEYS[key];
  if (!sharpKey || !awkward(flat)) return flat;
  const sharp = getProgression(id, sharpKey);
  return awkward(sharp) < awkward(flat) ? sharp : flat;
}

const clampTempo = tempo => (Number.isFinite(tempo)
  ? Math.min(TEMPO_RANGE.max, Math.max(TEMPO_RANGE.min, Math.round(tempo)))
  : DEFAULT_TRAINING.tempo);

/**
 * The run the game screen is handed, or null when the choices leave nothing to play. Both kinds
 * come out in one form — a progression of bars that loops — so the screen and the clock need
 * know nothing about which it is: a drill is one drawn chord to the bar, a progression is the
 * library's own bars, two chords to the bar where it has them.
 *
 * @param {TrainingSettings} settings
 * @param {{ random?: () => number }} [options]
 * @returns {{ name: string, tempo: number, endless: true, mode: 'drill' | 'progression',
 *             texture: string | string[] | null,
 *             progression: { timeSignature: number[], bars: Array<{ chords: Array<{ symbol: string, beat: number }> }> } } | null}
 */
export function trainingPlan(settings, { random = Math.random } = {}) {
  const tempo = clampTempo(settings.tempo);
  if (settings.mode === 'progression') {
    const progression = progressionFor(settings.progression, settings.key);
    return {
      name: `${progression.name} in ${progression.key}`,
      tempo,
      endless: true,
      mode: 'progression',
      // The shape is the drill's: a blues has dominants, and a quartal blues is no blues here.
      texture: null,
      progression: { timeSignature: progression.timeSignature, bars: progression.bars },
    };
  }
  const pool = drillPool(settings);
  if (!pool.length) return null;
  const shape = SHAPES.find(entry => entry.id === settings.shape);
  return {
    name: shape?.texture ? `Drill · ${shape.label}` : 'Drill',
    tempo,
    endless: true,
    mode: 'drill',
    texture: shape?.texture ?? null,
    progression: {
      timeSignature: [4, 4],
      bars: drawDrill(pool, DRILL_BARS, random).map(ask => ({ chords: [{ symbol: ask.symbol, beat: 1 }] })),
    },
  };
}

/**
 * Saved choices, kept where they make sense and replaced where they do not. An empty list is
 * kept: it is a choice somebody made halfway through changing their mind, not a broken file.
 *
 * @param {unknown} saved
 * @returns {TrainingSettings}
 */
export function sanitizeTraining(saved) {
  const from = /** @type {Record<string, any>} */ (saved && typeof saved === 'object' ? saved : {});
  // In the order they are offered, so toggling a chip never reshuffles the row.
  const listOf = (value, allowed, fallback) => (Array.isArray(value) ? allowed.filter(item => value.includes(item)) : [...fallback]);
  return {
    mode: from.mode === 'progression' ? 'progression' : 'drill',
    qualities: listOf(from.qualities, QUALITIES, DEFAULT_TRAINING.qualities),
    keys: listOf(from.keys, KEYS, DEFAULT_TRAINING.keys),
    shape: SHAPES.some(entry => entry.id === from.shape) ? from.shape : DEFAULT_TRAINING.shape,
    progression: Object.hasOwn(PROGRESSIONS, from.progression ?? '') ? from.progression : DEFAULT_TRAINING.progression,
    key: KEYS.includes(from.key) ? from.key : DEFAULT_TRAINING.key,
    tempo: clampTempo(from.tempo),
  };
}

/** The choices from last time, or the defaults when there are none or they cannot be read. */
export function loadTraining(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(storageKey('training'));
    return sanitizeTraining(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeTraining(null);
  }
}

/** Remembers the choices. A full or blocked storage is not worth interrupting anyone for. */
export function saveTraining(settings, storage = globalThis.localStorage) {
  try {
    storage?.setItem(storageKey('training'), JSON.stringify(settings));
  } catch {
    // Nothing to do: the choices simply start from the defaults next time.
  }
}
