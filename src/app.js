// The only place that ties theory, MIDI, audio and UI together. Two modes: the drill
// (random chords) and the progression (a grid, free or timed by the metronome).

import { parseChord } from './theory/chords.js';
import { analyzeVoicing } from './theory/analyzer.js';
import { PROGRESSIONS, getProgression, parseGrid, formatGrid, GridParseError } from './theory/progressions.js';
import { suggestVoicings } from './theory/voicings.js';
import { VoicingCapture } from './midi/capture.js';
import { connectMidi } from './midi/input.js';
import { createOutput } from './midi/output.js';
import { createMetronome } from './audio/metronome.js';
import { DRILL_SYMBOLS, ROOTS, nextChord, loadSettings, saveSettings } from './ui/drill.js';
import { createSession } from './ui/session.js';
import { createKeyboard } from './ui/keyboard.js';
import {
  renderChord, renderStatus, renderAnalysis, renderComparison, clearFeedback, renderSettings,
  roleClasses, heldClasses, renderGrid, renderSummary, renderError, fillSelect, renderSuggestion, withSuggestion,
} from './ui/render.js';

const $ = id => document.getElementById(id);

let settings = loadSettings();
let mode = 'drill';                 // 'drill' | 'progression'
let symbol = null;                  // drill: the current chord symbol
let chord = null;                   // the chord the next snapshot is analysed against
let session = null;                 // progression: createSession(...)
let metronome = null;
let shownIndex = -1;                // progression: the slot on screen
let chorus = 1;
let output = null;                  // MIDI out, once access is granted
let outputs = [];                   // known output ports
let lastVoicing = null;             // notes of the last chord played or suggested, for voice leading
let currentClasses = {};            // keyboard colors of the last analysis
let suggestions = null;             // { symbol, previous, list, index }: cached candidates for the chord on screen

const keyboard = createKeyboard($('keyboard'));
const capture = new VoicingCapture({
  debounceMs: settings.debounceMs,
  nextNote: settings.nextNote,
  onVoicing,
  onNext,
  onChange: held => keyboard.highlight(heldClasses(held)),
});

// ---- Drill -------------------------------------------------------------------------------

function advance() {
  symbol = nextChord(settings, symbol);
  chord = symbol ? parseChord(symbol) : null;
  newChordOnScreen();
}

function newChordOnScreen() {
  capture.cancel();
  currentClasses = {};
  suggestions = null;
  renderChord($('chord'), symbol);
  clearFeedback($('feedback'));
  keyboard.highlight(heldClasses(capture.snapshot()));
}

function analyse(notes) {
  if (!chord) return;
  const analysis = analyzeVoicing(notes, chord);
  renderAnalysis($('feedback'), analysis, chord);
  showAnalysis(analysis, notes);
}

function showAnalysis(analysis, notes) {
  currentClasses = roleClasses(analysis);
  keyboard.highlight(currentClasses);
  lastVoicing = notes;
  suggestions = null;                 // the next suggestion starts from what was just played
}

// ---- Suggestions -------------------------------------------------------------------------

function playSuggestion() {
  if (!chord) return;
  if (!suggestions || suggestions.symbol !== symbol) {
    suggestions = { symbol, list: suggestVoicings(chord, { previous: lastVoicing }), index: 0 };
  }
  const { list } = suggestions;
  if (list.length === 0) {
    renderError($('feedback'), 'No suggestion fits the register for this chord.');
    return;
  }
  const candidate = list[suggestions.index % list.length];
  const sent = output?.playVoicing(candidate.notes) ?? false;
  keyboard.highlight(withSuggestion(currentClasses, candidate.notes));
  renderSuggestion($('feedback'), candidate, chord, { sent, index: suggestions.index % list.length, total: list.length });
  suggestions.index += 1;
}

// ---- Progression -------------------------------------------------------------------------

