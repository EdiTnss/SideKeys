# SideKeys — brand brief

Paste this into claude.ai/design. It is in English, unlike the rest of `docs/`, because the
assets it produces carry English text and land in an English repository.

**See the thing itself first: <https://editnss.github.io/SideKeys/>** — click four keys on the
drawn keyboard and press Enter. That is the whole product in ten seconds.

This is a blank page. There is no brand yet: no logo, no favicon, no social image, and the
interface uses the browser's own `system-ui` font. An earlier kit existed for the project's
previous name and is being thrown away, so nothing has to be honoured or matched.

## The product

SideKeys listens to what a jazz pianist plays on a MIDI keyboard and answers in under 100 ms:
which voicing it was, which chord tones are missing, which notes are wrong, where the left hand
is too low to sound clear, how smoothly it moved from the chord before. Everything in that
answer is computed, not guessed.

Positioned as **the teacher who sits next to you and tells you what your hands got wrong** — not
a chord library, not a lesson course. The user is an advanced-ish jazz pianist with a keyboard
next to a computer, practising for hours.

## The name, and the tone it sets

**SideKeys** = *sidekick* + *keys*: a partner at the keys, not an examiner. Chosen 2026-09-20,
after the previous name collided with an active company selling a paid product to the same
pianists.

The interface is meant to be **warm and lightly gamified**: a small joke when you fumble a
voicing, real encouragement when you nail one. Lightly — the same product later carries a comping
report, a teacher plan and subscriptions, so the brand has to survive on an invoice.

**No mascot.** That is a decision, not an oversight: the personality lives in the writing and the
interface, not in a character.

## What the interface looks like today

Worth knowing, because the brand has to sit inside it rather than on top of it. The page is
deliberately plain: a header, a very large chord symbol, a drawn piano keyboard across the full
width, and a verdict panel underneath. It follows the operating system's light or dark setting.
The only colour in it is functional — see the constraint below.

## Hard constraints

1. **The interface colours are semantic, not decorative.** They encode music theory and appear on
   the drawn keyboard and in the verdict text on every screen:

   | token | hex | meaning |
   |---|---|---|
   | `--chord-tone` | `#2e9e5b` | a note that belongs to the chord |
   | `--tension` | `#3b82f6` | an available tension |
   | `--altered` | `#8b5cf6` | an altered tension |
   | `--avoid` | `#f59e0b` | an avoid note |
   | `--wrong` | `#ef4444` | a note outside the chord |
   | `--held` | `#9ca3af` | a key being held right now |
   | `--armed` | `#60a5fa` | a key clicked but not played yet |

   A brand accent must not be confusable with any of them — a user has to read "that key is a
   chord tone" instantly, without wondering whether the green is the logo's green. Green, blue,
   amber, violet and red are all taken meanings. That is a real limit, and it is also the most
   interesting thing about this brief: the palette has to find room beside them.

   These hexes are not sacred either. If the brand wants one of those hues, propose the
   replacement for the theory colour in the same breath — but it must stay a seven-way
   distinction that reads at a glance, including for the common forms of colour blindness, since
   the whole product is a person reading colour-coded verdicts at speed.

2. **Dark and light, both real.** The page declares `color-scheme: light dark` and follows the
   operating system. Every asset needs a variant that works on each.

3. **16px has to work.** The favicon is the first thing anyone sees, in a browser tab.

4. **The neighbours to not resemble**: VoicingLab, JazzPianoLab, Chordify, Chordana, ChordU,
   PracticeBird. In practice that rules out laboratory flasks, generic chord grids and anything
   that reads as a chord-lookup app.

5. **The wordmark must survive without its webfont.** The app loads no fonts today and has zero
   dependencies; if a webfont is introduced it has to be worth the request, and the lockup has to
   stay recognisable when it fails to load and `system-ui` stands in. Offline use is on the
   roadmap, so a self-hosted font is likelier than a CDN one.

## Deliverables

| file | spec | used by |
|---|---|---|
| `favicon.svg` | square artboard, legible at 16px | browser tab, PWA icon |
| `mark.svg` | mark on dark | app header |
| `mark-light-bg.svg` | mark on light | app header, light mode |
| `mark-mono.svg` | single colour, inherits `currentColor` | anywhere one-colour |
| `logo-lockup.png` | horizontal, dark background, 4× | README header |
| `logo-lockup-light.png` | horizontal, light background, 4× | README header, light |
| `og-image.png` | exactly 1200×630 | link previews |
| palette + type spec | tokens with hexes for both schemes, font, weights, tracking | the interface itself |

The lockup in the app should be **live text plus the SVG mark**, not a picture of text, so the
wordmark spec matters as much as the images: font, weight, tracking, and which part of "SideKeys"
takes an accent if any does.

One optional thought, offered and not imposed: the name says *keys at your side*. A mark that
accents one key off to the side would say the name without spelling it.

## What happens to the output

The files go in `assets/`, and then into the page: favicon link, Open Graph and Twitter tags, the
header lockup, any webfont, and the README header. The OG URL will be
`https://editnss.github.io/SideKeys/assets/og-image.png`.

Nothing in `src/theory/` is touched by any of this — the music theory has no opinion about colour.
