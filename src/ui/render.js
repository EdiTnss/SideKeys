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

/** 'Session: 12 chords, 9 clean (75%) · weak spots: 7alt b13 missing 2×' */
export function renderStats(el, stats, { label = 'Session', spots = [] } = {}) {
  const weak = spots.map(s => `${s.key} ${s.problem} ${s.count}×`).join(', ');
  el.replaceChildren(`${label}: ${summaryText(stats)}`, ...(weak ? [' · weak spots: ', h('span', { class: 'weak' }, weak)] : []));
}

let summaryText = () => '';
/** Lets app.js hand over stats.summaryLine without ui/render importing ui/stats. */
export function useStatsSummary(fn) {
  summaryText = fn;
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
export function renderSettings(container, settings, { symbols, roots, onChange, onResetStats }) {
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

  const statsLine = h('span', { class: 'stats-cumulative' }, '');
  const statistics = h('fieldset', {},
    h('legend', {}, 'Statistics (all sessions)'),
    statsLine,
    h('span', { class: 'bulk' }, h('button', { type: 'button', onclick: () => onResetStats?.() }, 'reset')),
  );

  const ai = h('fieldset', {},
    h('legend', {}, 'AI (Ask Claude)'),
    h('label', { class: 'wide' }, 'Proxy URL ',
      h('input', { type: 'url', name: 'proxyUrl', value: settings.proxyUrl ?? '', placeholder: 'https://voicing-lab-proxy.<account>.workers.dev/', spellcheck: 'false' })),
    h('span', { class: 'note-name' }, 'The Cloudflare Worker from worker/; empty = off. The key never leaves the Worker.'),
  );

  form.append(checks('qualities', symbols, settings.qualities), checks('roots', roots, settings.roots), numbers, midiOut, ai, statistics);
  form.addEventListener('change', () => onChange(read()));
  container.replaceChildren(form);

  function setCumulative(stats, spots) {
    renderStats(statsLine, stats, { label: 'All sessions', spots });
  }

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
      proxyUrl: form.elements.proxyUrl.value.trim(),
    };
  }

  return { setOutputs, setCumulative };
}

/** A line under the analysis: which voicing was suggested and whether it was sent. */
export function renderSuggestion(el, candidate, chord, { sent, index, total }) {
  el.querySelector('.suggestion')?.remove();
  const where = sent ? 'sent to MIDI out' : 'no MIDI output selected';
  el.append(h('p', { class: 'suggestion' }, `Suggestion ${index + 1}/${total}: ${typeName(candidate.type)} — ${noteNames(candidate.notes, chord)} (${where}; P for the next one)`));
}

