// The only place that ties theory, MIDI, audio and UI together. Two modes: the drill
// (random chords) and the progression (a grid, free or timed by the metronome).

import { parseChord } from './theory/chords.js';
import { analyzeVoicing } from './theory/analyzer.js';
import { PROGRESSIONS, getProgression, parseGrid, formatGrid, GridParseError } from './theory/progressions.js';
import { suggestVoicings } from './theory/voicings.js';
import { createPiece, addMelody, structuralMelody, toJSON, fromJSON, savePiece, loadPiece, listPieces, deletePiece } from './theory/piece.js';
import { VoicingCapture } from './midi/capture.js';
import { connectMidi } from './midi/input.js';
import { createVirtualMidi } from './midi/virtual.js';
import { createOutput } from './midi/output.js';
import { createRecorder } from './midi/recorder.js';
import { createMetronome } from './audio/metronome.js';
import { DRILL_SYMBOLS, ROOTS, nextChord, loadSettings, saveSettings } from './ui/drill.js';
import { createSession, snapshotTarget } from './ui/session.js';
import { createTape, keepMidi, verdictOf, formatSession } from './ui/tape.js';
import { createKeyboard } from './ui/keyboard.js';
import { emptyStats, recordAttempt, weakSpots, summaryLine, loadStats, saveStats } from './ui/stats.js';
import { createClient, AiError } from './ai/client.js';
import { explainVoicing } from './ai/explain.js';
import { reharmonize } from './ai/pipeline.js';
import { STYLES } from './theory/candidates.js';
import { realize, BASS_REGISTERS } from './theory/realize.js';
import { arrangementMessages } from './midi/player.js';
import {
  renderChord, renderStatus, renderAnalysis, renderComparison, clearFeedback, renderSettings,
  roleClasses, heldClasses, renderGrid, renderSummary, renderError, fillSelect, renderSuggestion, withSuggestion, renderMelody,
  renderStats, useStatsSummary, renderAiStatus, renderAiSuggestions, renderReharm,
} from './ui/render.js';

const $ = id => document.getElementById(id);

let settings = loadSettings();
// Running locally, the proxy is the Worker from worker/ on its usual port, so fill it in once
// instead of making every browser profile paste it. On the published site the field stays empty.
if (!settings.proxyUrl && ['localhost', '127.0.0.1'].includes(location.hostname)) {
  settings = { ...settings, proxyUrl: 'http://127.0.0.1:8787/' };
  saveSettings(settings);
}
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
let lastAnalysis = null;            // drill: the analysis of the last chord played, sent to Claude with Ask
let ai = createClient({ baseUrl: settings.proxyUrl });
let aiResult = null;                // { symbol, suggestions, rejected, model }: Claude's last answer, for keys 1/2
let asking = false;
let piece = null;                   // the piece on screen (grid + recorded melody)
let reharmResult = null;            // the last reharmonization, for the A/B buttons
let playback = null;                // { which, bars, voicings } while an arrangement plays
let recorder = null;                // active while a melody pass is being recorded
const heldWhileRecording = new Set();
let sessionStats = emptyStats();    // this session only
let allStats = loadStats();         // every session, persisted
useStatsSummary(summaryLine);

// The last hour of playing and of what the app answered, for "Save session" and the harness.
const tape = createTape({ settings: { debounceMs: settings.debounceMs, nextNote: settings.nextNote } });
// ?midi=virtual: no hardware and no Web MIDI permission needed; voicingLab.midi drives it.
const virtualMidi = new URLSearchParams(location.search).get('midi') === 'virtual'
  ? createVirtualMidi({ inputs: ['Virtual keyboard'], outputs: ['Virtual output'] })
  : null;

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

// A new chord drops the snapshot still waiting for the old one, except when the metronome moves
// the slot: in a timed pass the voicing belongs to where it started (or, pushed from the "and"
// of the beat before, to the next chord), so a chord held across the bar line must survive.
function newChordOnScreen({ keepCapture = false } = {}) {
  if (!keepCapture) capture.cancel();
  tape.event('chord', { symbol, slot: mode === 'progression' ? shownIndex : null, ...(keepCapture ? { cancels: false } : {}) });
  currentClasses = {};
  suggestions = null;
  lastAnalysis = null;
  aiResult = null;
  renderChord($('chord'), symbol);
  clearFeedback($('feedback'));
  keyboard.highlight(heldClasses(capture.snapshot()));
}

