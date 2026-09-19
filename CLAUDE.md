# Voicing Lab — CLAUDE.md

Antrenor de voicings și reharmonizare pentru pianiști de jazz. Conectezi clapa (Yamaha Genos) prin USB-MIDI la browser, aplicația îți cere un acord, tu îl cânți, iar ea îți spune instant ce ai cântat (tip de voicing, tensiuni, note evitate, calitatea voice leading-ului). În fazele următoare, Claude propune alternative și reharmonizări pe care le auzi direct pe Genos prin MIDI out.

Numele e **Voicing Lab**, final din Faza 0: repo `EdiTnss/Voicing-Lab` (cu majuscule, cum l-a creat Edi), GitHub Pages pe `editnss.github.io/Voicing-Lab`. Repo-ul nu se mai redenumește, pentru că GitHub Pages nu face redirect după redenumire și link-ul de demo ar muri. Verificarea `Origin` din Worker nu depinde de numele repo-ului: header-ul `Origin` conține doar `https://editnss.github.io`, fără cale. `package.json` păstrează `"name": "voicing-lab"` (npm cere litere mici). Numele rămâne consecvent în README, `<title>` și `package.json`.

Repo-ul e **privat până la Faza 4**: portofoliul are valoare abia când e prezentabil (README, demo, teste). Atunci trece pe public, pentru că GitHub Pages pe cont gratuit funcționează doar pe repo-uri publice (alternativa e GitHub Pro). La trecere devine vizibil **tot istoricul**, deci regula „niciun secret în repo" se aplică de la primul commit. Licență: **niciuna deocamdată** (toate drepturile rezervate; codul se poate citi, nu refolosi); se decide la publicare, `package.json` are `"license": "UNLICENSED"` până atunci.

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
- Când se adaugă o regulă de teorie nouă, se adaugă și în tabelul din [docs/spec-analyzer.md](docs/spec-analyzer.md). Când se adaugă o tehnică de substituție nouă, se adaugă în tabelul de candidați din [docs/spec-reharm.md](docs/spec-reharm.md), cu regula de detecție și un test.
- Precizările din implementare (decizii, capcane, schimbări de spec) se scriu în specificația modulului din `docs/`, în același commit cu codul, nu în acest fișier.
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
  midi/capture.js          regulile de snapshot (debounce, staccato, „next"), logică pură, testată
  midi/input.js            requestMIDIAccess, toate intrările/canalele, parseMidiMessage
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
  audio/metronome.js       metronom Web Audio cu lookahead, count-in, onBeat, positionOf(performance.now)
  ui/session.js            o trecere prin progresie: sloturi, locate(bar, beat), record, summary (testat)
  ui/stats.js              statistici: încercări, curate, probleme pe calitate; sesiune + cumulativ în localStorage (testat)
  theory/piece.js          modelul unei piese (grilă + melodie), cuantizare, validare reharm
  theory/analysis.js       analiză armonică: trepte, funcții, cadențe, fraze, note-țintă (Faza 3a)
  theory/candidates.js     generează acordurile compatibile cu melodia, etichetate pe tehnică (Faza 3a)
  theory/scoring.js        scoruri pentru un reharm: clash, bas, densitate, coerență (Faza 3a)
  theory/realize.js        simboluri → voicings cu voice leading, bas și melodie (Faza 3b)
  ui/drill.js              starea drill-ului: setări, acordul următor, localStorage
  ui/keyboard.js           claviatura SVG, colorată pe rol
  ui/render.js             randare DOM, fără logică de teorie aici
  ai/client.js             apel spre proxy (Faza 3a)
  ai/prompts.js            toate prompturile, versionate (Faza 3a)
  ai/explain.js            explain & suggest din drill: input, validarea sugestiilor prin analizor (Faza 3a)
  ai/pipeline.js           execute: candidați → apel → validare → scoruri (Faza 3a); plan și review (Faza 3b)
  audio/synth.js           fallback Web Audio pentru demo mode (Faza 4)
styles/*.json              profiluri de stil ca date (Faza 5)
eval/pieces/*.json         piese de test din domeniul public (Faza 5)
eval/run.js                rulează pipeline-ul pe piesele de test și raportează metrici (Faza 5)
eval/compare.js            execute singur vs plan + execute + review pe o piesă, de N ori (Faza 3b; sămânța lui run.js)
eval/reports/*.json        rapoartele măsurătorilor, păstrate ca dovadă
worker/                    Cloudflare Worker — proxy Anthropic, fără logică (Faza 3a)
test/                      *.test.js, rulate cu node --test
.github/workflows/test.yml CI: npm test pe Node 22 și 24, la fiecare push (Faza 1)
package.json               fără dependențe: "type": "module" + npm test
README.md                  engleză, cu GIF/video demo
CLAUDE.md                  acest fișier, în repo (public odată cu repo-ul, la Faza 4)
docs/PRODUCT.md            scopul produsului: poziționare, fazele P0–P4, reguli de scop (sursa de adevăr)
docs/spec-*.md             specificațiile pe module: capture, analyzer, reharm
docs/PHASES.md             fazele 0–5 cu DoD și vechiul scope guard
docs/JOURNAL.md            jurnalul sesiunilor
```

Regula de dependență: `theory/` nu importă nimic din `midi/`, `ui/` sau `ai/`. `midi/` nu știe de UI. `ai/` importă din `theory/` (pentru analiză și candidați) dar nu invers. UI-ul e singurul care le leagă. Worker-ul nu conține logică muzicală și nu conține prompturi — doar adaugă cheia și limitează cererile; prompturile stau în `ai/prompts.js`, vizibile în repo.

## Starea curentă

La 2026-09-19:

- **Fazele 0, 1, 2 și 3a sunt bifate** (DoD-urile în [docs/PHASES.md](docs/PHASES.md)). **Faza 3b**: aranjamentul (`realize.js`, `player.js`) a fost ascultat de Edi pe Genos; `plan` și `review` sunt implementate, cu DoD-ul măsurat îndeplinit pe piesa de 16 măsuri (bas 0,85 față de 0,80, mix de tehnici 4,67 față de 3,67; `eval/reports/compare-2026-09-19T13-59-52-398Z.json`). Din 3b rămâne execuția pe fraze peste 32 de măsuri.
- **179 de teste** verzi, CI pe Node 22 și 24.
- **Planul de produs** e în [docs/PRODUCT.md](docs/PRODUCT.md); suntem în **P0**. Din P0 e făcută spargerea lui `CLAUDE.md` în reguli, jurnal și specificații. Reharm-ul a ieșit din produs: rămâne în repo și în demo, fără lucru nou în afara execuției pe fraze, care e în P0.
- **Worker-ul** rulează doar local (`start.cmd`); nu e publicat în cloud (`npx wrangler login`, `npm --prefix worker run deploy`, `npm --prefix worker run secret`). Publicarea face parte din Faza 4, deci din P0.
- Repo-ul e privat. Necommise: `assets/` (logo, favicon, imagine OG, `BRAND.md`, ale lui Edi, pentru Faza 4) și `Voicing Lab ca produs.pdf`, care nu intră în repo (analiza de piață stă în afara lui, vezi `PRODUCT.md`).

## Următorul pas

1. **Execuția pe fraze** pentru piese peste 32 de măsuri, cu contextul frazei precedente (ultimul punct din Faza 3b, primul din P0). Designul nu e aprobat; de decis cu Edi:
   - cât cuprinde un apel `execute`: o frază de 4 măsuri sau bucăți de până la 32 de măsuri, tăiate la granițe de frază;
   - ce context primește bucata următoare: ultimele 2 acorduri alese (cum zice spec-ul) și poate scorurile parțiale, ca densitatea să rămână în țintă pe toată piesa;
   - dacă `plan` rămâne un singur apel pe toată piesa;
   - `review`: o singură rundă pe toată piesa (spec: fără bucle) sau câte una pe bucată;
   - cum se testează fără cheie (clientul fals din `test/pipeline.test.js` răspunde deja pe acțiune) și pe ce piesă lungă se măsoară.
2. Restul lui P0, din `PRODUCT.md`: Faza 4 integral (demo mode, claviatură pe ecran, `audio/synth.js`, repo public, Pages, Worker publicat), harness-ul de verificare (port MIDI fals + sesiuni înregistrate care se reiau), prototipul de intrare pe microfon cu `basic-pitch-ts` (prag: peste 90% din 20 de voicings identificate corect, cu octava exactă).
3. De la Edi: o piesă proprie cu „plan & review" în tab-ul Reharm, ascultată pe Genos.

## Documentație

| Fișier | Ce conține | Când se citește |
|---|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | poziționarea, ce iese din v1, fazele P0–P4 cu porțile lor, regulile de scop | la începutul fiecărei sesiuni |
| [docs/spec-capture.md](docs/spec-capture.md) | snapshot-ul de voicing: debounce, staccato, nota de „next", canalele | `midi/capture.js`, `midi/input.js` |
| [docs/spec-analyzer.md](docs/spec-analyzer.md) | parserul de chord symbol, tabelul calităților, clasificarea voicing-ului, voice leading | `theory/chords.js`, `analyzer.js`, `voiceLeading.js`, `voicings.js` |
| [docs/spec-reharm.md](docs/spec-reharm.md) | piesa, recorder-ul, analiza, candidații, pipeline-ul AI și Worker-ul, scorurile, validarea, realizarea, partenerul de studiu, evaluarea | `piece.js`, `recorder.js`, `analysis.js`, `candidates.js`, `scoring.js`, `realize.js`, `player.js`, `ai/`, `worker/`, `eval/` |
| [docs/PHASES.md](docs/PHASES.md) | fazele 0–5 cu DoD și vechiul scope guard | când P0 trimite la o fază veche (3b, 4) |
| [docs/JOURNAL.md](docs/JOURNAL.md) | jurnalul sesiunilor, cu deciziile și cifrele măsurate | la final (intrare nouă); istoricul, la nevoie |