/** 'rootless-A' → 'Rootless A'. */
function typeName(type) {
  return type.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

/** 'E3 G3 B3 D4', spelled from the chord. */
function noteNames(notes, chord) {
  return notes.map(midi => noteLabel({ midi, degree: chord.degrees[midi % 12] }, chord).replace(/ \(.*\)$/, '')).join(' ');
}

// ---- Reharmonization ----------------------------------------------------------------------

const PERCENT = value => `${Math.round(value * 100)}%`;

/** The original grid and the reharmonized one, bar under bar, with the scores and the whys. */
export function renderReharm(el, result, { onUse } = {}) {
  const bars = reharmBars(result);
  const why = h('p', { class: 'reharm-why' }, 'Click a changed bar for the reason.');

  const row = (label, pick, changeable) => h('div', { class: 'grid-view' },
    h('span', { class: 'row-label' }, label),
    ...bars.map(bar => h('span', {
      class: `bar${changeable && bar.changed ? ` changed ${bar.status}` : ''}`,
      ...(changeable && bar.why ? { title: bar.why } : {}),
      onclick: () => { why.textContent = barReason(bar); },
    }, pick(bar).join(' ') || '—')),
  );

  el.replaceChildren(
    h('p', { class: 'reharm-scores' }, scoreLine(result.scores)),
    row('Original', bar => bar.from, false),
    row('Reharm', bar => bar.to, true),
    why,
  );
  if (result.problems.length) {
    el.append(h('ul', { class: 'reharm-problems' }, ...result.problems.map(problem =>
      h('li', {}, problem.bar ? `Bar ${problem.bar}: ${problem.reason}` : problem.reason))));
  }
  if (!result.gridParses) {
    el.append(h('p', { class: 'reharm-problems' }, 'This grid cannot be written as text (a chord starts off the beat), so it cannot be sent to the Progression tab.'));
  }
  if (onUse) {
    const useReharm = h('button', { type: 'button', onclick: () => onUse('reharm') }, 'Practise the reharm');
    useReharm.disabled = !result.gridParses;
    el.append(h('p', { class: 'reharm-use' },
      h('button', { type: 'button', onclick: () => onUse('original') }, 'Practise the original'),
      useReharm));
  }
}

function barReason(bar) {
  if (!bar.changed) return `Bar ${bar.bar}: unchanged.`;
  const technique = bar.techniques.join(', ');
  const reason = bar.why || 'no reason given';
  return `Bar ${bar.bar} (${technique}): ${reason}`;
}

function scoreLine(scores) {
  const target = `${Math.round(scores.densityTarget.min * 100)}–${PERCENT(scores.densityTarget.max)}`;
  const techniques = Object.entries(scores.techniques).map(([name, count]) => `${name} ×${count}`).join(', ');
  return [
    `Clashes ${scores.clashes}`,
    `avoid notes ${scores.warnings}`,
    `density ${PERCENT(scores.density)} (target ${target}) ${scores.densityOk ? '✓' : '✗'}`,
    `longest run ${scores.maxRun} ${scores.maxRunOk ? '✓' : '✗'}`,
    `bass ${scores.bassSmoothness.toFixed(2)}`,
    `techniques ${scores.techniqueMix}${techniques ? ` (${techniques})` : ''}`,
  ].join(' · ');
}

/** One entry per bar: the original symbols, the new ones, and what happened there. */
function reharmBars(result) {
  const bars = result.analyzed.bars.map((bar, i) => ({
    bar: i + 1,
    from: bar.chords.map(chord => chord.symbol),
    to: [],
    changed: false,
    status: 'ok',
    techniques: [],
    why: '',
    beats: [],
  }));
  for (const slot of result.slots) {
    for (const chord of slot.chords) {
      const entry = bars[chord.bar - 1];
      if (!entry) continue;
      entry.beats.push({ beat: chord.beat, symbol: chord.symbol });
      if (slot.changed && !entry.techniques.includes(slot.technique)) entry.techniques.push(slot.technique);
      if (slot.changed && slot.why && !entry.why) entry.why = slot.why;
      if (slot.status === 'rejected') entry.status = 'rejected';
      else if (slot.status === 'warning' && entry.status === 'ok') entry.status = 'warning';
    }
  }
  for (const entry of bars) {
    entry.to = entry.beats.sort((a, b) => a.beat - b.beat).map(chord => chord.symbol);
    entry.changed = entry.to.join(' ') !== entry.from.join(' ');
  }
  return bars;
}

/** One line for the Ask Claude flow: waiting, or an error. Replaces any earlier Claude block. */
export function renderAiStatus(el, text, level = 'hint') {
  el.querySelector('.ai')?.remove();
  el.append(h('p', { class: `ai ai-status ${level}` }, text));
}

/**
 * Claude's alternatives under the analysis: each with its promised type, notes, reason and a Play
 * button; the ones the analyzer rejected as one muted line with the reasons.
 */
export function renderAiSuggestions(el, result, chord, { onPlay }) {
  el.querySelector('.ai')?.remove();
  const { suggestions, rejected } = result;
  const items = suggestions.map((suggestion, index) => h('li', {},
    h('button', { type: 'button', class: 'play', onclick: () => onPlay(suggestion, index) }, `Play ${index + 1}`),
    h('strong', {}, ` ${typeName(suggestion.label)}: `),
    h('span', { class: 'ai-notes' }, noteNames(suggestion.notes, chord)),
    h('span', { class: 'why' }, ` — ${suggestion.why}`)));
  const block = h('div', { class: 'ai' },
    h('p', { class: 'ai-title' }, `Claude${result.model ? ` (${result.model})` : ''}: ${suggestions.length ? 'press 1 or 2 to hear one' : 'nothing passed the analyzer'}`),
    h('ol', { class: 'ai-list' }, ...items));
  if (rejected.length) {
    block.append(h('p', { class: 'ai-rejected' },
      `${rejected.length} suggestion${rejected.length > 1 ? 's' : ''} rejected by the analyzer: ${rejected.map(r => r.reason).join('; ')}`));
  }
  el.append(block);
}

/** midi → 'suggested' outline for the keyboard, merged over the current classes. */
export function withSuggestion(classes, notes) {
  const merged = { ...classes };
  for (const midi of notes) merged[midi] = merged[midi] ? `${merged[midi]} suggested` : 'suggested';
  return merged;
}
