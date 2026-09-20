# SideKeys — CLAUDE.md

Antrenor de voicings și reharmonizare pentru pianiști de jazz. Conectezi clapa (Yamaha Genos) prin USB-MIDI la browser, aplicația îți cere un acord, tu îl cânți, iar ea îți spune instant ce ai cântat (tip de voicing, tensiuni, note evitate, calitatea voice leading-ului). În fazele următoare, Claude propune alternative și reharmonizări pe care le auzi direct pe Genos prin MIDI out.

Numele e **SideKeys**, ales de Edi pe 2026-09-20: repo `EdiTnss/SideKeys`, GitHub Pages pe `editnss.github.io/SideKeys`. Proiectul s-a numit **Voicing Lab** până atunci; s-a redenumit pentru că numele se lovea de **VoicingLab Ltd**, companie britanică activă cu produs plătit pentru exact aceiași pianiști, iar în aceeași nișă mai stă și JazzPianoLab. De aici încolo numele nu se mai schimbă: GitHub Pages nu face redirect după redenumire, deci fiecare redenumire omoară link-ul demo — acum a costat puțin doar pentru că nu-l văzuse încă nimeni. Verificarea `Origin` din Worker nu depinde de numele repo-ului: header-ul `Origin` conține doar `https://editnss.github.io`, fără cale. `package.json` păstrează `"name": "sidekeys"` (npm cere litere mici). Ce a salvat un browser sub numele vechi (setări, piese, statistici) se mută singur la prima citire, prin `src/storage.js`.

Repo-ul e **public** din 2026-09-20, cu GitHub Pages pornit. Tot istoricul e vizibil, deci regula „niciun secret în repo" se aplică de la primul commit; înainte de publicare am verificat fiecare commit și nu există nicio cheie reală în istoric. Licență: **niciuna** (toate drepturile rezervate; codul se poate citi, nu refolosi) — decizie Edi la publicare, 2026-09-20, ca să rămână libere opțiunile de monetizare din P2; `package.json` păstrează `"license": "UNLICENSED"`, iar README-ul o spune explicit. O licență se poate adăuga oricând; nu se poate retrage.

## Scop dublu

Scopul produsului, fazele lui (P0–P4) și regulile de scop sunt în [docs/PRODUCT.md](docs/PRODUCT.md), sursa de adevăr pentru scop de la 2026-09-19. Unde acest fișier sau o specificație din `docs/` îl contrazice, câștigă `PRODUCT.md`.

1. **Studiu**: Edi are 2+ ore/zi de studiu; aplicația e unealta lui de comping/voicings, deci trebuie să fie utilă din prima săptămână, nu la final.
2. **Portofoliu** pentru angajare ca AI/automation engineer: repo public, cod curat, teste, README în engleză cu demo video, integrare LLM reală (Faza 3a/3b) și un „demo mode" fără clapă MIDI ca să poată încerca oricine.

Ambele scopuri sunt egale. Dacă o decizie tehnică ajută portofoliul dar strică sesiunea de studiu (latență, fricțiune la pornire), pierde portofoliul.

## Reguli de colaborare

