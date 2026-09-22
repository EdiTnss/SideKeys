# demo/

What the published demo serves: a manifest that is always here, and the two files it names when
they exist. All of it is data — no code reads anything from here that is not listed below — and a
file that is not published yet is not an error: the app opens as it always did.

## `manifest.json`

```json
{ "piece": null, "reharm": null }
```

Always published, and the only file the app asks for unprompted. It names what else is here, or
`null`. Probing for the other two directly meant a 404 in every visitor's console for as long as
they were not published; asking the manifest first keeps it clean. Add a file, name it here, and
the app picks it up on the next load — still a file change, not a change of code. `test/demo.test.js`
checks that a name here is a file that is really committed.

## `piece.json`

The piece a browser that has never been here starts on: grid plus recorded melody, exactly what
"Export JSON" writes in the Progression tab (`theory/piece.js`). It is saved into the visitor's
own storage on first load, so they can change or delete it; a browser that already has pieces of
its own never sees it.

It must be original material or verified public domain (`PRODUCT.md`): no Real Book grids, no
standards. None is published yet; when one is, it will be Edi's own study.

## `reharm.json`

```json
{ "title": "…", "savedAt": "YYYY-MM-DD", "result": { … } }
```

`result` is one answer Claude gave, saved as it came: `sideKeys.saveReharm()` in the console
writes this file from the reharmonization on screen, minus the candidate menu and the raw calls.
The page shows the model, the prompt version and the date beside it, so nobody has to take it on
trust.

Without it — that is, for as long as `manifest.json` holds `"reharm": null` — the Reharm tab does not appear on the published site.

Why saved and not live: an `execute` costs around 25 cents and the Worker limits per IP without
telling the actions apart, so one visitor could empty the key. A live call happens only where the
key is the person's own — `localhost`, or `?reharm=live`. This is a firm requirement in
`docs/PRODUCT.md`, not a preference; it is renegotiated with Edi before any code changes it.