function analyse(notes) {
  if (!chord) return null;
  const analysis = analyzeVoicing(notes, chord);
  renderAnalysis($('feedback'), analysis, chord);
  showAnalysis(analysis, notes);
  lastAnalysis = analysis;
  // Claude's answer stays on screen for the same chord, so a played suggestion can be compared with its label.
  if (aiResult?.symbol === symbol) renderAiSuggestions($('feedback'), aiResult, chord, { onPlay: playAiSuggestion });
  return analysis;
}

function showAnalysis(analysis, notes) {
  currentClasses = roleClasses(analysis);
  keyboard.highlight(currentClasses);
  lastVoicing = notes;
  suggestions = null;                 // the next suggestion starts from what was just played
  trackAttempt(analysis);
}

// ---- Statistics --------------------------------------------------------------------------

function trackAttempt(analysis) {
  const attempt = { key: symbol.slice(chord.root.length), chord, analysis };
  sessionStats = recordAttempt(sessionStats, attempt);
  allStats = recordAttempt(allStats, attempt);
  saveStats(allStats);
  showStats();
}

function showStats() {
  renderStats($('stats'), sessionStats, { spots: weakSpots(sessionStats) });
  settingsUi?.setCumulative(allStats, weakSpots(allStats));
}

function resetStats() {
  allStats = emptyStats();
  sessionStats = emptyStats();
  saveStats(allStats);
  showStats();
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

// ---- Ask Claude --------------------------------------------------------------------------

async function askClaude() {
  if (!chord || asking) return;
  if (!settings.proxyUrl) {
    renderAiStatus($('feedback'), 'Set the AI proxy URL in Settings first (the Worker from worker/).', 'warn');
    return;
  }
  const asked = symbol;
  asking = true;
  $('ask').disabled = true;
  renderAiStatus($('feedback'), 'Asking Claude…');
  try {
    const result = await explainVoicing(ai, chord, lastAnalysis);
    if (symbol !== asked) return;                     // the chord changed while waiting
    aiResult = { symbol, ...result };
    renderAiSuggestions($('feedback'), aiResult, chord, { onPlay: playAiSuggestion });
  } catch (error) {
    if (symbol !== asked) return;
    renderAiStatus($('feedback'), `Claude: ${error instanceof AiError ? error.message : error?.message ?? error}`, 'warn');
    console.error(error);
  } finally {
    asking = false;
    $('ask').disabled = false;
  }
}

function playAiSuggestion(suggestion) {
  output?.playVoicing(suggestion.notes);
  keyboard.highlight(withSuggestion(currentClasses, suggestion.notes));
}

function playAiByIndex(index) {
  const suggestion = aiResult?.symbol === symbol ? aiResult.suggestions[index] : null;
  if (suggestion) playAiSuggestion(suggestion);
}

// ---- Reharmonize a piece ------------------------------------------------------------------

// The piece with the recorded melody when there is one, otherwise the bare grid on screen.
function reharmPiece() {
  if (piece) return piece;
  try {
    return createPiece({ title: pieceTitle(), key: $('prog-key').value, timeSignature: timeSignature(), tempo: Number($('prog-tempo').value) || 120, grid: $('prog-grid').value });
  } catch {
    return null;
  }
}

// What the status line says while each call is out, with the seconds so far. A long piece goes
// in parts: its execute calls name their bars, and its reviews go out together.
const REHARM_STEPS = {
  plan: () => 'Claude is planning the phrases…',
  execute: info => (info
    ? `Claude is choosing the chords, bars ${info.bars[0]}–${info.bars[1]} (part ${info.part} of ${info.parts})…`
    : 'Claude is choosing the chords…'),
  review: info => (info ? `Claude is reviewing the draft, ${info.parts} parts at once…` : 'Claude is reviewing the draft…'),
};

function showPlanReview() {
  $('reharm-plan-review').checked = settings.planReview;
}

function changePlanReview() {
  settings = { ...settings, planReview: $('reharm-plan-review').checked };
  saveSettings(settings);
}

function showReharmSource() {
  const target = reharmPiece();
  if (!target) {
    $('reharm-source').textContent = 'The grid in the Progression tab does not parse yet.';
    return;
  }
  const targets = structuralMelody(target).length;
  $('reharm-source').textContent = targets
    ? `${target.title}: ${target.bars.length} bars, ${targets} target notes. The melody stays, the chords change.`
    : `${target.title}: ${target.bars.length} bars, no melody recorded. Every chord fits an empty bar, so record a melody in the Progression tab for a result worth playing.`;
}

async function runReharm() {
  const target = reharmPiece();
  if (!target) return;
  if (!settings.proxyUrl) {
    renderError($('reharm-view'), 'Set the AI proxy URL in Settings first (the Worker from worker/).');
    return;
  }
  $('reharm-run').disabled = true;
  $('reharm-view').replaceChildren();
  const started = performance.now();
  let timer = null;
  const onStep = (step, info) => {
    clearInterval(timer);
    const label = REHARM_STEPS[step](info);
    const show = () => renderAiStatus($('reharm-view'), `${label} ${Math.round((performance.now() - started) / 1000)} s`);
    show();
    timer = setInterval(show, 1000);
  };
  try {
    reharmResult = await reharmonize(ai, target, {
      style: $('reharm-style').value,
      intensity: $('reharm-intensity').value,
      plan: settings.planReview,
      review: settings.planReview,
      onStep,
    });
    renderReharm($('reharm-view'), reharmResult, { onUse: useGrid });
    $('play-reharm').disabled = Boolean(playback);
  } catch (error) {
    reharmResult = null;
    $('play-reharm').disabled = true;
    renderError($('reharm-view'), `Claude: ${error instanceof AiError ? error.message : error?.message ?? error}`);
    console.error(error);
  } finally {
    clearInterval(timer);            // runs straight after the result is drawn, before any tick
    $('reharm-run').disabled = false;
  }
}

function useGrid(which) {
  if (!reharmResult) return;
  $('prog-library').value = 'custom';
  $('prog-grid').value = which === 'reharm' ? reharmResult.grid : reharmResult.originalGrid;
  setMode('progression');
}

// ---- Play an arrangement on the Genos ---------------------------------------------------------

// Bass, left hand and melody from realize.js, sent as timed MIDI on the metronome's grid, with a
// bar of count-in. The keyboard shows the left-hand voicing of the chord that is sounding.
function playArrangement(which) {
  const source = which === 'reharm' ? reharmResult?.reharmonized : reharmPiece();
  if (!source) return;
  if (!output?.port) {
    renderStatus($('status'), 'No MIDI output selected: choose the Genos in Settings, MIDI out.', 'warn');
    return;
  }
  stopArrangement();
  const tempo = Number($('prog-tempo').value) || source.tempo || 120;
  const { events, voicings } = realize(source, { bassRegister: BASS_REGISTERS[settings.bassRegister] });
  metronome = createMetronome({ tempo, timeSignature: source.timeSignature, onBeat: onPlaybackBeat });
  metronome.start();
  const startMs = metronome.performanceTimeOf(1, 1);
  output.sendScheduled(arrangementMessages(events, { tempo, startMs, channels: settings.channels, parts: settings.parts }));
  playback = { which, bars: source.bars.length, voicings };
  setPlaybackControls(true);
}

function onPlaybackBeat({ bar, beat, countIn }) {
  if (!playback) return;
  if (countIn) {
    renderStatus($('status'), `Count-in… ${beat}`, 'ok');
    return;
  }
  if (bar > playback.bars) {
    stopArrangement();
    return;
  }
  renderStatus($('status'), `Playing the ${playback.which}: bar ${bar} · beat ${beat}`, 'ok');
  const sounding = playback.voicings.filter(v => v.bar < bar || (v.bar === bar && v.beat <= beat)).at(-1);
  keyboard.highlight(sounding?.notes && settings.parts.lh ? heldClasses(sounding.notes) : {});
}

function stopArrangement() {
  if (!playback) return;
  playback = null;
  metronome?.stop();
  metronome = null;
  output?.silence(Object.values(settings.channels));
  keyboard.highlight({});
  setPlaybackControls(false);
  showMidiStatus();
}

function setPlaybackControls(playing) {
  $('play-original').disabled = playing;
  $('play-reharm').disabled = playing || !reharmResult;
  $('play-stop').disabled = !playing;
}

function showParts() {
  for (const box of document.querySelectorAll('input[name="part"]')) box.checked = settings.parts[box.value] !== false;
}

function changeParts() {
  const parts = Object.fromEntries([...document.querySelectorAll('input[name="part"]')].map(box => [box.value, box.checked]));
  settings = { ...settings, parts };
  saveSettings(settings);
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

function buildSession({ loop = $('prog-loop').checked } = {}) {
  try {
    const grid = parseGrid($('prog-grid').value, { timeSignature: timeSignature() });
    session = createSession(grid, { loop });
    tape.event('progression', { grid: $('prog-grid').value, timeSignature: timeSignature(), loop });
  } catch (error) {
    session = null;
    tape.event('progression', { grid: null });
    $('grid-view').replaceChildren();
    renderError($('summary'), error instanceof GridParseError ? error.message : String(error));
    return;
  }
  chorus = 1;
  $('summary').replaceChildren();
  showSlot(session.current);
}

function showSlot(index, { keepCapture = false } = {}) {
  shownIndex = index;
  const slot = session.slots[index];
  symbol = slot.symbol;
  chord = slot.chord;
  newChordOnScreen({ keepCapture });
  renderGrid($('grid-view'), session, index);
}

function recordAndRender(index, notes) {
  const entry = session.record(index, notes);
  renderAnalysis($('feedback'), entry.analysis, session.slots[index].chord);
  renderComparison($('feedback'), entry.comparison);
  showAnalysis(entry.analysis, notes);
  renderGrid($('grid-view'), session, shownIndex);
  return entry.analysis;
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
  if (location.index !== shownIndex) showSlot(location.index, { keepCapture: true });
}

function startProgression() {
  buildSession();
  if (!session) return;
  session.reset();
  showSlot(0);
  if (progressionMode() === 'timed') {
    metronome = createMetronome({ tempo: Number($('prog-tempo').value) || 120, timeSignature: timeSignature(), onBeat });
    metronome.start();
    tape.event('start', { timed: true, tempo: metronome.tempo, bar1At: tape.at(metronome.performanceTimeOf(1, 1)) });
  } else {
    tape.event('start', { timed: false });
  }
  setProgressionControls(true);
}

function stopProgression() {
  tape.event('stop');
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
  $('rec-start').disabled = running;
}

// ---- Recording a melody, saving and loading pieces --------------------------------------

function pieceTitle() {
  const id = $('prog-library').value;
  return id === 'custom' ? 'Custom grid' : `${PROGRESSIONS[id].name} in ${$('prog-key').value}`;
}

function startRecording() {
  buildSession({ loop: false });
  if (!session) return;
  session.reset();
  chorus = 1;
  showSlot(0);
  metronome = createMetronome({ tempo: Number($('prog-tempo').value) || 120, timeSignature: timeSignature(), onBeat: onRecordingBeat });
  recorder = createRecorder({ positionOf: metronome.positionOf, timeSignature: timeSignature() });
  heldWhileRecording.clear();
  tape.event('recorder', { on: true });
  recorder.start();
  metronome.start();
  setProgressionControls(true);
  $('rec-start').disabled = true;
  $('rec-stop').disabled = false;
  document.body.classList.add('recording');
}

function onRecordingBeat({ bar, beat, countIn }) {
  if (!recorder) return;
  if (countIn) {
    renderStatus($('status'), `Recording: count-in… ${beat}`, 'warn');
    return;
  }
  const location = session.locate(bar, beat);
  if (!location) {
    stopRecording();
    return;
  }
  renderStatus($('status'), `Recording: bar ${bar} · beat ${beat}`, 'warn');
  if (location.index !== shownIndex) showSlot(location.index);
}

function stopRecording() {
  if (!recorder) return;
  const raw = recorder.stop(performance.now());
  recorder = null;
  tape.event('recorder', { on: false });
  metronome?.stop();
  metronome = null;
  document.body.classList.remove('recording');
  setProgressionControls(false);
  $('rec-stop').disabled = true;
  showMidiStatus();
  const base = createPiece({ title: pieceTitle(), key: $('prog-key').value, timeSignature: timeSignature(), tempo: Number($('prog-tempo').value) || 120, grid: $('prog-grid').value });
  showPiece(addMelody(base, raw));
  buildSession();
}

function showPiece(next) {
  piece = next;
  renderMelody($('melody-view'), piece);
  $('piece-save').disabled = !piece;
  $('piece-export').disabled = !piece;
  showReharmSource();
}

function refreshPieceList() {
  const titles = listPieces();
  fillSelect($('piece-list'), titles.length ? Object.fromEntries(titles.map(t => [t, t])) : { '': 'no saved pieces' });
  $('piece-load').disabled = titles.length === 0;
  $('piece-delete').disabled = titles.length === 0;
}

function loadIntoControls(loaded) {
  $('prog-library').value = 'custom';
  $('prog-key').value = loaded.key;
  $('prog-time').value = loaded.timeSignature.join('/');
  $('prog-tempo').value = loaded.tempo;
  $('prog-grid').value = formatGrid(loaded.bars);
  buildSession();
  showPiece(loaded);
}

function savePieceAs() {
  if (!piece) return;
  const title = window.prompt('Piece title', piece.title);
  if (!title) return;
  piece = { ...piece, title };
  if (!savePiece(piece)) renderError($('summary'), 'Could not save: local storage is unavailable.');
  refreshPieceList();
  $('piece-list').value = title;
  renderMelody($('melody-view'), piece);
}

function exportPiece() {
  if (!piece) return;
  const blob = new Blob([toJSON(piece)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: `${piece.title.replace(/[^\w-]+/g, '_')}.json` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The last hour of playing, as a JSON file the harness replays (harness/replay.js).
function saveSession() {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const blob = new Blob([formatSession(tape.toJSON())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: `voicing-lab-session-${stamp}.json` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importPiece(file) {
  if (!file) return;
  try {
    loadIntoControls(fromJSON(await file.text()));
  } catch (error) {
    renderError($('summary'), `Import failed: ${error.message}`);
  }
}

// ---- Events from the keyboard -----------------------------------------------------------

// Which chord the voicing answers is snapshotTarget's decision, shared with the harness's replay;
// every snapshot goes on the tape with that chord and its verdict.
function onVoicing(notes, { startedAt }) {
  const timed = mode === 'progression' && Boolean(timedRunning());
  const position = timed ? metronome.positionOf(startedAt) : null;
  const target = snapshotTarget({ mode, symbol, session, started: $('prog-start').disabled, timed, position, current: session?.current ?? 0 });
  const analysis = !target ? null : mode === 'drill' ? analyse(notes) : recordAndRender(target.slot, notes);
  tape.event('snapshot', {
    startedAt: tape.at(startedAt ?? performance.now()),
    notes,
    target,
    ...(position ? { position } : {}),
    verdict: analysis ? verdictOf(analysis) : null,
  });
}

function onMidiNoteOn(note, velocity) {
  if (recorder) {
    recorder.noteOn(note, velocity, performance.now());
    heldWhileRecording.add(note);
    keyboard.highlight(heldClasses([...heldWhileRecording]));
    return;
  }
  capture.noteOn(note, velocity);
}

function onMidiNoteOff(note) {
  if (recorder) {
    recorder.noteOff(note, performance.now());
    heldWhileRecording.delete(note);
    keyboard.highlight(heldClasses([...heldWhileRecording]));
    return;
  }
  capture.noteOff(note);
}

function onNext() {
  if (mode === 'drill') return advance();
  if (!session || recorder || timedRunning() || !$('prog-start').disabled) return;
  const next = session.advance();
  if (next === null) return stopProgression();
  if (next === 0) chorusDone('Pass');
  showSlot(next);
}

// ---- Mode switch, settings, wiring ------------------------------------------------------

function setMode(next) {
  if (playback) stopArrangement();
  if (recorder) stopRecording();
  if (mode === 'progression' && $('prog-start').disabled) stopProgression();
  mode = next;
  tape.event('mode', { mode });
  for (const tab of ['drill', 'progression', 'reharm']) $(`tab-${tab}`).setAttribute('aria-selected', String(mode === tab));
  $('progression-panel').hidden = mode !== 'progression';
  $('reharm-panel').hidden = mode !== 'reharm';
  $('drill-panel').hidden = mode === 'reharm';
  $('next').hidden = mode !== 'drill';
  $('ask').hidden = mode !== 'drill';
  if (mode === 'drill') advance();
  else if (mode === 'progression') buildSession();
  else showReharmSource();
}

function selectOutput() {
  if (!output) return;
  output.channel = settings.channel;
  const chosen = output.select(settings.outputId ?? outputs[0]?.id ?? '');
  // The saved port is a real one (the Genos): on the virtual access, take the virtual output.
  if (!chosen && virtualMidi) output.select(outputs[0]?.id ?? '');
}

function applySettings(next) {
  settings = { ...settings, ...next };      // the parts toggles live in the Reharm tab, not in this form
  saveSettings(settings);
  if (capture.debounceMs !== settings.debounceMs || capture.nextNote !== settings.nextNote) {
    tape.event('settings', { debounceMs: settings.debounceMs, nextNote: settings.nextNote });
  }
  capture.debounceMs = settings.debounceMs;
  capture.nextNote = settings.nextNote;
  selectOutput();
  if (ai.baseUrl !== settings.proxyUrl) ai = createClient({ baseUrl: settings.proxyUrl });
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
  } else if (event.code === 'KeyP' && !recorder) {
    playSuggestion();
  } else if (event.code === 'KeyA' && mode === 'drill' && !recorder) {
    askClaude();
  } else if ((event.code === 'Digit1' || event.code === 'Digit2') && mode === 'drill') {
    playAiByIndex(event.code === 'Digit1' ? 0 : 1);
  }
});
$('rec-start').addEventListener('click', startRecording);
$('rec-stop').addEventListener('click', stopRecording);
$('piece-save').addEventListener('click', savePieceAs);
$('piece-load').addEventListener('click', () => { const loaded = loadPiece($('piece-list').value); if (loaded) loadIntoControls(loaded); });
$('piece-delete').addEventListener('click', () => { deletePiece($('piece-list').value); refreshPieceList(); });
$('piece-export').addEventListener('click', exportPiece);
$('save-session').addEventListener('click', () => { saveSession(); $('save-session').blur(); });
$('piece-import').addEventListener('change', event => { importPiece(event.target.files[0]); event.target.value = ''; });
$('next').addEventListener('click', advance);
$('suggest').addEventListener('click', () => { playSuggestion(); $('suggest').blur(); });
$('ask').addEventListener('click', () => { askClaude(); $('ask').blur(); });
$('tab-drill').addEventListener('click', () => setMode('drill'));
$('tab-progression').addEventListener('click', () => setMode('progression'));
$('tab-reharm').addEventListener('click', () => setMode('reharm'));
$('reharm-run').addEventListener('click', () => { runReharm(); $('reharm-run').blur(); });
$('play-original').addEventListener('click', () => { playArrangement('original'); $('play-original').blur(); });
$('play-reharm').addEventListener('click', () => { playArrangement('reharm'); $('play-reharm').blur(); });
$('play-stop').addEventListener('click', () => { stopArrangement(); $('play-stop').blur(); });
for (const box of document.querySelectorAll('input[name="part"]')) box.addEventListener('change', changeParts);
$('reharm-plan-review').addEventListener('change', changePlanReview);
$('prog-library').addEventListener('change', () => { fillGridFromLibrary(); buildSession(); });
$('prog-key').addEventListener('change', () => { fillGridFromLibrary(); buildSession(); });
$('prog-time').addEventListener('change', buildSession);
$('prog-loop').addEventListener('change', buildSession);
$('prog-grid').addEventListener('input', () => { $('prog-library').value = 'custom'; buildSession(); });
$('prog-start').addEventListener('click', startProgression);
$('prog-stop').addEventListener('click', stopProgression);

fillSelect($('prog-library'), { ...Object.fromEntries(Object.entries(PROGRESSIONS).map(([id, p]) => [id, p.name])), custom: 'Custom grid' }, 'ii-V-I');
fillSelect($('prog-key'), Object.fromEntries(ROOTS.map(r => [r, r])), 'C');
fillSelect($('reharm-style'), Object.fromEntries(Object.keys(STYLES).map(id => [id, id.replace(/-/g, ' ')])), 'tritone');
fillSelect($('reharm-intensity'), { light: 'light', medium: 'medium', heavy: 'heavy' }, 'medium');
showParts();
showPlanReview();
fillGridFromLibrary();
refreshPieceList();
const settingsUi = renderSettings($('settings-body'), settings, { symbols: DRILL_SYMBOLS, roots: ROOTS, onChange: applySettings, onResetStats: resetStats });
showStats();

connectMidi({
  access: virtualMidi?.access,
  onNoteOn: onMidiNoteOn,
  onNoteOff: onMidiNoteOff,
  onMessage: data => { if (keepMidi(data)) tape.midi(data); },
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
// voicingLab.play(60, 64, 67, 71) then voicingLab.release(). These skip the MIDI input, so they
// never reach the tape; with ?midi=virtual, voicingLab.midi.send([0x90, 60, 80]) goes the whole
// way, and voicingLab.midi.sent holds what the app sent out.
window.voicingLab = {
  capture,
  play: (...notes) => notes.forEach(note => onMidiNoteOn(note, 80)),
  release: () => [...capture.held, ...heldWhileRecording].forEach(note => onMidiNoteOff(note)),
  suggest: playSuggestion,
  ask: askClaude,
  reharm: runReharm,
  playArrangement,
  stopArrangement,
  midi: virtualMidi,
  tape,
  saveSession,
};
