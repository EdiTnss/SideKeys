// The comping report: what a few choruses of accompaniment said about the hands, in the order
// and with the thresholds of docs/spec-comping.md. Pure, no DOM, no MIDI: it takes attacks
// already split from a tape (src/ui/attacks.js) and the form they were played over.
//
// The rule behind every threshold: precision beats coverage. The Definition of Done counts true
// things and allows no false one, so a finding is said only when the data clearly carries it,
// and a lone slip is never a habit.

import { parseChord } from './chords.js';
import { analyzeVoicing } from './analyzer.js';
import { compareVoicings } from './voiceLeading.js';
import { parseGrid } from './progressions.js';
import { midiToName, nameToMidi } from './notes.js';
import { isClean } from './stars.js';

// Proposals, to be calibrated on Edi's sessions (the method is in the spec). Data, like
// LOW_INTERVAL_LIMITS, so a calibration moves numbers and not code.
export const COMPING_LIMITS = {
  habitMin: 3,                 // a habit is seen at least this often…
  habitShare: 0.5,             // …and on this share of the chords of its quality
  minAttacks: 8,               // no share-based finding on fewer attacks
  minChanges: 8,               // nor on fewer chord changes
  minBars: 8,                  // nor a rhythm pattern on fewer bars
  cleanShare: 0.9,
  topNote: nameToMidi('G5'),   // Edi, 2026-10-29: the top note up to G5, inclusive
  muddyShare: 0.1,             // any murky pair, when no single pair is a habit
  centerLow: nameToMidi('F3'), // the middle of a voicing between F3 and G4, around C4 (Edi)
  centerHigh: nameToMidi('G4'),
  centerOutShare: 0.25,
  centerDrift: 4,              // semitones between the first chorus and the last
  registerOkChoruses: 4,
  jumpySpotShare: 0.75,        // the same change jumping in 3 of 4 choruses
  jumpyShare: 0.3,
  smoothShare: 0.8,
  oneTypeShare: 0.8,
  mixedTypes: 3,
  mixedTypeShare: 0.1,
  oneDensityShare: 0.9,
  densityGroupShare: 0.2,
  staticTopRange: 2,
  staticTopChoruses: 2,
  minTops: 4,                  // a chorus needs this many chords to say anything about its top line
  topStepShare: 0.6,
  topLineRange: 5,
  samePatternShare: 0.6,
  downbeatShare: 0.9,
  busyPerBar: 5,
  pushShare: 0.1,
  timingMin: 20,
  timingMean: 25,              // ms ahead (rushing) or behind (dragging), on average
  timingSpread: 45,            // ms, standard deviation
};

const EPSILON = 1e-6;
const SWUNG = 2 / 3;

/**
 * Snaps an attack to the nearest eighth: the triplet "and" when the session swings, the half when
 * it is straight. offsetMs is how far the hand was from it (positive: late).
 *
 * @param {{ bar: number, beat: number }} position
 * @param {{ timeSignature?: number[], tempo: number, swing?: boolean }} clock
 * @returns {{ bar: number, beat: number, offsetMs: number, onBeat: boolean }}
 */
export function placeAttack({ bar, beat }, { timeSignature = [4, 4], tempo, swing = true }) {
  const beatsPerBar = timeSignature[0];
  const whole = Math.floor(beat + EPSILON);
  const fraction = beat - whole;
  const and = swing ? SWUNG : 0.5;
  const snap = [0, and, 1].reduce((best, c) => (Math.abs(fraction - c) < Math.abs(fraction - best) ? c : best));
  const offsetMs = (fraction - snap) * (60000 / tempo);
  let placedBar = bar;
  let placedBeat = whole + snap;
  if (placedBeat >= beatsPerBar + 1 - EPSILON) {
    placedBar += 1;
    placedBeat = 1;
  }
  return { bar: placedBar, beat: placedBeat, offsetMs, onBeat: snap !== and };
}

