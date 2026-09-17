// DOM rendering for the drill. Reads analysis objects, writes HTML. No theory here.

import { midiToName, octave, spellDegree } from '../theory/notes.js';

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

export function renderChord(el, symbol) {
  el.textContent = symbol ?? '—';
}

export function renderStatus(el, text, level = '') {
  el.textContent = text;
  el.className = level;
}

export function clearFeedback(el) {
  el.replaceChildren(h('p', { class: 'hint' }, 'Play it.'));
}

/** Headline (first warning, or the voicing type), every message, then the notes with their degrees. */
export function renderAnalysis(el, analysis, chord) {
  const warnings = analysis.messages.filter(m => m.level === 'warning');
  const type = analysis.messages.find(m => m.code === 'type');
  const headline = warnings.length
    ? h('p', { class: 'headline warn' }, warnings[0].text)
    : h('p', { class: 'headline ok' }, `✓ ${type ? type.text : 'OK'}`);
  const list = h('ul', { class: 'messages' }, ...analysis.messages.map(m => h('li', { class: `${m.level} ${m.code}` }, m.text)));
  const notes = h('p', { class: 'notes' }, ...analysis.roles.map(role => h('span', { class: `role-${role.role}` }, noteLabel(role, chord))));
  el.replaceChildren(headline, list, notes);
}

/** 'Eb4 (b3)' spelled from the chord; wrong notes get a flat name and '?'. */
export function noteLabel(role, chord) {
  if (!role.degree) return `${midiToName(role.midi)} (?)`;
  return `${spellDegree(chord.root, role.degree)}${octave(role.midi)} (${role.degree})`;
}

/** midi → CSS class for the keyboard, by role. */
export function roleClasses(analysis) {
  const classes = {};
  for (const role of analysis.roles) classes[role.midi] = `role-${role.role}${role.caution ? ' caution' : ''}`;
  return classes;
}

export function heldClasses(notes) {
  return Object.fromEntries(notes.map(midi => [midi, 'held']));
}

/** Checkboxes for qualities and roots, debounce and next-note inputs. Calls onChange(settings) on every edit. */
export function renderSettings(container, settings, { symbols, roots, onChange }) {
  const form = h('form', { class: 'settings-form', onsubmit: e => e.preventDefault() });

  const checks = (name, values, selected) => h('fieldset', {},
    h('legend', {}, name === 'qualities' ? 'Chord qualities' : 'Roots'),
    ...values.map(value => h('label', { class: 'check' },
      h('input', { type: 'checkbox', name, value, ...(selected.includes(value) ? { checked: '' } : {}) }),
      ` ${value}`)),
    h('span', { class: 'bulk' },
      h('button', { type: 'button', onclick: () => setAll(name, true) }, 'all'),
      h('button', { type: 'button', onclick: () => setAll(name, false) }, 'none')),
  );

  const numbers = h('fieldset', {},
    h('legend', {}, 'Capture'),
    h('label', {}, 'Debounce (ms) ', h('input', { type: 'number', name: 'debounceMs', min: 50, max: 2000, step: 50, value: settings.debounceMs })),
    h('label', {}, '"Next" MIDI note ', h('input', { type: 'number', name: 'nextNote', min: 0, max: 127, value: settings.nextNote ?? '', placeholder: 'none' }),
      h('span', { class: 'note-name' }, settings.nextNote === null ? '' : ` = ${midiToName(settings.nextNote)}`)),
  );

  form.append(checks('qualities', symbols, settings.qualities), checks('roots', roots, settings.roots), numbers);
  form.addEventListener('change', () => onChange(read()));
  container.replaceChildren(form);

  function setAll(name, checked) {
    for (const box of form.querySelectorAll(`input[name="${name}"]`)) box.checked = checked;
    onChange(read());
  }

  function read() {
    const listOf = name => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(box => box.value);
    const nextRaw = form.elements.nextNote.value;
    const next = nextRaw === '' ? null : Number(nextRaw);
    form.querySelector('.note-name').textContent = next === null ? '' : ` = ${midiToName(next)}`;
    return {
      qualities: listOf('qualities'),
      roots: listOf('roots'),
      debounceMs: Number(form.elements.debounceMs.value) || settings.debounceMs,
      nextNote: next,
    };
  }
}