const timeSignature = () => $('prog-time').value.split('/').map(Number);
const progressionMode = () => document.querySelector('input[name="prog-mode"]:checked').value;
const timedRunning = () => progressionMode() === 'timed' && metronome?.running;

function fillGridFromLibrary() {
  const id = $('prog-library').value;
  if (id === 'custom') return;
  $('prog-grid').value = formatGrid(getProgression(id, $('prog-key').value).bars);
}

function buildSession() {
  try {
    const grid = parseGrid($('prog-grid').value, { timeSignature: timeSignature() });
    session = createSession(grid, { loop: $('prog-loop').checked });
  } catch (error) {
    session = null;
    $('grid-view').replaceChildren();
    renderError($('summary'), error instanceof GridParseError ? error.message : String(error));
    return;
  }
  chorus = 1;
  $('summary').replaceChildren();
  showSlot(session.current);
}

function showSlot(index) {
  shownIndex = index;
  const slot = session.slots[index];
  symbol = slot.symbol;
  chord = slot.chord;
  newChordOnScreen();
  renderGrid($('grid-view'), session, index);
}

function recordAndRender(index, notes) {
  const entry = session.record(index, notes);
  renderAnalysis($('feedback'), entry.analysis, session.slots[index].chord);
  renderComparison($('feedback'), entry.comparison);
  showAnalysis(entry.analysis, notes);
  renderGrid($('grid-view'), session, shownIndex);
}

function chorusDone(label) {
  renderSummary($('summary'), session.summary(), session, { title: label });
  session.newChorus();
}

function onBeat({ bar, beat, countIn }) {
  if (!session) return;
  if (countIn) {
    renderStatus($('status'), `Count-in… ${beat}`, 'ok');
    return;
  }
  const location = session.locate(bar, beat);
  if (!location) {                                  // past the end, no loop
    stopProgression();
    return;
  }
  if (location.chorus > chorus) {
    chorusDone(`Chorus ${chorus}`);
    chorus = location.chorus;
  }
  renderStatus($('status'), `Bar ${((bar - 1) % session.barCount) + 1} · beat ${beat}`, 'ok');
  if (location.index !== shownIndex) showSlot(location.index);
}

function startProgression() {
  buildSession();
  if (!session) return;
  session.reset();
  showSlot(0);
  if (progressionMode() === 'timed') {
    metronome = createMetronome({ tempo: Number($('prog-tempo').value) || 120, timeSignature: timeSignature(), onBeat });
    metronome.start();
  }
  setProgressionControls(true);
}

function stopProgression() {
  metronome?.stop();
  metronome = null;
  if (session) chorusDone(progressionMode() === 'timed' ? `Chorus ${chorus}` : 'Pass');
  setProgressionControls(false);
  showMidiStatus();
}

function setProgressionControls(running) {
  $('prog-start').disabled = running;
  $('prog-stop').disabled = !running;
  for (const id of ['prog-library', 'prog-key', 'prog-time', 'prog-tempo', 'prog-loop', 'prog-grid']) $(id).disabled = running;
  for (const radio of document.querySelectorAll('input[name="prog-mode"]')) radio.disabled = running;
}

// ---- Events from the keyboard -----------------------------------------------------------

function onVoicing(notes, { startedAt }) {
  if (mode === 'drill') return analyse(notes);
  if (!session) return;
  if (timedRunning()) {
    const position = metronome.positionOf(startedAt);
    const location = session.locate(position.bar, position.beat);
    if (location) recordAndRender(location.index, notes);
    return;
  }
  if (!$('prog-start').disabled) return;            // free mode, not started
  recordAndRender(session.current, notes);
}

function onNext() {
  if (mode === 'drill') return advance();
  if (!session || timedRunning() || !$('prog-start').disabled) return;
  const next = session.advance();
  if (next === null) return stopProgression();
  if (next === 0) chorusDone('Pass');
  showSlot(next);
}

// ---- Mode switch, settings, wiring ------------------------------------------------------