/**
 * The report on a run of comping. Attacks carry their notes and their raw position; `form` is
 * the grid and the clock they were played on. Findings come in the spec's order (the chords,
 * register, voice leading, variety), each with the bars where it happened, so it can be heard.
 *
 * @param {{ notes: number[], bar: number, beat: number, move?: boolean }[]} attacks
 * @param {{ grid: string, timeSignature?: number[], tempo: number, swing?: boolean }} form
 * @param {{ limits?: typeof COMPING_LIMITS }} [options]
 * @returns {{ choruses: number, bars: number, attacks: number, findings: Finding[],
 *             judged: Judged[], changes: Change[], perChorus: { chorus: number, attacks: number, center: number | null, topRange: number | null }[] }}
 */
export function compingReport(attacks, form, { limits = COMPING_LIMITS } = {}) {
  const timeSignature = form.timeSignature ?? [4, 4];
  const beatsPerBar = timeSignature[0];
  const progression = parseGrid(form.grid, { timeSignature });
  const barCount = progression.bars.length;
  const slots = progression.bars.flatMap((bar, i) =>
    bar.chords.map(chord => ({ bar: i + 1, beat: chord.beat, symbol: chord.symbol, chord: parseChord(chord.symbol) })));
  const and = form.swing === false ? 0.5 : SWUNG;

  // ---- Which chord each attack answers ----
  const judged = [];
  for (const attack of attacks) {
    const placed = placeAttack(attack, { timeSignature, tempo: form.tempo, swing: form.swing !== false });
    if (placed.bar < 1) continue;                                   // the count-in
    let chorus = Math.floor((placed.bar - 1) / barCount);
    const barInChorus = ((placed.bar - 1) % barCount) + 1;
    let index = -1;
    slots.forEach((slot, i) => { if (slot.bar === barInChorus && slot.beat <= placed.beat + EPSILON) index = i; });
    let anticipated = false;
    // Only across the bar line, from the last "and" of the bar, as in the game (Edi).
    if (Math.abs(placed.beat - (beatsPerBar + and)) < EPSILON) {
      index += 1;
      if (index === slots.length) { index = 0; chorus += 1; }
      anticipated = true;
    }
    const slot = slots[index];
    judged.push({
      notes: [...attack.notes].sort((a, b) => a - b),
      move: Boolean(attack.move),
      bar: placed.bar,
      beat: placed.beat,
      offsetMs: placed.offsetMs,
      onBeat: placed.onBeat,
      chorus: chorus + 1,
      slot: chorus * slots.length + index,
      symbol: slot.symbol,
      anticipated,
      analysis: analyzeVoicing(attack.notes, slot.chord),
    });
  }

  const hits = judged.filter(j => !j.move);
  const lastSlot = judged.reduce((max, j) => Math.max(max, j.slot), -1);
  const choruses = lastSlot < 0 ? 0 : Math.floor(lastSlot / slots.length) + 1;
  const lastBar = judged.reduce((max, j) => Math.max(max, j.bar), 0);
  const slotAt = global => slots[global % slots.length];
  const barOf = global => Math.floor(global / slots.length) * barCount + slotAt(global).bar;
  const bySlot = new Map();
  for (const j of judged) {
    if (!bySlot.has(j.slot)) bySlot.set(j.slot, []);
    bySlot.get(j.slot).push(j);
  }

  const findings = [];
  const say = (level, code, { count, of = null, bars = [], params = {} }, text) =>
    findings.push({ level, code, count, of, bars: unique(bars).sort((a, b) => a - b), params, text });

  // ---- 1. The chords ----
  const missedBySlot = new Map();
  for (let g = 0; g <= lastSlot; g++) {
    if (bySlot.has(g)) continue;
    const index = g % slots.length;
    if (!missedBySlot.has(index)) missedBySlot.set(index, []);
    missedBySlot.get(index).push(barOf(g));
  }
  for (const [index, bars] of missedBySlot) {
    say('problem', 'missed-change', { count: bars.length, bars, params: { symbol: slots[index].symbol } },
      `${slots[index].symbol} not played in ${barsText(bars)}`);
  }

  const stale = new Set();
  for (const [g, list] of bySlot) {
    const first = list.find(j => !j.move);
    if (!first || g === 0 || isClean(first.analysis)) continue;
    const previous = slotAt(g - 1);
    if (previous.symbol === first.symbol) continue;
    if (isClean(analyzeVoicing(first.notes, previous.chord))) stale.add(first);
  }
  if (stale.size >= limits.habitMin) {
    const bars = [...stale].map(j => j.bar);
    say('problem', 'stale-chord', { count: stale.size, bars }, `Stayed on the previous chord after the change, ${stale.size} times`);
  }

  const toneHits = hits.filter(j => !stale.has(j));
  const byQuality = groupBy(toneHits, j => parseChord(j.symbol).quality);
  for (const [kind, label] of [['missing', 'missing-tone'], ['wrong', 'wrong-note'], ['avoid', 'avoid-note']]) {
    for (const [quality, list] of byQuality) {
      const habits = new Map();
      for (const j of list) {
        const chord = parseChord(j.symbol);
        for (const pc of j.analysis[kind]) {
          const key = kind === 'wrong' ? (pc - chord.rootPc + 12) % 12 : chord.degrees[pc];
          if (!habits.has(key)) habits.set(key, []);
          habits.get(key).push(j.bar);
        }
      }
      for (const [key, bars] of habits) {
        if (bars.length < limits.habitMin || bars.length < limits.habitShare * list.length) continue;
        const params = kind === 'wrong' ? { quality, semitones: key } : { quality, degree: key };
        const what = kind === 'wrong' ? `a note ${key} semitones above the root` : `the ${key}`;
        const verb = kind === 'missing' ? `missing ${what}` : kind === 'wrong' ? `${what}, a wrong note` : `${what}, an avoid note`;
        say('problem', label, { count: bars.length, of: list.length, bars, params }, `On ${quality}: ${verb}, ${bars.length} of ${list.length} times`);
      }
    }
  }
  for (const [quality, list] of byQuality) {
    const clean = list.filter(j => isClean(j.analysis)).length;
    if (list.length >= limits.minAttacks && clean >= limits.cleanShare * list.length) {
      say('strength', 'quality-clean', { count: clean, of: list.length, params: { quality } }, `${quality} chords: clean in ${clean} of ${list.length}`);
    }
  }

  // ---- 2. Register ----
  const high = hits.filter(j => j.notes[j.notes.length - 1] > limits.topNote);
  if (high.length >= limits.habitMin) {
    say('problem', 'too-high', { count: high.length, of: hits.length, bars: high.map(j => j.bar) },
      `The top note goes above ${midiToName(limits.topNote)} in ${high.length} attacks`);
  }
  const pairs = new Map();
  let muddyHits = 0;
  for (const j of hits) {
    if (j.analysis.muddy.length) muddyHits++;
    for (const { lower, upper } of j.analysis.muddy) {
      const key = `${lower}-${upper}`;
      if (!pairs.has(key)) pairs.set(key, { lower, upper, bars: [] });
      pairs.get(key).bars.push(j.bar);
    }
  }
  const muddyPairs = [...pairs.values()].filter(p => p.bars.length >= limits.habitMin);
  for (const { lower, upper, bars } of muddyPairs) {
    say('problem', 'muddy', { count: bars.length, bars, params: { lower: midiToName(lower), upper: midiToName(upper) } },
      `Too low: ${midiToName(lower)}–${midiToName(upper)} is muddy, ${bars.length} times`);
  }
  if (!muddyPairs.length && muddyHits >= limits.habitMin && hits.length >= limits.minAttacks && muddyHits >= limits.muddyShare * hits.length) {
    say('problem', 'muddy', { count: muddyHits, of: hits.length, params: {} }, `Too low: muddy intervals in ${muddyHits} of ${hits.length} attacks`);
  }

  const center = j => j.notes.reduce((sum, n) => sum + n, 0) / j.notes.length;
  if (hits.length >= limits.minAttacks) {
    const below = hits.filter(j => center(j) < limits.centerLow);
    const above = hits.filter(j => center(j) > limits.centerHigh);
    for (const [side, list, edge] of [['below', below, limits.centerLow], ['above', above, limits.centerHigh]]) {
      if (list.length >= limits.centerOutShare * hits.length && list.length >= limits.habitMin) {
        say('problem', 'center-out', { count: list.length, of: hits.length, bars: list.map(j => j.bar), params: { side } },
          `The middle of your voicings is ${side} ${midiToName(edge)} in ${list.length} of ${hits.length} attacks`);
      }
    }
  }

  const perChorus = [];
  for (let c = 1; c <= choruses; c++) {
    const list = hits.filter(j => j.chorus === c);
    const tops = topLine(bySlot, c, slots.length);
    perChorus.push({
      chorus: c,
      attacks: list.length,
      center: list.length ? list.reduce((sum, j) => sum + center(j), 0) / list.length : null,
      topRange: tops.length ? Math.max(...tops) - Math.min(...tops) : null,
    });
  }
  const measured = perChorus.filter(p => p.attacks >= 4);
  if (measured.length >= 2) {
    const [first, last] = [measured[0], measured[measured.length - 1]];
    if (Math.abs(last.center - first.center) >= limits.centerDrift) {
      const way = last.center < first.center ? 'down' : 'up';
      say('problem', 'center-drift', { count: Math.round(Math.abs(last.center - first.center)), params: { from: midiToName(Math.round(first.center)), to: midiToName(Math.round(last.center)), way } },
        `Your voicings move ${way} over the run: the middle goes from ${midiToName(Math.round(first.center))} to ${midiToName(Math.round(last.center))}`);
    }
  }
  if (!high.length && !hits.some(j => j.analysis.muddy.length) && choruses >= limits.registerOkChoruses) {
    say('strength', 'register-ok', { count: hits.length, params: {} }, `In register: nothing above ${midiToName(limits.topNote)}, nothing muddy`);
  }

  // ---- 3. Voice leading: the last hit on a chord against the first on the next ----
  const changes = [];
  for (let g = 0; g < lastSlot; g++) {
    if (!bySlot.has(g) || !bySlot.has(g + 1) || slotAt(g).symbol === slotAt(g + 1).symbol) continue;
    const from = bySlot.get(g)[bySlot.get(g).length - 1];
    const to = bySlot.get(g + 1)[0];
    const comparison = compareVoicings(from.notes, to.notes);
    const tolerated = from.analysis.voicing.type === 'spread' && to.analysis.voicing.type === 'spread';
    changes.push({ to: (g + 1) % slots.length, bar: to.bar, from: slotAt(g).symbol, symbol: slotAt(g + 1).symbol, comparison, rating: tolerated ? null : comparison.rating, anticipated: to.anticipated });
  }
  const bySpot = groupBy(changes, c => c.to);
  for (const [, list] of bySpot) {
    const jumpy = list.filter(c => c.rating === 'jumpy');
    if (jumpy.length >= limits.habitMin && jumpy.length >= limits.jumpySpotShare * list.length) {
      say('problem', 'jumpy-spot', { count: jumpy.length, of: list.length, bars: jumpy.map(c => c.bar), params: { from: list[0].from, to: list[0].symbol } },
        `The move from ${list[0].from} to ${list[0].symbol} jumps every time (${jumpy.length} of ${list.length})`);
    }
  }
  const rated = changes.filter(c => c.rating);
  if (rated.length >= limits.minChanges) {
    const jumpy = rated.filter(c => c.rating === 'jumpy');
    const smooth = rated.filter(c => c.rating === 'smooth');
    if (jumpy.length >= limits.jumpyShare * rated.length) {
      say('problem', 'jumpy-overall', { count: jumpy.length, of: rated.length, bars: jumpy.map(c => c.bar) }, `${jumpy.length} of ${rated.length} chord changes jump`);
    }
    if (smooth.length >= limits.smoothShare * rated.length) {
      const average = rated.reduce((sum, c) => sum + c.comparison.averageMove, 0) / rated.length;
      say('strength', 'smooth-overall', { count: smooth.length, of: rated.length, params: { average: Math.round(average * 10) / 10 } },
        `Smooth voice leading: ${Math.round(average * 10) / 10} semitones a voice on average`);
    }
  }

  // ---- 4. Variety ----
  if (hits.length >= limits.minAttacks) {
    const types = countBy(hits, j => j.analysis.voicing.type);
    const [topType, topCount] = mostCommon(types);
    if (topCount >= limits.oneTypeShare * hits.length) {
      say('problem', 'one-type', { count: topCount, of: hits.length, params: { type: topType } }, `Almost only ${topType} (${share(topCount, hits.length)})`);
    }
    const mixed = [...types].filter(([, n]) => n >= limits.mixedTypeShare * hits.length);
    if (mixed.length >= limits.mixedTypes) {
      say('strength', 'types-mixed', { count: mixed.length, params: { types: mixed.map(([type]) => type) } }, `You mixed ${mixed.map(([type]) => type).join(', ')}`);
    }

    const sizes = countBy(hits, j => j.notes.length);
    const [topSize, sizeCount] = mostCommon(sizes);
    if (sizeCount >= limits.oneDensityShare * hits.length) {
      say('problem', 'one-density', { count: sizeCount, of: hits.length, params: { notes: topSize } }, `Always ${topSize} notes (${share(sizeCount, hits.length)})`);
    }
    const thin = hits.filter(j => j.notes.length <= 3).length;
    const thick = hits.length - thin;
    if (thin >= limits.densityGroupShare * hits.length && thick >= limits.densityGroupShare * hits.length) {
      say('strength', 'density-varied', { count: hits.length, params: { thin, thick } }, `Light and full voicings both: ${thin} of 2–3 notes, ${thick} of 4 or more`);
    }
  }

  const lines = [];
  for (let c = 1; c <= choruses; c++) lines.push(topLine(bySlot, c, slots.length));
  const full = lines.filter(line => line.length >= limits.minTops);
  const statics = full.filter(line => Math.max(...line) - Math.min(...line) <= limits.staticTopRange);
  if (statics.length >= limits.staticTopChoruses) {
    const line = statics[0];
    say('problem', 'static-top', { count: statics.length, of: full.length, params: { low: midiToName(Math.min(...line)), high: midiToName(Math.max(...line)) } },
      `The top note stays between ${midiToName(Math.min(...line))} and ${midiToName(Math.max(...line))} for whole choruses (${statics.length})`);
  }
  const steps = full.flatMap(line => line.slice(1).map((n, i) => Math.abs(n - line[i])));
  if (full.length && steps.length >= limits.minChanges && full.every(line => Math.max(...line) - Math.min(...line) >= limits.topLineRange)) {
    const stepwise = steps.filter(s => s >= 1 && s <= 2).length;
    if (stepwise >= limits.topStepShare * steps.length) {
      say('strength', 'top-line', { count: stepwise, of: steps.length }, `Your top line moves, mostly by step (${stepwise} of ${steps.length})`);
    }
  }

  // Rhythm: hits only, on the eighth grid, bar by bar.
  if (hits.length >= limits.minAttacks && lastBar >= 1) {
    const patterns = new Map();
    for (let bar = 1; bar <= lastBar; bar++) patterns.set(bar, []);
    for (const j of hits) patterns.get(j.bar)?.push(Math.round(j.beat * 1000) / 1000);
    const byPattern = countBy([...patterns.values()], beats => unique(beats).sort((a, b) => a - b).join(' '));
    const [pattern, barsWith] = mostCommon(byPattern);
    if (lastBar >= limits.minBars && barsWith >= limits.samePatternShare * lastBar) {
      const beats = pattern ? pattern.split(' ').map(Number) : [];
      say('problem', 'same-pattern', { count: barsWith, of: lastBar, params: { beats } }, `The same rhythm in ${barsWith} of ${lastBar} bars (${beats.join(', ') || 'silence'})`);
    }
    const onBeat = hits.filter(j => j.onBeat).length;
    if (onBeat >= limits.downbeatShare * hits.length) {
      say('problem', 'downbeats-only', { count: onBeat, of: hits.length }, `Only on the beats, ${onBeat} of ${hits.length}`);
    }
    const perBar = hits.length / lastBar;
    if (perBar >= limits.busyPerBar) {
      say('problem', 'too-busy', { count: hits.length, of: lastBar, params: { perBar: Math.round(perBar * 10) / 10 } }, `${Math.round(perBar * 10) / 10} attacks a bar on average`);
    }
  }
  const realChanges = [];
  for (let g = 0; g < lastSlot; g++) if (slotAt(g).symbol !== slotAt(g + 1).symbol) realChanges.push(g + 1);
  const pushes = hits.filter(j => j.anticipated && j.slot > 0 && slotAt(j.slot).symbol !== slotAt(j.slot - 1).symbol);
  const pushed = unique(pushes.map(j => j.slot));
  if (pushed.length >= limits.habitMin && pushed.length >= limits.pushShare * realChanges.length) {
    say('strength', 'pushes', { count: pushed.length, of: realChanges.length, bars: pushes.map(j => j.bar) }, `You anticipated ${pushed.length} chord changes`);
  }
  if (hits.length >= limits.timingMin) {
    const offsets = hits.map(j => j.offsetMs);
    const mean = offsets.reduce((sum, o) => sum + o, 0) / offsets.length;
    const spread = Math.sqrt(offsets.reduce((sum, o) => sum + (o - mean) ** 2, 0) / offsets.length);
    if (mean <= -limits.timingMean) say('problem', 'rushing', { count: hits.length, params: { ms: Math.round(-mean) } }, `You land ${Math.round(-mean)} ms ahead of the beat`);
    if (mean >= limits.timingMean) say('problem', 'dragging', { count: hits.length, params: { ms: Math.round(mean) } }, `You land ${Math.round(mean)} ms behind the beat`);
    if (spread >= limits.timingSpread) say('problem', 'timing-loose', { count: hits.length, params: { ms: Math.round(spread) } }, `Loose time: ±${Math.round(spread)} ms`);
  }

  return { choruses, bars: lastBar, attacks: hits.length, findings, judged, changes, perChorus };
}

