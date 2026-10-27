// The analyzer's verdict in the player's language, built from its parts.
//
// Each analyzer message has a `code` and `params` beside its English `text` (theory/analyzer.js).
// The sentence is put together here from dictionary keys, never by translating the English
// after the fact — so in English it comes out word for word as the analyzer's own `text`, and
// test/messages.test.js holds it to that.

import { translate } from './i18n.js';

/**
 * @typedef {{ code: string, params: Record<string, any>, level?: string, text?: string }} AnalyzerMessage
 * @typedef {{ type: string | null, detail: string | null, bass: string | null }} Voicing  bass: 'root', '5' or null
 */

/** Intervals that have a name; any other is said in semitones. */
const NAMED_INTERVALS = [1, 2, 3, 4, 5, 6, 7];

/**
 * The name of a voicing type with its triad and its bass, e.g. "Rootless A, root in the bass".
 * Null when the analysis gave it no type.
 * @param {string} locale
 * @param {Voicing} voicing
 * @returns {string | null}
 */
export function describeVoicing(locale, { type, detail, bass }) {
  if (!type) return null;
  let name = translate(locale, `voicing.${type}`);
  if (detail) name = translate(locale, 'voicing.detail', { name, detail });
  if (bass) name = translate(locale, `voicing.bass.${bass}`, { name });
  return name;
}

/**
 * An inversion as `inversionOf` names it ('root position', '1st inversion'…), in the locale.
 * @param {string} locale
 * @param {string | null} inversion
 * @returns {string | null}
 */
export function describeInversion(locale, inversion) {
  if (!inversion) return null;
  const key = { 'root position': 'root', '1st inversion': '1st', '2nd inversion': '2nd', '3rd inversion': '3rd' }[inversion];
  return key ? translate(locale, `inversion.${key}`) : inversion;
}

/**
 * One analyzer message, said in the locale.
 * @param {string} locale
 * @param {AnalyzerMessage} message
 * @returns {string}
 */
export function describeMessage(locale, { code, params }) {
  if (code === 'type') return describeVoicing(locale, params) ?? '';
  if (code === 'bass' && params.played === null) return translate(locale, 'msg.bass.none', params);
  if (code === 'muddy') {
    const interval = NAMED_INTERVALS.includes(params.semitones)
      ? translate(locale, `interval.${params.semitones}`)
      : translate(locale, 'interval.other', { semitones: params.semitones });
    return translate(locale, 'msg.muddy', { ...params, interval });
  }
  return translate(locale, `msg.${code}`, params);
}
