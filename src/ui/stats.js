// Practice statistics: attempts and problems per chord quality. No DOM, no theory.
// Stats objects are never mutated; recordAttempt returns a new one.

import { spellDegree } from '../theory/notes.js';

const STORAGE_KEY = 'voicing-lab.stats';

export function emptyStats() {
  return { attempts: 0, clean: 0, byKey: {} };
}

const emptyBucket = () => ({ attempts: 0, clean: 0, missing: {}, wrong: 0, avoid: 0 });

/** key: the chord symbol without its root ('7alt', 'ø7'); analysis: from analyzeVoicing. */
export function recordAttempt(stats, { key, chord, analysis }) {
  const bucket = { ...emptyBucket(), ...(stats.byKey[key] ?? {}), missing: { ...(stats.byKey[key]?.missing ?? {}) } };
  const clean = !analysis.messages.some(m => m.level === 'warning');
  bucket.attempts += 1;
  if (clean) bucket.clean += 1;
  for (const pc of analysis.missing) {
    const degree = chord.degrees[pc] ?? spellDegree(chord.root, '1');
    bucket.missing[degree] = (bucket.missing[degree] ?? 0) + 1;
  }
  if (analysis.wrong.length) bucket.wrong += 1;
  if (analysis.avoid.length) bucket.avoid += 1;
  return {
    attempts: stats.attempts + 1,
    clean: stats.clean + (clean ? 1 : 0),
    byKey: { ...stats.byKey, [key]: bucket },
  };
}

/** The most frequent problems: [{ key, problem, count }], most frequent first. */
export function weakSpots(stats, { limit = 3 } = {}) {
  const spots = [];
  for (const [key, bucket] of Object.entries(stats.byKey)) {
    for (const [degree, count] of Object.entries(bucket.missing)) spots.push({ key, problem: `${degree} missing`, count });
    if (bucket.wrong) spots.push({ key, problem: 'wrong notes', count: bucket.wrong });
    if (bucket.avoid) spots.push({ key, problem: 'avoid notes', count: bucket.avoid });
  }
  return spots.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, limit);
}

export function summaryLine(stats) {
  if (stats.attempts === 0) return 'no chords yet';
  const percent = Math.round((100 * stats.clean) / stats.attempts);
  return `${stats.attempts} chord${stats.attempts === 1 ? '' : 's'}, ${stats.clean} clean (${percent}%)`;
}

export function loadStats(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return emptyStats();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !Number.isInteger(data.attempts) || typeof data.byKey !== 'object') return emptyStats();
    return { attempts: data.attempts, clean: Number.isInteger(data.clean) ? data.clean : 0, byKey: data.byKey ?? {} };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats, storage = globalThis.localStorage) {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(stats));
    return true;
  } catch {
    return false;
  }
}
