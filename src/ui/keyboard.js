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

/** Builds the keys inside `svg` (E1–G7 by default, the 76 keys of a Genos). Returns { highlight(classesByMidi) }. */
export function createKeyboard(svg, { from = 28, to = 103 } = {}) {
  const keys = new Map();
  const whites = [];
  const blacks = [];
  const labels = [];
  let whiteIndex = 0;

  for (let midi = from; midi <= to; midi++) {
    const pc = midi % 12;
    if (BLACK_PCS.has(pc)) {
      // A black key sits on the boundary between the previous white key and the next one.
      const rect = el('rect', { x: whiteIndex * WHITE_W - BLACK_W / 2, y: 0, width: BLACK_W, height: BLACK_H, rx: 2 });
      blacks.push(rect);
      keys.set(midi, { rect, base: 'key black' });
    } else {
      const rect = el('rect', { x: whiteIndex * WHITE_W, y: 0, width: WHITE_W, height: WHITE_H, rx: 3 });
      whites.push(rect);
      keys.set(midi, { rect, base: 'key white' });
      if (pc === 0) {
        const text = el('text', { x: whiteIndex * WHITE_W + WHITE_W / 2, y: WHITE_H - 6, 'text-anchor': 'middle', class: 'key-label' });
        text.textContent = midiToName(midi);
        labels.push(text);
      }
      whiteIndex++;
    }
  }

  svg.setAttribute('viewBox', `0 0 ${whiteIndex * WHITE_W} ${WHITE_H}`);
  svg.replaceChildren(...whites, ...blacks, ...labels);
  highlight({});

  function highlight(classesByMidi) {
    for (const [midi, { rect, base }] of keys) {
      const extra = classesByMidi[midi];
      rect.setAttribute('class', extra ? `${base} ${extra}` : base);
    }
  }

  return { highlight };
}
