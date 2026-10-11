// What the player has to show for it: the best stars on each level, the XP, and how many times
// a level has paid out today. No DOM beyond localStorage, and never mutated in place.
//
// It lives here rather than in the shell because `node --test` has to reach it, and because the
// same arithmetic would have to run on a server the day a leaderboard needs checking.

import { storageKey } from '../storage.js';
import { parseChord } from '../theory/chords.js';
import { isClean } from '../theory/stars.js';
import { pathState } from './path.js';

/** Three clean answers in a row retire a weak spot; one miss puts the count back to zero. */
export const REVIEW_HITS = 3;

export function emptyProgress() {
  return { stars: {}, xp: 0, plays: {}, days: {}, review: {}, challenge: null };
}

/**
 * A finished run. Stars are kept at their best — a worse pass never takes a star away — XP adds
 * up, and the level's count for the day goes up by one, which is what caps the XP on repeats.
 *
 * `seconds` feeds the day's minutes, and `missed` / `cleared` are chord qualities, which is
 * what the review queue is keyed by: a weak spot is "m7b5", not "Abm7b5 that one time".
 *
 * @param {any} progress
 * @param {{ levelId: string, stars: number, xp: number, today: string,
 *           seconds?: number, missed?: string[], cleared?: string[] }} run
 */
export function recordRun(progress, { levelId, stars, xp, today, seconds = 0, missed = [], cleared = [] }) {
  const played = progress.plays[levelId];
  const count = played?.date === today ? played.count + 1 : 1;
  const review = { ...(progress.review ?? {}) };

  for (const quality of missed) {
    const entry = review[quality];
    // Back tomorrow, not today: sleeping on it is the point of spacing it out.
    review[quality] = { misses: (entry?.misses ?? 0) + 1, hits: 0, dueOn: nextDay(today) };
  }
  for (const quality of cleared) {
    const entry = review[quality];
    if (!entry) continue;                       // nothing to review: a clean answer is just clean
    const hits = entry.hits + 1;
    if (hits >= REVIEW_HITS) delete review[quality];
    else review[quality] = { ...entry, hits, dueOn: nextDay(today) };
  }

  return {
    // Spread first: this used to list the fields it kept, which silently dropped the daily
    // challenge the day that field was added.
    ...progress,
    stars: { ...progress.stars, [levelId]: Math.max(progress.stars[levelId] ?? 0, stars) },
    xp: progress.xp + xp,
    plays: { ...progress.plays, [levelId]: { date: today, count } },
    days: { ...(progress.days ?? {}), [today]: (progress.days?.[today] ?? 0) + Math.max(0, Math.round(seconds)) },
    review,
  };
}

/**
 * The day's challenge, filed once. Only the first pass of the day is the official one: the
 * grid someone pastes is the one they played cold, and a second run is practice (Edi,
 * 2026-10-11). Only the latest day is kept — a history of grids is not something anything
 * asks for yet, and the day it does it belongs in an account, not in this browser.
 *
 * @param {any} progress
 * @param {{ date: string, number: number, states: string[], stars: number, xp: number }} result
 */
export function recordChallenge(progress, result) {
  if (progress.challenge?.date === result.date) return progress;
  return { ...progress, challenge: { ...result } };
}

/** The official result for a day, or null when that day has not been played. */
export function challengeResult(progress, date) {
  const record = progress.challenge;
  return record && record.date === date ? record : null;
}

/** The day after a 'YYYY-MM-DD' stamp, in local time. */
function nextDay(date) {
  const [year, month, day] = date.split('-').map(Number);
  return dayStamp(new Date(year, month - 1, day + 1));
}

/**
 * Days played in a row, counting back from today. A day with nothing in it yet does not break
 * the streak — the day is not over — so a streak that ran to yesterday still stands.
 */
export function streak(progress, today) {
  const days = progress.days ?? {};
  let from = days[today] ? today : previousDay(today);
  if (!days[from]) return 0;
  let count = 0;
  while (days[from]) {
    count += 1;
    from = previousDay(from);
  }
  return count;
}

function previousDay(date) {
  const [year, month, day] = date.split('-').map(Number);
  return dayStamp(new Date(year, month - 1, day - 1));
}

/** Seconds played on a given day, for the minutes goal. */
export function secondsOn(progress, date) {
  return progress.days?.[date] ?? 0;
}

/**
 * Which chord qualities a run got clean and which it did not. A quality missed even once counts
 * as missed, however often it came back clean in the same run: the weak spot is what matters.
 */
export function outcomesFor(attempts) {
  const missed = new Set();
  const cleared = new Set();
  for (const attempt of attempts) {
    if (!attempt.analysis) continue;
    const chord = parseChord(attempt.symbol);
    const quality = attempt.symbol.slice(chord.root.length).split('/')[0];
    (isClean(attempt.analysis) ? cleared : missed).add(quality);
  }
  for (const quality of missed) cleared.delete(quality);
  return { missed: [...missed], cleared: [...cleared] };
}

/** The weak spots due for review, worst first. */
export function dueReviews(progress, today) {
  return Object.entries(progress.review ?? {})
    .filter(([, entry]) => entry.dueOn <= today)
    .map(([quality, entry]) => ({ quality, ...entry }))
    .sort((a, b) => b.misses - a.misses || a.quality.localeCompare(b.quality));
}

/** Where "continue the path" goes: the first open level that is not yet three stars. */
export function nextLevel(stars) {
  for (const entry of pathState(stars)) {
    if (!entry.unlocked) continue;
    for (const item of entry.levels) {
      if (item.unlocked && item.stars < 3) return { unit: entry.unit, level: item.level, stars: item.stars };
    }
  }
  return null;
}

/** How many times this level has already paid out today — what xpFor needs to cap a repeat. */
export function playsToday(progress, levelId, today) {
  const played = progress.plays[levelId];
  return played?.date === today ? played.count : 0;
}

/** Today, as the key the counts are filed under. Local time: the player's day, not UTC's. */
export function dayStamp(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function loadProgress(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(storageKey('progress'));
    if (!raw) return emptyProgress();
    const data = JSON.parse(raw);
    // Anything that is not the shape we wrote starts over: progress is a convenience, and a
    // broken file must never stop someone from playing.
    if (!data || typeof data !== 'object') return emptyProgress();
    if (typeof data.stars !== 'object' || data.stars === null || Array.isArray(data.stars)) return emptyProgress();
    if (typeof data.xp !== 'number' || !Number.isFinite(data.xp)) return emptyProgress();
    return {
      stars: data.stars,
      xp: data.xp,
      plays: (typeof data.plays === 'object' && data.plays) || {},
      // Added after the first saves went out, so an older file simply starts these empty.
      days: (typeof data.days === 'object' && data.days) || {},
      review: (typeof data.review === 'object' && data.review) || {},
      challenge: (typeof data.challenge === 'object' && data.challenge) || null,
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress, storage = globalThis.localStorage) {
  try {
    storage?.setItem(storageKey('progress'), JSON.stringify(progress));
  } catch {
    // A full or blocked storage is not worth interrupting a session for.
  }
}