/**
 * @typedef {{ level: 'problem' | 'strength', code: string, count: number, of: number | null,
 *             bars: number[], params: object, text: string }} Finding
 * @typedef {{ notes: number[], move: boolean, bar: number, beat: number, offsetMs: number, onBeat: boolean,
 *             chorus: number, slot: number, symbol: string, anticipated: boolean, analysis: object }} Judged
 * @typedef {{ to: number, bar: number, from: string, symbol: string, comparison: object,
 *             rating: 'smooth' | 'ok' | 'jumpy' | null, anticipated: boolean }} Change
 */

// The top note of the first thing played on each chord of a chorus, in the order of the form.
function topLine(bySlot, chorus, slotCount) {
  const line = [];
  for (let g = (chorus - 1) * slotCount; g < chorus * slotCount; g++) {
    const first = bySlot.get(g)?.[0];
    if (first) line.push(first.notes[first.notes.length - 1]);
  }
  return line;
}

function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function countBy(items, keyOf) {
  const counts = new Map();
  for (const item of items) counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1);
  return counts;
}

function mostCommon(counts) {
  return [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best), [null, 0]);
}

const unique = items => [...new Set(items)];
const share = (n, of) => `${Math.round((n / of) * 100)}%`;
const barsText = bars => (bars.length === 1 ? `bar ${bars[0]}` : `bars ${bars.join(', ')}`);

// Measured against the click as scheduled, not as heard: until the audio latency is measured on
// the player's own setup, these could be false, and a false finding fails the report.
export const TIMING_CODES = ['rushing', 'dragging', 'timing-loose'];

/**
 * What the panel shows, in order: at most `firstProblems` problems first (the report's order is
 * already the spec's), then the strengths, then the other problems; timing findings held back.
 *
 * @param {{ findings: Finding[] }} report
 * @param {{ firstProblems?: number }} [options]
 * @returns {{ first: Finding[], strengths: Finding[], rest: Finding[], heldBack: Finding[] }}
 */
export function presentReport(report, { firstProblems = 3 } = {}) {
  const heldBack = report.findings.filter(f => TIMING_CODES.includes(f.code));
  const shown = report.findings.filter(f => !TIMING_CODES.includes(f.code));
  const problems = shown.filter(f => f.level === 'problem');
  return {
    first: problems.slice(0, firstProblems),
    strengths: shown.filter(f => f.level === 'strength'),
    rest: problems.slice(firstProblems),
    heldBack,
  };
}
