# Voicing Lab

[![tests](https://github.com/EdiTnss/Voicing-Lab/actions/workflows/test.yml/badge.svg)](https://github.com/EdiTnss/Voicing-Lab/actions/workflows/test.yml)

A voicing and reharmonization trainer for jazz pianists. Connect a MIDI keyboard, play the chord the app asks for, and get instant feedback on what you played: voicing type, tensions, avoid notes and voice leading. Later phases add Claude-powered reharmonization that keeps the melody fixed.

**Status:** work in progress. Phase 1 (the drill) is being played in.

## Run it

On Windows, double-click `start.cmd`: it starts the page server and the AI proxy, then opens the
app in Chrome. Closing the two console windows stops them. Anywhere else, or by hand:

```bash
npx serve .
```

Open http://localhost:3000 in Chrome or Edge (Web MIDI) with your keyboard connected.
`midi-test.html` is a diagnostic page for MIDI in and out. The Claude features also need the
proxy running, see [worker/README.md](worker/README.md).

## Tests

```bash
npm test
```

Node 22+, no dependencies: the music theory lives in `src/theory/` as pure modules and runs under `node --test`.
