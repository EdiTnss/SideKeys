# demo/

The two files the published demo serves. Both are data: no code reads anything from here that
is not listed below, and a missing file is not an error — the app opens as it always did.

## `piece.json`

The piece a browser that has never been here starts on: grid plus recorded melody, exactly what
"Export JSON" writes in the Progression tab (`theory/piece.js`). It is saved into the visitor's
own storage on first load, so they can change or delete it; a browser that already has pieces of
its own never sees it.

It must be original material or verified public domain (`PRODUCT.md`): no Real Book grids, no
standards. The one here is Edi's own study.

## `reharm.json`

```json
{ "title": "…", "savedAt": "YYYY-MM-DD", "result": { … } }
```

`result` is one answer Claude gave, saved as it came: `voicingLab.saveReharm()` in the console
writes this file from the reharmonization on screen, minus the candidate menu and the raw calls.
The page shows the model, the prompt version and the date beside it, so nobody has to take it on
trust.

Why saved and not live: an `execute` costs around 25 cents and the Worker limits per IP without
telling the actions apart, so one visitor could empty the key. A live call happens only where the
key is the person's own — `localhost`, or `?reharm=live`. This is a firm requirement in
`docs/PRODUCT.md`, not a preference; it is renegotiated with Edi before any code changes it.
