// The only place that ties theory, MIDI and UI together.

import { parseChord } from './theory/chords.js';
import { analyzeVoicing } from './theory/analyzer.js';
import { VoicingCapture } from './midi/capture.js';
import { connectMidi } from './midi/input.js';
import { DRILL_SYMBOLS, ROOTS, nextChord, loadSettings, saveSettings } from './ui/drill.js';
import { createKeyboard } from './ui/keyboard.js';
import { renderChord, renderStatus, renderAnalysis, clearFeedback, renderSettings, roleClasses, heldClasses } from './ui/render.js';

const $ = id => document.getElementById(id);

let settings = loadSettings();
let symbol = null;
let chord = null;

const keyboard = createKeyboard($('keyboard'));
const capture = new VoicingCapture({
  debounceMs: settings.debounceMs,
  nextNote: settings.nextNote,
  onVoicing: analyse,
  onNext: advance,
  onChange: held => keyboard.highlight(heldClasses(held)),
});

function advance() {
  symbol = nextChord(settings, symbol);
  chord = symbol ? parseChord(symbol) : null;
  capture.cancel();
  renderChord($('chord'), symbol);
  clearFeedback($('feedback'));
  keyboard.highlight(heldClasses(capture.snapshot()));
}

function analyse(notes) {
  if (!chord) return;
  const analysis = analyzeVoicing(notes, chord);
  renderAnalysis($('feedback'), analysis, chord);
  keyboard.highlight(roleClasses(analysis));
}

function applySettings(next) {
  settings = next;
  saveSettings(settings);
  capture.debounceMs = settings.debounceMs;
  capture.nextNote = settings.nextNote;
  const stillValid = chord && settings.roots.includes(chord.root) && settings.qualities.includes(symbol.slice(chord.root.length));
  if (!stillValid) advance();
}

document.addEventListener('keydown', event => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName);
  if (event.code === 'Space' && !typing) {
    event.preventDefault();
    advance();
  }
});
$('next').addEventListener('click', advance);

renderSettings($('settings-body'), settings, { symbols: DRILL_SYMBOLS, roots: ROOTS, onChange: applySettings });

connectMidi({
  onNoteOn: (note, velocity) => capture.noteOn(note, velocity),
  onNoteOff: note => capture.noteOff(note),
  onDevices: ({ inputs }) => {
    if (inputs.length) renderStatus($('status'), `MIDI in: ${inputs.map(i => i.name).join(', ')}`, 'ok');
    else renderStatus($('status'), 'No MIDI input found. Check the USB cable and the Yamaha USB-MIDI driver.', 'warn');
  },
}).catch(error => renderStatus($('status'), error.message, 'warn'));

advance();

// Debug hook, for the DevTools console when no keyboard is connected:
// voicingLab.play(60, 64, 67, 71) then voicingLab.release().
window.voicingLab = {
  capture,
  play: (...notes) => notes.forEach(note => capture.noteOn(note, 80)),
  release: () => [...capture.held].forEach(note => capture.noteOff(note)),
};