- Suntem parteneri pe proiect. Când Edi greșește, Claude explică de ce și dă varianta corectă — fără aprobare reflexă.
- Claude explică pe scurt fiecare concept nou de programare când apare prima dată (ES modules, event listeners, Web MIDI, teste, Workers), cu logică pas cu pas, nu doar concluzia.
- Claude propune soluții mai bune când le vede, chiar dacă nu a fost întrebat.
- Cererile ambigue primesc o întrebare de clarificare, nu o presupunere. Pașii mari se confirmă înainte de execuție.
- Edi e pianist de jazz avansat: teoria muzicală nu se explică, se implementează corect. Dacă Claude nu e sigur de o regulă de teorie (ex. ce tensiuni sunt disponibile pe un acord), întreabă, nu inventează.
- La începutul fiecărei sesiuni, Claude citește [docs/PRODUCT.md](docs/PRODUCT.md). Specificațiile din `docs/spec-*.md` se citesc doar când se lucrează la modulul respectiv (care pe care, în „Documentație", la final).

## Convenții pentru sesiunile cu Claude Code

- La finalul fiecărei sesiuni, adaugă o intrare în [docs/JOURNAL.md](docs/JOURNAL.md) (data, ce s-a făcut, ce urmează, decizii luate) și actualizează „Starea curentă" și „Următorul pas" din acest fișier. Jurnalul nu se citește la începutul sesiunii; se caută în el istoricul unei decizii, la nevoie.
- Înainte de o schimbare care atinge `analyzer.js` sau `chords.js`, scrie testul întâi, apoi implementarea.
- Rulează testele cu `npm run test:quiet`: o linie când sunt verzi, numele și diff-ul când pică. Raportul implicit al lui `node --test` scrie o linie pe test — circa 25 KB de context la fiecare rulare, fără nicio informație. `npm test` rămâne raportul complet, pentru CI și pentru un eșec care cere mai mult context.
- Când se adaugă o regulă de teorie nouă, se adaugă și în tabelul din [docs/spec-analyzer.md](docs/spec-analyzer.md). Când se adaugă o tehnică de substituție nouă, se adaugă în tabelul de candidați din [docs/spec-reharm.md](docs/spec-reharm.md), cu regula de detecție și un test.
- Precizările din implementare (decizii, capcane, schimbări de spec) se scriu în specificația modulului din `docs/`, în același commit cu codul, nu în acest fișier.
- `node harness/replay.js --update` rescrie referința de regresie a harness-ului. Se rulează doar cu aprobarea lui Edi, după ce diferența raportată a fost citită și explicată, iar diferența se scrie în jurnal. E echivalentul harness-ului pentru „nu slăbi testul ca să treacă": spre deosebire de un test, referința se schimbă dintr-o comandă și nu lasă urmă vizibilă în diff.
- Orice schimbare în `ai/prompts.js` incrementează `PROMPT_VERSION` și, din Faza 5, se rulează pe setul de evaluare înainte de commit.
- Nu rula `git push --force`, nu șterge fișiere fără confirmare.

## Stack și constrângeri

- **Vanilla JS**, ES modules (`<script type="module">`), fără framework, fără bundler, **zero dependențe npm în aplicație**.
- **Browser țintă**: Chrome/Edge (Web MIDI). Safari nu suportă Web MIDI; nu ne adaptăm pentru el, dar demo mode (Faza 4) trebuie să meargă oriunde.
- **Dev server**: ES modules nu se încarcă de pe `file://` (CORS), deci pornim cu `npx serve .` sau extensia Live Server din VS Code. `localhost` e context securizat, deci Web MIDI funcționează.
- **Teste**: `node --test` (test runner-ul încorporat în Node, fără instalare; Node ≥ 22 — 20 a ieșit din suport în aprilie 2026), pornit cu `npm test`. CI pe GitHub Actions rulează `npm test` pe Node 22 și 24 la fiecare push, cu badge în README; GitHub pornește o singură rulare per push, pe ultimul commit, deci commit-urile `test:` roșii dinaintea `feat:` nu produc rulări roșii dacă se împing împreună. `package.json` există doar pentru `"type": "module"` (Node tratează `.js` ca ES modules pe orice versiune) și scriptul de test — **fără nicio dependență**. Modulele din `src/theory/` sunt JS pur, fără DOM, exact ca să poată fi testate în Node.
- **Deploy**: GitHub Pages (static, HTTPS → Web MIDI merge). Proxy-ul AI din Faza 3a e separat, pe Cloudflare Workers.
- **Cheia Anthropic nu ajunge niciodată în frontend sau în repo.** Doar în variabilele de mediu ale Worker-ului (local în `worker/.dev.vars`, ignorat de git).
- Singura excepție de la „zero dependențe": `worker/` are propriul `package.json` cu `wrangler` ca dev dependency, pentru rulare locală și deploy. Rămâne izolat în folderul lui; aplicația din `src/` nu importă nimic din npm.
- **Limbă**: cod, comentarii, commit-uri, README, UI — engleză (recrutorii citesc repo-ul). Acest fișier, `docs/` și discuțiile — română.
- Commit-uri mici, mesaje în stil `feat:`, `fix:`, `test:`, `docs:`.
- Audio: MIDI out spre Genos e sunetul principal. Web Audio (sintetizator simplu) doar ca fallback pentru demo mode.

## Structura repo-ului

```
index.html                 pagina aplicației
styles.css                 stilurile paginii (folderul styles/ e pentru profilurile JSON, Faza 5)
midi-test.html             Faza 0 — diagnostic MIDI in/out (rămâne în repo ca tool)
start.cmd                  Windows: pornește pagina, proxy-ul local și Chrome dintr-un dublu-clic
src/
  app.js                   singurul loc care leagă theory, midi și ui
  storage.js               cheile din localStorage, cu mutarea de sub numele vechi (testat)
  midi/capture.js          regulile de snapshot (debounce, staccato, „next"), logică pură, testată
  midi/input.js            requestMIDIAccess (sau accesul primit), toate intrările/canalele, parseMidiMessage
  midi/virtual.js          acces MIDI fără hardware (?midi=virtual, harness) și mergeAccess:
                           porturile virtuale lângă cele reale
  midi/recorder.js         înregistrează melodia cântată în timp muzical (bar, beat, durată în timpi), pozițiile vin din metronom; testat
  midi/output.js           trimite voicings spre Genos (Faza 2), mesaje programate în timp și oprire curată (Faza 3b)
  midi/player.js           evenimentele aranjamentului → mesaje MIDI cu timp, un canal pe voce (Faza 3b)
  theory/notes.js          MIDI number ↔ nume, pitch class, intervale
  theory/chords.js         parser de chord symbol → chord tones, tensiuni, note evitate
  theory/analyzer.js       clasifică voicing-ul, low interval limits
  theory/voiceLeading.js   compareVoicings, scoreProgression (Faza 2)
  theory/progressions.js   biblioteca de progresii generice + parser de grilă text
  theory/timing.js         timp ↔ (bar, beat), cuantizare; folosit de metronom, recorder și player
  theory/voicings.js       sugestii de voicing din șabloane, în registru, ordonate după voice leading (Faza 2; sămânța lui realize.js)
  audio/context.js         AudioContext-ul paginii și conversiile de ceas (pure, testate)
  audio/metronome.js       metronom Web Audio cu lookahead, count-in, onBeat, positionOf(performance.now)
  ui/session.js            o trecere prin progresie: sloturi, locate(bar, beat), record, summary (testat)
  ui/stats.js              statistici: încercări, curate, probleme pe calitate; sesiune + cumulativ în localStorage (testat)
  ui/tape.js               banda sesiunii: ultima oră de cântat și verdictele; reluarea ei (harness), testată
  theory/piece.js          modelul unei piese (grilă + melodie), cuantizare, validare reharm
  theory/analysis.js       analiză armonică: trepte, funcții, cadențe, fraze, note-țintă (Faza 3a)
  theory/candidates.js     generează acordurile compatibile cu melodia, etichetate pe tehnică (Faza 3a)
  theory/scoring.js        scoruri pentru un reharm: clash, bas, densitate, coerență (Faza 3a)
  theory/realize.js        simboluri → voicings cu voice leading, bas și melodie (Faza 3b)
  ui/drill.js              starea drill-ului: setări, acordul următor, localStorage
  ui/keyboard.js           claviatura SVG, colorată pe rol, cu taste care răspund la click
  ui/onscreen.js           clapa de ecran ca intrare: armare + Enter, literele ca pian, ecou spre synth
  ui/render.js             randare DOM, fără logică de teorie aici
  ai/client.js             apel spre proxy (Faza 3a)
  ai/prompts.js            toate prompturile, versionate (Faza 3a)
  ai/explain.js            explain & suggest din drill: input, validarea sugestiilor prin analizor (Faza 3a)
  ai/pipeline.js           execute: candidați → apel → validare → scoruri (Faza 3a); plan și review (Faza 3b)
  audio/synth.js           synth Web Audio în forma unui port MIDI out (demo mode)
demo/piece.json            piesa demo (grilă + melodie); demo/reharm.json, răspunsul salvat
styles/*.json              profiluri de stil ca date (Faza 5)
eval/pieces/*.json         piese de test din domeniul public (Faza 5)
eval/run.js                rulează pipeline-ul pe piesele de test și raportează metrici (Faza 5)
eval/compare.js            execute singur vs plan + execute + review pe o piesă, de N ori (Faza 3b; sămânța lui run.js)
eval/reports/*.json        rapoartele măsurătorilor, păstrate ca dovadă
harness/replay.js          reia sesiunile salvate și raportează ce s-a schimbat (--update acceptă)
harness/sessions/*.json    sesiuni înregistrate de aplicație („Save session"), reluate și în CI
worker/                    Cloudflare Worker — proxy Anthropic, fără logică (Faza 3a)
test/                      *.test.js, rulate cu node --test
tools/quiet-report.mjs     rulează testele și rezumă (vezi antetul: numele din tools/ nu au voie
                           să semene cu test-*, *-test, *_test sau *.test, altfel runner-ul le execută)
.github/workflows/test.yml CI: npm test pe Node 22 și 24, la fiecare push (Faza 1)
package.json               fără dependențe: "type": "module" + npm test (și test:quiet)
README.md                  engleză, cu GIF/video demo
CLAUDE.md                  acest fișier, în repo (public odată cu repo-ul, la Faza 4)
docs/PRODUCT.md            scopul produsului: poziționare, fazele P0–P4, reguli de scop (sursa de adevăr)
docs/spec-*.md             specificațiile pe module: capture, analyzer, reharm
docs/PHASES.md             fazele 0–5 cu DoD și vechiul scope guard
docs/JOURNAL.md            jurnalul sesiunilor
```

Regula de dependență: `theory/` nu importă nimic din `midi/`, `ui/` sau `ai/`. `midi/` nu știe de UI. `ai/` importă din `theory/` (pentru analiză și candidați) dar nu invers. UI-ul e singurul care le leagă. Worker-ul nu conține logică muzicală și nu conține prompturi — doar adaugă cheia și limitează cererile; prompturile stau în `ai/prompts.js`, vizibile în repo.

## Starea curentă

La 2026-09-20:

- **Fazele 0, 1, 2 și 3a sunt bifate** (DoD-urile în [docs/PHASES.md](docs/PHASES.md)). **Faza 3b**: aranjamentul (`realize.js`, `player.js`) a fost ascultat de Edi pe Genos; `plan` și `review` sunt implementate, cu DoD-ul măsurat îndeplinit pe piesa de 16 măsuri (bas 0,85 față de 0,80, mix de tehnici 4,67 față de 3,67; `eval/reports/compare-2026-09-19T13-59-52-398Z.json`). **Execuția pe bucăți** (piesele peste 32 de sloturi) e implementată și măsurată pe un studiu de 64 de măsuri (bas 0,90 față de 0,84, mix 4,67 față de 3,67, 0 clash-uri, densitatea în țintă în toate 6 rulările; `eval/reports/compare-2026-09-19T16-37-52-096Z.json`). Toate punctele Fazei 3b sunt făcute; din DoD rămâne ca Edi să asculte pe Genos o piesă proprie cu „plan & review".
- **Harness-ul de verificare** e implementat (spec în [docs/spec-capture.md](docs/spec-capture.md)): portul MIDI virtual (`?midi=virtual`), banda sesiunii cu „Save session", reluarea în Node și CI (`node harness/replay.js`). Se reiau în CI o sesiune înregistrată de aplicație pe portul virtual (13 snapshot-uri) și prima sesiune reală a lui Edi pe Genos (11 minute, 93 de snapshot-uri), toate la fel: **DoD-ul harness-ului din P0 e îndeplinit**. **Găsit de harness și rezolvat**: în timed, un acord anticipat peste bara de măsură nu primea verdict; acum, de la „și"-ul timpului dinaintea unei schimbări, un voicing contează pentru acordul următor (decizie Edi: „de la «și»-ul lui 4"; generalizarea la schimbările din mijlocul măsurii, la 3/4, la numărătoare și la ultimul acord e a mea și așteaptă confirmarea lui), iar schimbarea de slot nu mai anulează captura.
- **Demo mode** e implementat (design aprobat de Edi pe 2026-09-20, spec în [docs/spec-capture.md](docs/spec-capture.md)): clapa desenată e o intrare MIDI virtuală (click = armare, `Enter` = acordul, literele `A S D F…` ca pian), `audio/synth.js` e o ieșire în forma unui port MIDI out, iar `mergeAccess` le ține **lângă** porturile reale — nu e un mod separat și nu există nicio ramură „dacă e demo". Web MIDI se cere automat doar pe `localhost`, în rest la buton. Verdictul scrie acum acordul judecat și marchează anticiparea (cerința fermă 2), iar reharm-ul din demo servește un răspuns salvat: apel live doar pe `localhost` sau cu `?reharm=live` (cerința fermă 1). **Verificat în browser**: 4 clicuri pe ecran → acord → analiză, synth-ul sună (8 oscilatoare pe 4 note), sugestiile ies pe synth, o anticipare la 60 bpm primește „Cmaj7, anticipated" și rămâne pe ecran peste bara de măsură.
- **237 teste** verzi, CI pe Node 22 și 24. Local, `npm run test:quiet`. Cele trei sesiuni înregistrate se reiau neschimbate.
- **Planul de produs** e în [docs/PRODUCT.md](docs/PRODUCT.md); suntem în **P0**. Din P0 sunt făcute spargerea lui `CLAUDE.md`, execuția pe fraze, harness-ul și demo mode (fără piesa demo). Reharm-ul a ieșit din produs: rămâne în repo și în demo, iar `pipeline.js` nu mai primește lucru nou.
- **Piesa demo nu blochează nimic** (decizie Edi, 2026-09-20). DoD-ul P0 cere doar „demo-ul public merge fără clapă"; „apasă reharmonize pe piesa demo" e din `PHASES.md`, adică din faza veche, iar unde se contrazic câștigă `PRODUCT.md`. Deci: **fără `demo/reharm.json`, tab-ul Reharm nu apare pe site-ul publicat**, iar demo-ul arată exact produsul — analiza, drill-ul, progresiile, clapa de ecran. Dovada arhitecturii hibride stă în README (diagrama + cifrele din `eval/reports/`). Dacă Edi vrea totuși exemplul salvat, cel mai ieftin drum e o melodie originală scurtă peste o progresie din bibliotecă, apoi `sideKeys.saveReharm()`; e o schimbare de fișier, nu de cod.
- **Publicarea e făcută** (2026-09-20): repo public, Pages viu pe https://editnss.github.io/SideKeys/, demo verificat pe link-ul publicat (4 clicuri → acord → analiză, synth-ul sună, fără tab Reharm și fără „Ask Claude", fiindcă nu au ce face acolo), CI verde pe commit-ul publicat. **Rămas din P0**: GIF și video pentru README (de la Edi) — apoi **prototipul de microfon** cu `basic-pitch-ts`, în afara lui `src/` (prag: peste 90% din 20 de voicings identificate corect, cu octava exactă). De la Edi, separat: o piesă proprie cu „plan & review" ascultată pe Genos (ultima jumătate a DoD-ului Fazei 3b).
- **Worker-ul rămâne local** (`start.cmd`) și **nu se publică** (decizie Edi, 2026-09-20): site-ul publicat nu face niciun apel AI, deci nu poate costa nimic. `PUBLISHED_PROXY_URL` rămâne gol în `app.js`, iar butonul „Ask Claude" apare doar când există un proxy în Settings — cine clonează repo-ul și pornește Worker-ul cu cheia lui îl primește înapoi. Dacă se publică vreodată: limita din `wrangler.jsonc` e 20 de cereri pe minut pe IP, adică ~12 $/oră expunere dacă e scriptată — se scade întâi (6/minut ajunge pentru un om), plus un plafon lunar în consola Anthropic.
- Necommise: `assets/` (logo, favicon, imagine OG, `BRAND.md`, ale lui Edi, pentru Faza 4) și `Voicing Lab ca produs.pdf` (numele de dinainte de redenumire, cum e pe disc și în `.gitignore`), care nu intră în repo (analiza de piață stă în afara lui, vezi `PRODUCT.md`).

## Următorul pas

Publicarea e făcută: repo public, Pages pornit, demo verificat pe link-ul viu (https://editnss.github.io/SideKeys/), CI verde. Urmează **GIF-ul de 15 secunde și videoul de 60–90 s** pentru README (filmate de Edi), apoi **prototipul de microfon** cu `basic-pitch-ts`. Pe listă la P2, nu acum: opinie de marcă pe familia „Sidekick" în clasele 9 și 41, înainte de înregistrare.

## Documentație

| Fișier | Ce conține | Când se citește |
|---|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | poziționarea, ce iese din v1, fazele P0–P4 cu porțile lor, regulile de scop | la începutul fiecărei sesiuni |
| [docs/spec-capture.md](docs/spec-capture.md) | snapshot-ul de voicing: debounce, staccato, nota de „next", canalele; harness-ul: portul virtual, banda sesiunii, reluarea | `midi/capture.js`, `midi/input.js`, `midi/virtual.js`, `ui/tape.js`, `harness/` |
| [docs/spec-analyzer.md](docs/spec-analyzer.md) | parserul de chord symbol, tabelul calităților, clasificarea voicing-ului, voice leading | `theory/chords.js`, `analyzer.js`, `voiceLeading.js`, `voicings.js` |
| [docs/spec-reharm.md](docs/spec-reharm.md) | piesa, recorder-ul, analiza, candidații, pipeline-ul AI și Worker-ul, scorurile, validarea, realizarea, partenerul de studiu, evaluarea | `piece.js`, `recorder.js`, `analysis.js`, `candidates.js`, `scoring.js`, `realize.js`, `player.js`, `ai/`, `worker/`, `eval/` |
| [docs/PHASES.md](docs/PHASES.md) | fazele 0–5 cu DoD și vechiul scope guard | când P0 trimite la o fază veche (3b, 4) |
| [docs/JOURNAL.md](docs/JOURNAL.md) | jurnalul sesiunilor, cu deciziile și cifrele măsurate | la final (intrare nouă); istoricul, la nevoie |
