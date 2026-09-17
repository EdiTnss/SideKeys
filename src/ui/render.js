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

/** One line under the analysis: how the played chord moved from the previous one. */
export function renderComparison(el, comparison) {
  if (!comparison) return;
  const line = h('p', { class: `comparison ${comparison.rating}` },
    `From the previous chord: ${comparison.movement} semitone${comparison.movement === 1 ? '' : 's'} of movement, `
    + `${comparison.commonTones} common tone${comparison.commonTones === 1 ? '' : 's'} — ${comparison.rating}`);
  el.insertBefore(line, el.children[1] ?? null);
}

/** The grid as bars and slots; the current slot is outlined, played slots show ✓ or !. */
export function renderGrid(container, session, current) {
  const bars = new Map();
  session.slots.forEach((slot, index) => {
    if (!bars.has(slot.bar)) bars.set(slot.bar, []);
    const result = session.results.get(index);
    const classes = ['slot'];
    if (index === current) classes.push('current');
    let badge = '';
    if (result) {
      const warned = result.analysis.messages.some(m => m.level === 'warning');
      classes.push(warned ? 'warn' : 'ok');
      badge = warned ? '!' : '✓';
    }
    bars.get(slot.bar).push(h('span', { class: classes.join(' '), 'data-index': index }, slot.symbol, h('span', { class: 'badge' }, badge)));
  });
  container.replaceChildren(...[...bars.values()].map(slots => h('div', { class: 'bar' }, ...slots)));
}

/** Voice-leading summary of a chorus. */
export function renderSummary(container, summary, session, { title = 'Chorus' } = {}) {
  if (summary.played === 0) {
    container.replaceChildren(h('p', {}, `${title}: nothing played yet.`));
    return;
  }
  const { score } = summary;
  const parts = [`${title}: ${summary.played}/${summary.total} chords played`];
  if (summary.steps.length) {
    parts.push(`${score.movement} semitone${score.movement === 1 ? '' : 's'} of movement over ${summary.steps.length} change${summary.steps.length === 1 ? '' : 's'}`);
    parts.push(`${score.commonTones} common tone${score.commonTones === 1 ? '' : 's'}`);
  }
  const line = h('p', {}, parts.join(' · '), ' — ', h('strong', {}, score.rating ?? 'n/a'));
  const jumpy = score.jumpy.map(i => {
    const step = summary.steps[i];
    return h('li', { class: 'jumpy' }, `${session.slots[step.from].symbol} → ${session.slots[step.to].symbol}: ${step.comparison.movement} semitones`);
  });
  container.replaceChildren(line, ...(jumpy.length ? [h('ul', {}, ...jumpy)] : []));
}

/** The recorded melody under the grid: one box per bar, structural notes bold, passing notes muted. */
export function renderMelody(container, piece) {
  if (!piece) {
    container.replaceChildren();
    return;
  }
  const accidentals = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#'].includes(piece.key) ? 'sharp' : 'flat';
  const boxes = piece.bars.map(bar => {
    const chords = h('span', { class: 'bar-chords' }, bar.chords.map(c => c.symbol).join(' '));
    const notes = bar.melody.length
      ? h('span', {}, ...bar.melody.map(note => h('span', { class: note.structural ? 'structural' : 'passing', title: `beat ${note.beat}, ${note.duration} beat${note.duration === 1 ? '' : 's'}` }, `${midiToName(note.midi, { accidentals })} `)))
      : h('span', { class: 'rest' }, '—');
    return h('div', { class: 'bar' }, chords, notes);
  });
  const count = piece.bars.reduce((n, bar) => n + bar.melody.length, 0);
  const structural = piece.bars.reduce((n, bar) => n + bar.melody.filter(note => note.structural).length, 0);
  container.replaceChildren(
    h('p', { class: 'hint' }, `${piece.title}: ${count} notes, ${structural} structural (bold).`),
    ...boxes,
  );
}

export function renderError(container, message) {
  container.replaceChildren(h('p', { class: 'headline warn' }, message));
}

/** Fills a <select> with { value: label } pairs. */
export function fillSelect(select, options, selected) {
  select.replaceChildren(...Object.entries(options).map(([value, label]) =>
    h('option', { value, ...(value === selected ? { selected: '' } : {}) }, label)));
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

  const outputSelect = h('select', { name: 'outputId' }, h('option', { value: '' }, 'no MIDI output'));
  const midiOut = h('fieldset', {},
    h('legend', {}, 'MIDI out (suggestions)'),
    h('label', {}, 'Port ', outputSelect),
    h('label', {}, 'Channel ', h('input', { type: 'number', name: 'channel', min: 1, max: 16, value: settings.channel })),
  );

  form.append(checks('qualities', symbols, settings.qualities), checks('roots', roots, settings.roots), numbers, midiOut);
  form.addEventListener('change', () => onChange(read()));
  container.replaceChildren(form);

  /** Refills the output port list when devices come and go; keeps the chosen port when it still exists. */
  function setOutputs(outputs, selectedId) {
    const wanted = selectedId ?? outputSelect.value;
    outputSelect.replaceChildren(
      h('option', { value: '' }, outputs.length ? 'first available' : 'no MIDI output'),
      ...outputs.map(o => h('option', { value: o.id }, o.name)),
    );
    outputSelect.value = outputs.some(o => o.id === wanted) ? wanted : '';
  }

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
      outputId: form.elements.outputId.value || null,
      channel: Math.min(16, Math.max(1, Number(form.elements.channel.value) || 1)),
    };
  }

  return { setOutputs };
}

/** A line under the analysis: which voicing was suggested and whether it was sent. */
export function renderSuggestion(el, candidate, chord, { sent, index, total }) {
  el.querySelector('.suggestion')?.remove();
  const notes = candidate.notes.map(midi => noteLabel({ midi, degree: chord.degrees[midi % 12] }, chord).replace(/ \(.*\)$/, '')).join(' ');
  const type = candidate.type.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
  const where = sent ? 'sent to MIDI out' : 'no MIDI output selected';
  el.append(h('p', { class: 'suggestion' }, `Suggestion ${index + 1}/${total}: ${type} — ${notes} (${where}; P for the next one)`));
}

/** midi → 'suggested' outline for the keyboard, merged over the current classes. */
export function withSuggestion(classes, notes) {
  const merged = { ...classes };
  for (const midi of notes) merged[midi] = merged[midi] ? `${merged[midi]} suggested` : 'suggested';
  return merged;
}
