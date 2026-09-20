// Drill state: what to practise, which chord comes next, settings persistence. No DOM, no theory.

import { DEFAULT_CHANNELS } from '../midi/player.js';
import { BASS_REGISTERS } from '../theory/realize.js';
import { storageKey } from '../storage.js';

// Half-diminished is shown as ø7, diminished as a bare ° (the symbol already implies the
// diminished seventh). The parser accepts every alias.
export const DRILL_SYMBOLS = ['maj7', '6', '6/9', 'm7', 'm6', 'mMaj7', '7', '7b9', '7#11', '7alt', '7sus4', 'ø7', '°'];
const LEGACY_SYMBOLS = { m7b5: 'ø7', 'ø': 'ø7', dim7: '°', '°7': '°' };
export const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const DEFAULT_SETTINGS = Object.freeze({
  qualities: ['maj7', 'm7', '7'],
  roots: [...ROOTS],
  debounceMs: 300,
  nextNote: 28,          // E1, the lowest key on a 76-key Genos; null = keyboard/button only
  outputId: null,        // MIDI output port id; null = the first one available
  channel: 1,            // MIDI channel for suggestions
  proxyUrl: '',          // the AI proxy (Cloudflare Worker) URL; '' = Ask Claude is off
  channels: DEFAULT_CHANNELS,                                   // arrangement playback, one channel per part
  parts: Object.freeze({ melody: true, lh: true, bass: true }), // which parts the arrangement plays
  bassRegister: 'low',   // a key of BASS_REGISTERS: low E1–D#2, middle A1–G#2, high E2–D#3
  planReview: true,      // Reharm: plan and review around execute (off = execute alone, as in Phase 3a)
});


const PARTS = ['melody', 'lh', 'bass'];

// A fresh copy every time, so a loaded settings object can be edited without touching the defaults.
const defaults = () => ({
  ...DEFAULT_SETTINGS,
  qualities: [...DEFAULT_SETTINGS.qualities],
  roots: [...DEFAULT_SETTINGS.roots],
  channels: { ...DEFAULT_SETTINGS.channels },
  parts: { ...DEFAULT_SETTINGS.parts },
});

/** A random symbol from the selected roots × qualities, never the previous one unless it is the only option. */
export function nextChord(settings, previous = null, random = Math.random) {
  const pool = [];
  for (const root of settings.roots) {
    for (const quality of settings.qualities) pool.push(root + quality);
  }
  if (pool.length === 0) return null;
  const candidates = pool.length > 1 ? pool.filter(symbol => symbol !== previous) : pool;
  return candidates[Math.floor(random() * candidates.length)];
}

/** Settings from storage, cleaned; defaults when storage is missing, empty or broken. */
export function loadSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(storageKey('settings', storage));
    if (!raw) return defaults();
    return sanitize(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

/** True when saved. False (never an exception) when storage is unavailable or full. */
export function saveSettings(settings, storage = globalThis.localStorage) {
  try {
    if (!storage) return false;
    storage.setItem(storageKey('settings', storage), JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

function sanitize(saved) {
  const listOf = (value, allowed) => (Array.isArray(value) ? value.filter(item => allowed.includes(item)) : []);
  const migrated = Array.isArray(saved.qualities) ? [...new Set(saved.qualities.map(q => LEGACY_SYMBOLS[q] ?? q))] : [];
  const qualities = listOf(migrated, DRILL_SYMBOLS);
  const roots = listOf(saved.roots, ROOTS);
  const debounceMs = Number.isFinite(saved.debounceMs) ? Math.min(2000, Math.max(50, saved.debounceMs)) : DEFAULT_SETTINGS.debounceMs;
  const nextNote = saved.nextNote === null ? null
    : Number.isInteger(saved.nextNote) && saved.nextNote >= 0 && saved.nextNote <= 127 ? saved.nextNote
      : DEFAULT_SETTINGS.nextNote;
  const channel = Number.isInteger(saved.channel) && saved.channel >= 1 && saved.channel <= 16 ? saved.channel : DEFAULT_SETTINGS.channel;
  const proxyUrl = typeof saved.proxyUrl === 'string' && /^https?:\/\//.test(saved.proxyUrl.trim()) ? saved.proxyUrl.trim() : '';
  const isChannel = value => Number.isInteger(value) && value >= 1 && value <= 16;
  const channels = Object.fromEntries(PARTS.map(part =>
    [part, isChannel(saved.channels?.[part]) ? saved.channels[part] : DEFAULT_SETTINGS.channels[part]]));
  const parts = Object.fromEntries(PARTS.map(part =>
    [part, typeof saved.parts?.[part] === 'boolean' ? saved.parts[part] : DEFAULT_SETTINGS.parts[part]]));
  return {
    qualities: qualities.length ? qualities : [...DEFAULT_SETTINGS.qualities],
    roots: roots.length ? roots : [...DEFAULT_SETTINGS.roots],
    debounceMs,
    nextNote,
    outputId: typeof saved.outputId === 'string' && saved.outputId ? saved.outputId : null,
    channel,
    proxyUrl,
    channels,
    parts,
    bassRegister: Object.hasOwn(BASS_REGISTERS, saved.bassRegister) ? saved.bassRegister : DEFAULT_SETTINGS.bassRegister,
    planReview: typeof saved.planReview === 'boolean' ? saved.planReview : DEFAULT_SETTINGS.planReview,
  };
}
