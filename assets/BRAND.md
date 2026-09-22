# SideKeys — brand assets

Replaces the previous Voicing Lab kit entirely. Nothing from it carries over.

## Files
| file | use |
|---|---|
| `favicon.svg` | 64×64 mark on a rounded dark tile, browser tab / PWA icon |
| `mark.svg` | mark on dark backgrounds |
| `mark-light-bg.svg` | mark on light backgrounds |
| `mark-mono.svg` | single-colour, inherits `currentColor` |
| `logo-lockup.png` | horizontal lockup, dark background (1200×480, 4×) |
| `logo-lockup-light.png` | horizontal lockup, light background (1200×480, 4×) |
| `og-image.png` | social preview, 1200×630 |

## The mark
Four bars. Three upright and equal, the fourth stepped down to the side and filled with the
accent — keys at your side, without spelling the name. Rectangles only, so it survives 16px:
at that size the offset bar is still a visibly separate shape.

Geometry (64×64 artboard): three bars `7×32` at `x=14,24,34`, `y=16`; the accent bar `7×32` at
`x=45`, `y=22`. Corner radius 2. Never recolour the three neutral bars, never tint the accent bar
with a theory colour.

## Colours

### Brand
| token | dark | light |
|---|---|---|
| accent | `#E0489E` | `#C41E7F` |

Magenta was chosen because no theory token claims it and it carries no blue, so it stays apart
from `--altered`. It appears only as brand furniture — lockup, active tab, links, focus rings.
**It never appears on a key and never in verdict text.**

### Neutrals
| token | dark | light |
|---|---|---|
| background | `#0a0b0c` | `#FBFAF7` |
| surface | `#101214` | `#FFFFFF` |
| border | `#23272B` | `#E6E2DA` |
| ink | `#F4F2EE` | `#14171A` |
| muted | `#8C949B` | `#5C646B` |

Slightly warm on both sides, so the theory colours stay the only saturated thing on screen.

### Theory tokens — unchanged
`--chord-tone #2e9e5b` · `--tension #3b82f6` · `--altered #8b5cf6` · `--avoid #f59e0b`
· `--wrong #ef4444` · `--held #9ca3af` · `--armed #60a5fa`. This brand touches none of them.

## Type
Wordmark and interface: **Sora** — 600 for the wordmark and headings at `letter-spacing: -0.03em`,
400 for body. Self-host two weights (woff2, ~45 KB total); offline use is on the roadmap.
Sora is wider than `system-ui`, so give the header lockup room to reflow when the font fails.

Readouts, note names and `<kbd>`: keep `ui-monospace` — no second font file.

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600&display=swap" rel="stylesheet">
```

## Header lockup (HTML)
Live text plus the SVG mark, not a picture of text.

```html
<a class="logo" href="./">
  <img src="assets/mark.svg" alt="" width="26" height="26">
  <span>Side<span class="logo-accent">Keys</span></span>
</a>
```

```css
.logo { display: flex; align-items: center; gap: 11px;
  font-family: Sora, system-ui, sans-serif; font-weight: 600;
  font-size: 17px; letter-spacing: -0.03em; color: #F4F2EE; text-decoration: none; }
.logo-accent { color: #E0489E; }
@media (prefers-color-scheme: light) {
  .logo { color: #14171A; }
  .logo-accent { color: #C41E7F; }
}
```

Light mode swaps `mark.svg` for `mark-light-bg.svg`.

## Favicon + social
```html
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<meta property="og:image" content="https://editnss.github.io/SideKeys/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

## Rules
- The accent never touches a key or a verdict. If it appears next to the keyboard, it is chrome.
- Keep the three neutral bars neutral; the offset bar is the only coloured element in the mark.
- No mascot. The personality lives in the verdict writing, not in a character.
- The wordmark is always one word, capital S and capital K, accent on `Keys`.
