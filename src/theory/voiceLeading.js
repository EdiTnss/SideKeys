// Voice leading between two voicings. Pure, no DOM.
//
// Notes are points on one line (MIDI numbers), and for points on a line the matching with the
// smallest total movement is the sorted one: lowest with lowest, and so on, no crossing. When the
// voicings differ in size, every subset of the larger one is tried (at most a few dozen for
// 3–6 notes) and the cheapest wins. Simpler than greedy, and exact.

const rate = averageMove => (averageMove <= 1.5 ? 'smooth' : averageMove <= 3 ? 'ok' : 'jumpy');

/**
 * → { pairs: [{ from, to, semitones }], movement, commonTones, unmatched: { previous, next },
 *     averageMove, rating: 'smooth' | 'ok' | 'jumpy' | null }
 */
export function compareVoicings(previous, next) {
  const from = [...previous].sort((a, b) => a - b);
  const to = [...next].sort((a, b) => a - b);
  const previousIsSmaller = from.length <= to.length;
  const [small, large] = previousIsSmaller ? [from, to] : [to, from];

  let best = null;
  for (const subset of combinations(large, small.length)) {
    const cost = small.reduce((sum, note, i) => sum + Math.abs(note - subset[i]), 0);
    if (best === null || cost < best.cost) best = { cost, subset };
  }

  const pairs = small.map((note, i) => {
    const [f, t] = previousIsSmaller ? [note, best.subset[i]] : [best.subset[i], note];
    return { from: f, to: t, semitones: t - f };
  });
  const leftover = withoutOnce(large, best.subset);
  const unmatched = previousIsSmaller ? { previous: [], next: leftover } : { previous: leftover, next: [] };
  const movement = best.cost;
  const commonTones = pairs.filter(pair => pair.semitones === 0).length;
  const averageMove = pairs.length ? movement / pairs.length : 0;
  return { pairs, movement, commonTones, unmatched, averageMove, rating: pairs.length ? rate(averageMove) : null };
}

/**
 * steps: [{ comparison, fromType, toType }] → { movement, commonTones, averageMove, rating, jumpy }.
 * A jump between two spread voicings is a deliberate register change: it counts in the totals
 * but not in the rating, unless tolerateRegisterShift is false.
 */
export function scoreProgression(steps, { tolerateRegisterShift = true } = {}) {
  let movement = 0;
  let commonTones = 0;
  let ratedMovement = 0;
  let ratedPairs = 0;
  const jumpy = [];
  steps.forEach(({ comparison, fromType, toType }, index) => {
    movement += comparison.movement;
    commonTones += comparison.commonTones;
    const tolerated = tolerateRegisterShift && fromType === 'spread' && toType === 'spread';
    if (tolerated) return;
    ratedMovement += comparison.movement;
    ratedPairs += comparison.pairs.length;
    if (comparison.rating === 'jumpy') jumpy.push(index);
  });
  const averageMove = ratedPairs ? ratedMovement / ratedPairs : 0;
  return { movement, commonTones, averageMove, rating: steps.length ? rate(averageMove) : null, jumpy };
}

/** All k-element subsets of a sorted array, in order, as sorted arrays. */
function* combinations(items, k) {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = 0; i <= items.length - k; i++) {
    for (const rest of combinations(items.slice(i + 1), k - 1)) yield [items[i], ...rest];
  }
}

/** `items` minus one occurrence of each element of `used` (duplicates in a voicing stay honest). */
function withoutOnce(items, used) {
  const pool = [...used];
  return items.filter(item => {
    const at = pool.indexOf(item);
    if (at === -1) return true;
    pool.splice(at, 1);
    return false;
  });
}
