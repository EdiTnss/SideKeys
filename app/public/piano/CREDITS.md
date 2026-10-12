# Piano samples

The recordings in this folder are from the **Salamander Grand Piano V3** by **Alexander Holm** — a
Yamaha C5 recorded with two AKG C414 microphones in an AB pair about 12 cm above the strings, at
48 kHz / 24-bit with 16 velocity layers.

**Licence: [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)**, which permits commercial
use and redistribution as long as the author is credited, the licence is named, and changes are
indicated. The credit is also shown in the app itself, on the Today screen.

Source: <https://archive.org/details/SalamanderGrandPianoV3> (the Ogg Vorbis distribution).

## What was changed

- **One velocity layer kept of sixteen** (`v9`), because the player scales a single recording by
  velocity rather than crossfading layers.
- **Seventeen notes kept** of the full set: C2, D#2, F#2, A2 … C6 — the range of the on-screen
  keyboard. The original samples every three semitones, so nothing is shifted by more than a tone;
  anything played outside the range uses the nearest recording, shifted.
- **Renamed**: `D#2v9.ogg` → `ds2.ogg`. A `#` in a filename begins the fragment part of a URL, so
  the sharps could not survive as they were.
- Nothing else: the audio itself is untouched — not trimmed, re-encoded, normalised or filtered.

## A note on the licence

A blog post claims the library entered the public domain on 2022-03-04, which would remove the
attribution requirement. It could not be verified: the post's own "about" page is gone, so there
is no way to establish that it is the author's, and every authoritative listing — the Internet
Archive item and the SFZ Instruments catalogue — still states CC BY 3.0. The library is therefore
treated as CC BY 3.0 here, which is correct either way: crediting work that turns out to be
public domain costs nothing, while the reverse is a licence breach.
