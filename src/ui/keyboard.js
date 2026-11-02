// On-screen keyboard as SVG: drawn once, then recolored by role. No theory here.

import { midiToName } from '../theory/notes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const WHITE_W = 20;
const WHITE_H = 84;
const BLACK_W = 12;
const BLACK_H = 52;

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

// What an armed key wears: an outline inside the key and a dot, never a fill. A fill on a key is
// the verdict's (review 2026-10-30, #25: the armed blue was the tension blue). The outline is drawn
// inside the key, because a thick stroke on the key itself would be half covered by its neighbours.
function markOf(colour, x, width, height, dotY) {
  const mark = el('g', { class: `key-mark ${colour}` });
  mark.append(
    el('rect', { x: x + 2.5, y: 2.5, width: width - 5, height: height - 5, rx: 2 }),
    el('circle', { cx: x + width / 2, cy: dotY, r: colour === 'white' ? 3.5 : 2.5 }),
  );
  return mark;
}

/**
 * Builds the keys inside `svg` (E1–G7 by default, the 76 keys of a Genos). Returns
 * { highlight(classesByMidi) }. With `onKey`, a key answers the mouse and the touchscreen: it
 * reports which note was pressed and leaves what that means to the caller.
 *
 * @param {SVGSVGElement} svg
 * @param {{ from?: number, to?: number, onKey?: ((midi: number) => void) | null }} [options]
 * @returns {{ highlight: (classesByMidi: Record<number, string>) => void }}
 */
export function createKeyboard(svg, { from = 28, to = 103, onKey = null } = {}) {
  const keys = new Map();
  const whites = [];
  const blacks = [];
  const marks = { white: [], black: [] };
  const labels = [];
  let whiteIndex = 0;

  for (let midi = from; midi <= to; midi++) {
    const pc = midi % 12;
    if (BLACK_PCS.has(pc)) {
      // A black key sits on the boundary between the previous white key and the next one.
      const x = whiteIndex * WHITE_W - BLACK_W / 2;
      const rect = el('rect', { x, y: 0, width: BLACK_W, height: BLACK_H, rx: 2 });
      const mark = markOf('black', x, BLACK_W, BLACK_H, BLACK_H - 11);
      blacks.push(rect);
      marks.black.push(mark);
      keys.set(midi, { rect, base: 'key black', mark });
    } else {
      const x = whiteIndex * WHITE_W;
      const rect = el('rect', { x, y: 0, width: WHITE_W, height: WHITE_H, rx: 3 });
      // The dot sits below where the black keys end and above the C label.
      const mark = markOf('white', x, WHITE_W, WHITE_H, WHITE_H - 22);
      whites.push(rect);
      marks.white.push(mark);
      keys.set(midi, { rect, base: 'key white', mark });
      if (pc === 0) {
        const text = el('text', { x: whiteIndex * WHITE_W + WHITE_W / 2, y: WHITE_H - 6, 'text-anchor': 'middle', class: 'key-label' });
        text.textContent = midiToName(midi);
        labels.push(text);
      }
      whiteIndex++;
    }
  }

  svg.setAttribute('viewBox', `0 0 ${whiteIndex * WHITE_W} ${WHITE_H}`);
  svg.replaceChildren(...whites, ...marks.white, ...blacks, ...marks.black, ...labels);
  highlight({});

  if (onKey) {
    // The black keys are drawn last, so they are on top and the browser hands them the press.
    const byRect = new Map([...keys].map(([midi, { rect }]) => [rect, midi]));
    svg.classList.add('playable');
    svg.addEventListener('pointerdown', event => {
      const midi = byRect.get(event.target);
      if (midi === undefined) return;
      event.preventDefault();
      onKey(midi);
    });
  }

  function highlight(classesByMidi) {
    for (const [midi, { rect, base, mark }] of keys) {
      const extra = classesByMidi[midi];
      rect.setAttribute('class', extra ? `${base} ${extra}` : base);
      mark.classList.toggle('armed', extra?.split(' ').includes('armed') ?? false);
    }
  }

  return { highlight };
}

/**
 * Where a narrow keyboard's window starts (the MIDI number of its lowest C), so that the notes
 * being shown are on it. Notes already inside leave it alone, or it would jump under the finger;
 * otherwise it starts on the C at or below the lowest note, within the full keyboard's edges.
 *
 * @param {number} low  where the window starts now
 * @param {number[]} notes  the notes that have to be seen
 * @param {{ span?: number, min?: number, max?: number }} [options]  window width in semitones,
 *   and the full keyboard's lowest and highest notes
 * @returns {number}
 */
export function fitWindow(low, notes, { span = 24, min = 36, max = 84 } = {}) {
  if (!notes.length || notes.every(note => note >= low && note <= low + span)) return low;
  const start = 12 * Math.floor(Math.min(...notes) / 12);
  return Math.min(max - span, Math.max(min, start));
}