function setMode(next) {
  if (mode === 'progression' && $('prog-start').disabled) stopProgression();
  mode = next;
  $('tab-drill').setAttribute('aria-selected', String(mode === 'drill'));
  $('tab-progression').setAttribute('aria-selected', String(mode === 'progression'));
  $('progression-panel').hidden = mode !== 'progression';
  $('next').hidden = mode !== 'drill';
  if (mode === 'drill') advance();
  else buildSession();
}

function selectOutput() {
  if (!output) return;
  output.channel = settings.channel;
  output.select(settings.outputId ?? outputs[0]?.id ?? '');
}

function applySettings(next) {
  settings = next;
  saveSettings(settings);
  capture.debounceMs = settings.debounceMs;
  capture.nextNote = settings.nextNote;
  selectOutput();
  if (mode !== 'drill') return;
  const stillValid = chord && settings.roots.includes(chord.root) && settings.qualities.includes(symbol.slice(chord.root.length));
  if (!stillValid) advance();
}

let midiStatus = { text: 'Requesting MIDI access…', level: '' };
function showMidiStatus() {
  renderStatus($('status'), midiStatus.text, midiStatus.level);
}

document.addEventListener('keydown', event => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName);
  if (typing) return;
  if (event.code === 'Space') {
    event.preventDefault();
    onNext();
  } else if (event.code === 'KeyP') {
    playSuggestion();
  }
});
$('next').addEventListener('click', advance);
$('suggest').addEventListener('click', () => { playSuggestion(); $('suggest').blur(); });
$('tab-drill').addEventListener('click', () => setMode('drill'));
$('tab-progression').addEventListener('click', () => setMode('progression'));
$('prog-library').addEventListener('change', () => { fillGridFromLibrary(); buildSession(); });
$('prog-key').addEventListener('change', () => { fillGridFromLibrary(); buildSession(); });
$('prog-time').addEventListener('change', buildSession);
$('prog-loop').addEventListener('change', buildSession);
$('prog-grid').addEventListener('input', () => { $('prog-library').value = 'custom'; buildSession(); });
$('prog-start').addEventListener('click', startProgression);
$('prog-stop').addEventListener('click', stopProgression);

fillSelect($('prog-library'), { ...Object.fromEntries(Object.entries(PROGRESSIONS).map(([id, p]) => [id, p.name])), custom: 'Custom grid' }, 'ii-V-I');
fillSelect($('prog-key'), Object.fromEntries(ROOTS.map(r => [r, r])), 'C');
fillGridFromLibrary();
const settingsUi = renderSettings($('settings-body'), settings, { symbols: DRILL_SYMBOLS, roots: ROOTS, onChange: applySettings });

connectMidi({
  onNoteOn: (note, velocity) => capture.noteOn(note, velocity),
  onNoteOff: note => capture.noteOff(note),
  onDevices: devices => {
    outputs = devices.outputs;
    settingsUi.setOutputs(outputs, settings.outputId);
    selectOutput();
    const { inputs } = devices;
    midiStatus = inputs.length
      ? { text: `MIDI in: ${inputs.map(i => i.name).join(', ')}`, level: 'ok' }
      : { text: 'No MIDI input found. Check the USB cable and the Yamaha USB-MIDI driver.', level: 'warn' };
    showMidiStatus();
  },
}).then(midi => {
  output = createOutput(midi, { channel: settings.channel });
  selectOutput();
}).catch(error => {
  midiStatus = { text: error.message, level: 'warn' };
  showMidiStatus();
});

setMode('drill');

// Debug hook, for the DevTools console when no keyboard is connected:
// voicingLab.play(60, 64, 67, 71) then voicingLab.release().
window.voicingLab = {
  capture,
  play: (...notes) => notes.forEach(note => capture.noteOn(note, 80)),
  release: () => [...capture.held].forEach(note => capture.noteOff(note)),
  suggest: playSuggestion,
};
