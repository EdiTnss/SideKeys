// The names of what the engine builds — units, levels, shapes, chord groups, progressions and
// the runs made of them — in the player's language.
//
// The engine keeps its English names, which the Laboratory and the tests read. Here they are
// looked up by id instead, and the names the engine composes (a training run, the daily
// challenge) are composed again from their parts. test/names.test.js holds the English here to
// the engine's own, and fails on anything new that has no name in both languages.

import { translate } from './i18n.js';

/** @typedef {{ id: string, name: string, blurb?: string }} Named */

/** `translate`, or `fallback` when no dictionary has the key. */
function lookup(locale, key, fallback, params = {}) {
  const text = translate(locale, key, params);
  return text === key ? fallback : text;
}

/**
 * @param {string} locale
 * @param {Named} unit
 * @returns {string}
 */
export function unitName(locale, unit) {
  return lookup(locale, `unit.${unit.id}.name`, unit.name);
}

/**
 * @param {string} locale
 * @param {Named} unit
 * @returns {string}
 */
export function unitBlurb(locale, unit) {
  return lookup(locale, `unit.${unit.id}.blurb`, unit.blurb ?? '');
}

/**
 * @param {string} locale
 * @param {{ id: string, label: string }} shape  one of training.js's SHAPES
 * @returns {string}
 */
export function shapeName(locale, shape) {
  return lookup(locale, `shape.${shape.id}`, shape.label);
}

/**
 * @param {string} locale
 * @param {Named} group  one of training.js's QUALITY_GROUPS
 * @returns {string}
 */
export function groupName(locale, group) {
  return lookup(locale, `group.${group.id}`, group.name);
}

/**
 * @param {string} locale
 * @param {string} id  a key of PROGRESSIONS
 * @returns {string}
 */
export function progressionName(locale, id) {
  return lookup(locale, `progression.${id}`, id);
}

/**
 * The name of anything the game screen plays: a level on the path, the review, the daily
 * challenge, or a stretch of training. Whatever is not recognised keeps the name it came with.
 *
 * @param {string} locale
 * @param {{ id?: string, name: string, number?: number, mode?: string, shape?: string | null,
 *           progressionId?: string | null, key?: string | null }} plan
 * @returns {string}
 */
export function levelName(locale, plan) {
  if (plan.mode === 'progression' && plan.progressionId) {
    const name = progressionName(locale, plan.progressionId);
    if (plan.shape) {
      const shape = translate(locale, `shape.${plan.shape}`);
      return translate(locale, 'level.training.progression.shape', { name, key: plan.key ?? '', shape });
    }
    return translate(locale, 'level.training.progression', { name, key: plan.key ?? '' });
  }
  if (plan.mode === 'drill') {
    if (!plan.shape) return translate(locale, 'level.training.drill');
    const shape = translate(locale, `shape.${plan.shape}`);
    return translate(locale, 'level.training.drill.shape', { shape });
  }
  if (typeof plan.number === 'number') return translate(locale, 'level.challenge', { number: plan.number });
  return lookup(locale, `level.${plan.id}`, plan.name);
}
