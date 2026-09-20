# SideKeys — spec-reharm.md

Modelul piesei, înregistrarea melodiei, analiza armonică, candidații, pipeline-ul AI (Worker, client, prompturi, `plan` / `execute` / `review`), scorurile, validarea, realizarea ca aranjament, partenerul de studiu și evaluarea. Mutat neschimbat din `CLAUDE.md` pe 2026-09-19; se citește când se lucrează la `theory/piece.js`, `midi/recorder.js`, `theory/analysis.js`, `theory/candidates.js`, `theory/scoring.js`, `theory/realize.js`, `midi/player.js`, `ai/`, `worker/` sau `eval/`. Reharm-ul a ieșit din produs (vezi `docs/PRODUCT.md`): rămâne în repo și în demo, fără lucru nou. „Tabelul analizorului" la care trimite textul e în `docs/spec-analyzer.md`.

## Specificația reharmonizării unei piese

Principiu: **melodia e fixă, acordurile se schimbă.** Claude propune, `piece.js` verifică. Un acord propus e acceptat doar dacă fiecare notă melodică de deasupra lui e chord tone sau tensiune disponibilă.

### Modelul unei piese (`piece.js`)

```js
{
  title: "My Tune",            // doar local, nu se salvează în repo
  key: "F",                    // tonalitatea declarată de utilizator
  timeSignature: [4, 4],
  tempo: 120,
  bars: [
    {
      chords: [{ symbol: "Gm7", beat: 1 }, { symbol: "C7", beat: 3 }],   // beat = 1-based, poate fi 1.5 etc.
      melody: [{ midi: 65, beat: 1, duration: 2 }, { midi: 67, beat: 3, duration: 2 }]
    }
  ]
}
```

Grila vine din inputul text al Fazei 2 (`| Gm7 C7 | Fmaj7 | % |`): acordurile dintr-o măsură împart timpii egal când numărul lor divide măsura (1, 2, 4 în 4/4; 1, 3 în 3/4), altfel `GridParseError` cu numărul măsurii — durate explicite se adaugă când va fi nevoie; `%` = repetă măsura anterioară; `formatGrid` face drumul invers. Biblioteca (`PROGRESSIONS`) e scrisă în C ca text de grilă și se transpune cu ortografia tonalității-țintă (bemoli în F, Bb, Eb…, diezi în G, D, A, E, B, F#; niciodată Cb/Fb/E#/B# pe fundamentale). Melodia vine din `recorder.js`.

### Înregistrarea melodiei (`recorder.js`, Faza 2)

1. Utilizatorul pornește metronomul pe grilă (o măsură de count-in) și cântă melodia o singură dată, pe mâna dreaptă.
2. Fiecare note-on e marcat cu `event.timeStamp` al evenimentului Web MIDI (ceasul `performance.now()`, momentul real al notei, nu momentul în care rulează handler-ul), convertit în ceasul metronomului (`AudioContext`) printr-un offset calculat o dată la pornire cu `AudioContext.getOutputTimestamp()`. Nu `Date.now()` — altfel se decalează.
3. Timpul se transformă în `(bar, beat)` și se cuantizează la optime (configurabil la triolete/șaisprezecimi mai târziu). Duration = până la note-off sau până la următoarea notă.
4. Note foarte scurte (< 60 ms) și ornamentele sub o optime se păstrează în datele brute dar nu intră în melodia „structurală" trimisă la reharm — acolo contează nota de pe fiecare timp tare și notele ținute.
5. Dacă o măsură rămâne fără note (pauză), se marchează `melody: []` — orice acord e valid acolo.

Testele pentru cuantizare: timp → (bar, beat) la 4/4 și 3/4, la tempo-uri diferite, cu count-in.

### Arhitectura: codul garantează corectitudinea, Claude aduce gustul

Un LLM nu aude și teoria lui nu e infailibilă, deci nu îl lăsăm să inventeze acorduri. Fluxul e:

```
piece ──► analysis.js ──► candidates.js ──► [Claude: plan] ──► [Claude: execute] ──► scoring.js ──► [Claude: review] ──► scoring.js ──► realize.js ──► Genos
          (determinist)   (determinist)      (gust, narativ)    (alege din meniu)     (determinist)   (critic separat)   (determinist)   (voicings reale)
```

Claude alege doar dintre candidați generați de cod (nivelul „constrained selection"), deci un acord invalid față de melodie nu poate apărea. Validarea din `piece.js` rămâne ca plasă de siguranță (dacă răspunsul JSON e stricat sau referă un id inexistent).

### 1. Analiza armonică (`analysis.js`, Faza 3a, deterministă)

Input: `piece`. Output: aceeași structură, cu un obiect `analysis` pe piesă și pe măsură.

Pe piesă:
- `key` (declarată de utilizator; dacă lipsește, estimare simplă din acordul final + primul acord, marcată `guessed: true`)
- `phrases`: liste de măsuri, implicit la 4 măsuri, ajustabile de utilizator în UI (AABA la 32 de măsuri e cazul tipic)

Pe fiecare slot de acord:
- `roman`: treaptă relativă la tonalitate, cu dominante secundare (`V7/ii`), împrumuturi (`bVI`, `iv`) și „?" când nu se încadrează
- `function`: `T` / `S` / `D` / `passing`
- `cadence`: `true` când slotul e o dominantă (V, secundară sau tritonalul ei) care rezolvă pe următorul slot cu o cvintă în jos / semiton, **sau** bVII7 care rezolvă pe I (backdoor). Acordurile de pe tonică nu sunt niciodată dominante secundare și nu fac cadență: în blues, `I7` din măsura 4 rămâne `I7` (T), nu `V7/IV` — simplificare asumată.
- Convenția treptelor: gradul din distanța de litere față de tonică, alterația din distanța de pitch class față de treapta diatonică (Db în C = bII, C# = #I); în minor, referința e minorul natural, cu excepția sensibilei (B în C minor = vii°, nu #vii). Minuscule pentru calitățile cu terță mică, `ø7` / `°` pentru cele diminuate, restul simbolului păstrat ca sufix (`ii7`, `V7alt`, `Imaj7`, `bVII7`, `#i°`). Funcții: diatonice după treaptă (T = I, iii, vi; S = ii, IV; D = V, vii; la fel în minor), dominantele cu cadență = D, dim7 cromatic = passing, împrumuturile bII / bIII / bVI / bVII fără cadență = S, altfel `?`.
- `guideTones`: din parser (3 și 7 ale acordului original, sau echivalentele: 3 și 6 pe `6`, 4 și b7 pe `7sus4`)
- `melody.structural`: notele-țintă — cele de pe timpii 1 și 3 (în 4/4) și orice notă ținută ≥ 1 timp; celelalte sunt `passing`
- `melody.relation` per notă structurală: `chordTone` / `tension` / `avoid` / `outside`

Testele: piese de 8 măsuri construite manual (ii-V-I cu dominantă secundară, blues, un pasaj modal), verificate treaptă cu treaptă.

### 2. Candidații (`candidates.js`, Faza 3a, determinist)

Pentru fiecare slot: enumeră 12 fundamentale × calitățile din tabelul analizorului; păstrează un acord doar dacă **fiecare notă structurală** a melodiei de pe slot e chord tone sau tensiune disponibilă (notele `passing` nu se verifică). Apoi etichetează fiecare candidat cu tehnica față de original și context:

| technique | regulă de detecție |
|---|---|
| `original` | acordul neschimbat (întotdeauna primul candidat) |
| `quality-change` | aceeași fundamentală, altă calitate (maj7 → 6/9, 7 → 7sus4, m7 → m6, 7 → 7alt) |
| `tritone-sub` | dom7 cu fundamentala la triton față de un dom7 original |
| `secondary-dominant` | dom7 cu fundamentala la cvintă deasupra acordului din slotul următor |
| `related-ii` | slotul se împarte în două: m7 (sau m7b5) la cvintă deasupra dominantei + dominanta; fiecare jumătate verificată separat cu melodia |
| `backdoor` | bVII7 care rezolvă pe I (sau iv → bVII7 → I) |
| `diminished-passing` | dim7 pe fundamentala cromatică dintre două acorduri la un ton distanță |
| `chromatic-approach` | dom7 sau m7 la un semiton deasupra/dedesubtul acordului următor |
| `modal-interchange` | acord împrumutat din minorul/majorul paralel: `iv`, `bVI`, `bVII`, `bIII`, `iiø` |
| `coltrane` | pe două sloturi consecutive: ciclu de terțe mari spre țintă (3 tonalități) |
| `sus-color` | 7sus4 / sus2 în locul dominantei, aceeași fundamentală |
| `other` | valid față de melodie, fără etichetă; permis doar în stilul `free`, intensitate `heavy` |

Fiecare candidat: `{ id, chords: [{ symbol, beat }], technique, bassStepToNext, warnings }` — `bassStepToNext` = distanța în semitonuri de la fundamentala candidatului la cea a slotului următor (pentru scorul liniei de bas), `warnings` = notele melodice care cad pe avoid.

Limită: maximum 12 candidați pe slot, ordonați: `original`, apoi după prioritatea tehnicilor din profilul de stil, apoi după `bassStepToNext` mic. Ce nu intră în 12 nu ajunge la Claude — modelul nu trebuie să vadă 90 de opțiuni pe măsură. **Selecția e round-robin pe tehnici** (primul candidat al fiecărei tehnici în ordinea de prioritate, apoi al doilea al fiecăreia…), altfel cele 10 schimbări de calitate pe aceeași fundamentală ar umple meniul.

Precizări din implementare (`candidates.js`): calitățile enumerate sunt `maj7, 6/9, m7, m6, mMaj7, 7, 7alt, 7b9, 7sus4, ø7, °`; o notă-țintă pe o notă avoid **păstrează** candidatul cu `warning` (decizie Edi), doar notele „outside" resping; precedența etichetelor: sus-color → backdoor → tritone-sub → secondary-dominant → diminished-passing → chromatic-approach → modal-interchange → quality-change → other (Dm7 → D7 înainte de G7 e `secondary-dominant`, nu `quality-change`; Fmaj7 → Fm7 e `modal-interchange`); dim de trecere se ortografiază în direcția mersului (C#° urcând, Db° coborând); `related-ii` cere ≥ 2 timpi și pune `ø7` când ținta e minoră; `coltrane` acoperă două sloturi (`spans: 2`: `| Abmaj7 B7 | Emaj7 G7 |` spre Cmaj7) și, când e ales, slotul următor e sărit; fiecare candidat are `chords: [{ symbol, bar, beat }]`.

### 3. Pipeline-ul (`ai/pipeline.js`, Faza 3a = doar `execute`; Faza 3b = complet)

Toate apelurile trec prin `ai/client.js` → Worker → Anthropic. Prompturile stau în `ai/prompts.js` cu un `PROMPT_VERSION` pe fiecare (pentru evaluare, Faza 5). Fiecare apel cere JSON strict; răspunsul se parsează și se validează (schemă + id-uri existente) înainte de orice.

**Apelul `plan`** (Faza 3b). Input: rezumatul analizei (tonalitate, fraze, treptele și funcțiile pe măsuri, notele-țintă), stil, intensitate. Output:

```js
{ phrases: [ { bars: [1, 4], strategy: "Keep tonic area static, delay the resolution to bar 4 with a related ii-V", techniques: ["related-ii", "tritone-sub"] } ] }
```

Motivul: aranjorii lucrează pe fraze; un plan explicit dă coerență globală și e afișat utilizatorului ca explicație.

**Apelul `execute`** (Faza 3a). Input: planul (dacă există), stil, intensitate și, pentru fiecare slot, lista de candidați cu id-uri și tehnici. Output:

```js
{ bars: [ { bar: 1, slot: 1, candidateId: "b1s1-orig", why: "" }, { bar: 2, slot: 1, candidateId: "b2s1-tritone", why: "Db7 for G7: melody B is the #9, and the bass walks Db-C into bar 3" } ] }
```

Regulă strictă: `candidateId` trebuie să existe; orice altceva → slotul revine la `original`. Piesele lungi (peste 32 de **sloturi**, nu de măsuri, vezi „pasul 3" mai jos) se execută pe bucăți tăiate la granițe de frază, cu contextul bucății precedente (ultimele 2 acorduri alese) ca să nu rupă continuitatea.

**Scorurile** (`scoring.js`, determinist, după `execute` și după `review`):
- `clashes`: note structurale în afara chord tones ∪ tensiuni — trebuie 0 prin construcție; > 0 e bug
- `warnings`: note pe avoid
- `bassSmoothness`: media pe piesă a mișcării basului, unde semitonul, tonul și cvinta în jos costă puțin, salturile mari costă mult
- `density`: sloturi schimbate / total, comparat cu ținta intensității: `light` ≤ 25%, `medium` 40–60%, `heavy` ≥ 60%
- `maxRun`: cea mai lungă secvență de sloturi schimbate consecutiv (penalizare peste 4 la `light`/`medium`)
- `techniqueMix`: câte tehnici distincte s-au folosit (o singură tehnică repetată de 8 ori e monoton)

Precizări din implementare (`scoring.js`): `scoreReharm(analyzedPiece, chosen, { intensity })`, unde `chosen` = `[{ bar, slot, candidate }]` cu obiectul candidatului din `candidates.js` (sloturile absente rămân `original`; o alegere pe slotul acoperit de un `coltrane` e ignorată, iar cele două sloturi ale lui contează amândouă ca schimbate). `clashes` și `warnings` se recalculează din notele-țintă contra acordului activ (`classifyPc`), nu din `warnings`-urile candidaților — inclusiv pe jumătățile unui `related-ii`. Linia de bas: nota de după `/` sau fundamentala; costul unei mișcări după intervalul cel mai mic dintre note (0–6 semitonuri): unison, semiton și cvartă/cvintă 0, ton 0.25, terță mică 0.5, terță mare 0.75, triton 1; `bassSmoothness = 1 − media costurilor` (1 pentru un singur acord). `densityTarget` e `{ min, max }`, `maxRunOk` e mereu adevărat la `heavy`, `techniques` numără pe candidat (`{ 'tritone-sub': 2 }`). `resolveChoices(piece, chosen)` (acordul activ pe fiecare slot) e exportat pentru pipeline-ul din pasul 5.

**Apelul `review`** (Faza 3b). System prompt diferit: rol de aranjor exigent care verifică lucrarea unui coleg. Input: grila originală, grila propusă cu `why`-urile, planul, scorurile și, pentru fiecare slot, aceiași candidați. Output: `{ verdict: "...", changes: [ { bar, slot, candidateId, why } ] }`, maximum 4 schimbări. Codul le aplică, re-scorează, gata — o singură rundă de review (cost și latență), fără buclă.

**Intensitate și stil** (Faza 3a ca enum-uri, Faza 5 ca fișiere JSON):
- `intensity`: `light` / `medium` / `heavy`, cu țintele de densitate de mai sus; se transmite atât în prompt, cât și ca filtru: la `light`, candidații sunt doar `original`, `tritone-sub`, `related-ii`, `quality-change`
- `style`: în Faza 3a un enum (`tritone`, `chromatic-approach`, `coltrane`, `modal`, `free`) mapat pe o listă de tehnici prioritare; în Faza 5 devine profil JSON

Precizări din implementare (pasul 4, Worker + client + prompturi):
- **Worker** (`worker/src/index.js`, config în `worker/wrangler.jsonc`): corpul cererii e `{ action, system, messages, schema?, maxTokens?, effort? }`; Worker-ul răspunde la preflight CORS, acceptă doar `POST` de pe un `Origin` din `ALLOWED_ORIGINS` (403), limitează pe `CF-Connecting-IP` cu binding-ul oficial `ratelimits` (20 pe minut, 429), respinge corpuri peste 64 KB (413) și cereri malformate (400), apoi trimite spre Messages API cu cheia din `env.ANTHROPIC_API_KEY`, `MODEL` din config (`claude-opus-5`, gândire adaptivă implicită, fără `thinking` în cerere), `max_tokens` cel din cerere (4096 când lipsește), plafonat de `MAX_TOKENS_CAP` (8192, în config și în cod), `output_config.format` = `json_schema` din `schema` și `effort` doar `low`/`medium`/`high`; răspunsul API-ului e întors ca atare, cu statusul lui. `action` e doar pentru log (JSON structurat, fără conținut). Handler-ul primește `fetch`-ul spre Anthropic ca opțiune, deci rulează integral sub `node --test` cu un `env` fals (`test/worker.test.js`). Apelul e `fetch` direct, fără SDK (decizie Edi: a doua dependență nu aducea nimic unui proxy).
- **Client** (`ai/client.js`): `createClient({ baseUrl, fetch })` → `call(action, { system, messages, schema, maxTokens, effort })` → `{ data, model, usage }` sau `AiError` cu `kind` ∈ `not-configured`, `network`, `forbidden`, `rate-limited`, `upstream`, `refusal`, `truncated`, `invalid-json`. JSON-ul e garantat de API prin structured outputs; `stop_reason: refusal` / `max_tokens` devin erori clare.
- **Prompturi** (`ai/prompts.js`): `PROMPTS.<nume> = { version, system, schema, build(input) }`, `PROMPT_VERSIONS` derivat. Schemele respectă subsetul acceptat de structured outputs: `additionalProperties: false` cu toate proprietățile `required`, `enum` permis, fără `minItems` / `minimum` / `minLength` (limitele se verifică în cod; testul `prompts.test.js` le refuză). `explain` primește acordul ca trepte → nume de note (chord tones, tensiuni, avoid), registrul și analiza a ce s-a cântat; `label` e un enum din tipurile analizorului. `execute` (folosit în pasul 5) primește tonalitatea, stilul, intensitatea cu ținta de densitate, frazele și, pe slot, originalul cu treaptă/funcție/cadență, notele-țintă cu relația lor și candidații `{ id, chords, technique, spans?, avoidWarnings? }`.
- **Explain** (`ai/explain.js`): o sugestie e acceptată doar dacă are ≥ 2 note în registru (E2–A4), nu e ce s-a cântat, nu e duplicat, trece prin `analyzeVoicing` fără niciun `warning` (missing / wrong / avoid / muddy) și tipul detectat e exact `label`-ul promis — DoD-ul (1) al Fazei 3a, ca test. Sugestiile respinse se afișează cu motivul. `effort` implicit `low`, `maxTokens` 4096.
- **UI**: URL-ul proxy-ului e o setare persistată (`proxyUrl`, doar `http(s)`; gol = funcția e oprită); buton „Ask Claude" / tasta A în drill, sugestiile cu Play sau tastele 1 / 2, conturate pe claviatură; blocul rămâne pe ecran la aceeași acord, ca voicing-ul cântat să fie comparat cu eticheta.

Precizări din implementare (pasul 5, pipeline-ul `execute`):
- **`ai/pipeline.js`**: `reharmonize(client, piece, { style, intensity, maxPerSlot, maxTokens, effort, candidates })` → `{ analyzed, candidates, slots, chosen, scores, grid, originalGrid, gridParses, issues, problems, repairs, model, usage, promptVersion }`. Un id scurtat de model (`b2s1-Ab7` în loc de `b2s1-chromatic-approach-Ab7`) se recuperează după simbolurile acordului, dacă exact un candidat al slotului le are: garanția rămâne intactă, pentru că acordul tot din meniu vine. Recuperările intră în `repairs`, nu în `problems` (semnal pentru evaluarea din Faza 5). Opțiunea `candidates` înlocuiește meniul generat (o folosește lock & regenerate din Faza 5 și testele). Singurul motiv de respingere a promisiunii e eroarea de apel; tot ce greșește modelul intră în `problems` și costă slotul, nu rularea: id inexistent, slot răspuns de două ori, intrare fără coordonate, slot inexistent, alegere pe un slot deja acoperit de un candidat pe două sloturi.
- **Plasa de siguranță** (`piece.js`): `checkMelody(piece, sequence)` verifică fiecare notă-țintă contra acordului care sună sub ea și e acum **singura** sursă de adevăr (o folosește și `scoring.js`, care nu-și mai ține propria copie); `validateReharm(piece, slots)` → `{ issues, warnings, rejects, ok }`, unde o notă avoid e warning, iar o notă „outside" respinge slotul care a pus acordul acolo **și** sloturile acoperite de el. Pipeline-ul scoate alegerile respinse, re-rezolvă și abia apoi calculează scorurile, deci scorul descrie mereu grila afișată.
- **Înapoi în text**: acordurile dintr-o măsură de grilă împart măsura egal, deci pipeline-ul le desfășoară la cea mai grosieră diviziune care le cuprinde onset-urile (1, 2 sau 4 în 4/4; 1 sau 3 în 3/4) — o măsură cu Dm7 la 1, Dm7 la 3 și G7 la 4 se scrie `| Dm7 Dm7 Dm7 G7 |`. Dacă un acord cade între diviziuni (related-ii în 3/4 ar pica pe timpul 2,5), grila nu se poate scrie ca text: `gridParses: false`, iar butonul „Practise the reharm" e dezactivat cu explicație.
- **UI**: tab nou **Reharm** (decizie Edi), care ia piesa curentă din Progression (grilă + melodie înregistrată; fără melodie spune explicit că orice acord se potrivește). Stil și intensitate ca liste, buton Reharmonize, cele două grile una sub alta cu măsurile schimbate evidențiate (galben = notă avoid, roșu = respinsă de validator), `why` la hover și la click, scorurile pe un rând, problemele ca listă. A/B: „Practise the original" / „Practise the reharm" scriu grila aleasă în caseta din Progression și comută acolo, cu melodia neatinsă (decizie Edi).

Precizări din implementare (Faza 3b, pasul 2, `plan` și `review`; decizii Edi: review-ul care strică o țintă se anulează, bifa e activă implicit):
- **`plan`** (prompt v1): primește tonalitatea, stilul, intensitatea cu ținta de densitate și, pe frază, sloturile cu analiza lor (fără meniu) plus **tehnicile pe care meniul frazei le are efectiv**, în ordinea stilului. Răspunde `{ phrases: [{ bars, strategy, techniques }] }`. Codul păstrează doar frazele piesei, o dată fiecare, cu cel mult 3 tehnici din lista frazei; restul intră în `problems` cu `stage: 'plan'`. Un plan refuzat, trunchiat, stricat sau cu eroare de server nu oprește rularea (acordurile se aleg fără plan); o eroare de rețea, 403, 429 sau lipsa proxy-ului o oprește, pentru că și apelul următor ar cădea. `execute` (prompt v3) primește planul verificat și e rugat să-l urmeze, cu ținta de densitate și limita de run neschimbate.
- **`review`** (prompt v1, system prompt separat, „aranjor exigent"): primește grila originală și ciorna, scorurile ciornei (densitate cu ținta, `maxRun` cu limita, bas, mix de tehnici, note avoid), planul și, pe slot, alegerea ciornei cu `why`-ul ei (sau `coveredBy`) plus același meniu. Răspunde `{ verdict, changes }`; codul citește doar primele **4** intrări, le verifică la fel ca pe cele din `execute` (id din meniu, recuperare după simboluri, fără dubluri), le aplică peste ciornă (id-ul `-orig` pune originalul înapoi), validează și scorează din nou. **Garda**: dacă ciorna atingea o țintă și review-ul o strică (densitatea iese din țintă, un run trece de 4 sub `heavy`, cresc notele avoid), review-ul se anulează **întreg**, cu motivul afișat. Basul și mixul de tehnici sunt gust, deci review-ul le poate schimba. Un review eșuat, din orice motiv de apel, lasă ciorna (apelul `execute` e deja plătit); o eroare de cod (nu `AiError`) se propagă.
- **Rezultatul** `reharmonize` are în plus `plan`, `draft: { chosen, scores, grid }`, `review: { verdict, changes: [{ bar, slot, from, to, why }], undone }` sau `null`, `revised` pe fiecare slot, `calls` (acțiune, model, usage, versiunea promptului, durata), `usage` însumat și `promptVersions`; fiecare problemă are `stage`. Opțiunile `plan` și `review` (implicit `true`) și `onStep(step)`, chemat înaintea fiecărui apel.
- **UI**: bifa „plan & review" în tab-ul Reharm (setarea `planReview`, implicit activă; debifată = doar `execute`, ca în 3a); stadiul rulării cu secundele scurse; planul pe fraze deasupra grilelor; scorurile finale și, când review-ul a schimbat ceva, cele dinainte; verdictul (sau motivul anulării); măsurile schimbate de review cu contur punctat violet, motivul lor la click.
- **Măsurarea** (`eval/compare.js`, sămânța lui `eval/run.js`): rulează aceeași piesă (`eval/pieces/study-in-f.json`, 16 măsuri scrise pentru teste, deci fără drepturi) de N ori prin fiecare pipeline, alternat, și scrie media și intervalul pentru bas, mix de tehnici, densitate, clash-uri, timp și cost, plus ciorna dinaintea review-ului; fiecare rulare ajunge în `eval/reports/` ca JSON. Rulare: `node eval/compare.js --runs 3`, cu Worker-ul local pornit.

Precizări din implementare (Faza 3b, pasul 3, piesele lungi pe bucăți; decizii Edi din 2026-09-19: limita pe sloturi, aceeași țintă de densitate pe fiecare bucată, review-urile în paralel cu garda pe piesa întreagă, o bucată eșuată rămâne pe original):
- **De ce**: măsurat pe `study-in-f` repetată, corpul cererii `execute` are 24 KB la 17 sloturi, 46 KB la 34 și 89 KB la 68, iar Worker-ul refuză peste 64 KB (413); cererea de `review` e cu ~13% mai mare. Deci limita ține de sloturi, nu de măsuri: o piesă de 32 de măsuri cu două acorduri pe măsură (64 de sloturi) pica deja. Nici răspunsul nu scala: `execute` scrie 1,3–1,7 mii de tokeni pe 17 sloturi, deci ~6 mii pe 68, aproape de plafonul de 8192. Limita Worker-ului rămâne 64 KB: protejează cheia pe Worker-ul public.
- **`splitIntoParts(analyzed, candidates)`** (`ai/pipeline.js`, pur, exportat): până la `MAX_PART_SLOTS` = 32 de sloturi, o singură bucată cu exact meniul primit, deci o piesă scurtă face apelurile de dinainte (măsurătoarea din pasul 2 rămâne valabilă). Peste, frazele se împachetează în cele mai puține bucăți care încap, cu capacitatea cea mai mică ce păstrează acel număr, ca bucățile să iasă egale: 36 de sloturi în fraze de 4 dau 20 + 16, nu 32 + 4. O frază care singură trece de limită se taie la graniță de măsură. Un candidat pe două sloturi (Coltrane) care ar trece în bucata următoare iese din meniul bucății și, prin asta, și din tehnicile oferite planului pentru fraza lui. Cel mai rău caz măsurat (64 de măsuri, două acorduri pe măsură, meniuri pline, 4 bucăți): 22 KB `plan`, 43 KB `execute`, 47 KB `review`; un test verifică fiecare cerere contra `MAX_BODY_BYTES`, din `worker/src/limits.js`. Nu din `index.js`: workerd citește fiecare export numit al modulului principal ca punct de intrare și refuză să pornească pe o constantă (găsit la prima pornire după schimbare; un test din `test/worker.test.js` păzește acum exporturile).
- **`plan`**: rămâne un singur apel pe toată piesa (nu primește meniul); plafonul lui de ieșire e acum tot `maxTokens` (8192), nu 4096, pentru că la 16 fraze planul ar fi putut ieși trunchiat (0,7–1,1 mii de tokeni pe 4 fraze).
- **`execute`** (prompt v4): câte un apel pe bucată, **în ordine**. Fiecare primește doar sloturile, frazele și intrările de plan ale bucății, plus `part`: `{ index, of, bars, tuneBars, previousChords, changedInARowBefore }`. `previousChords` = ultimele 2 acorduri care sună înaintea bucății, cum au fost alese (`{ bar, beat, chord, technique }`); `changedInARowBefore` = câte sloturi schimbate la rând încheie bucata precedentă, ca limita de 4 să țină peste graniță. Ținta de densitate e aceeași pe fiecare bucată: dacă fiecare e în țintă, și piesa e (media ponderată nu iese din interval), iar o țintă mutată după bucățile anterioare ar putea cere ultimei ceva imposibil. Analiza, candidații, validarea și scorurile rămân pe piesa întreagă. La o singură bucată, `part` lipsește din input.
- **Erorile la `execute`**: rețea, 403, 429 sau lipsa proxy-ului opresc rularea, ca înainte. O bucată refuzată, trunchiată sau stricată rămâne pe original, cu o problemă `stage: 'execute'` care îi numește măsurile, și rularea continuă cu contextul originalelor. Rularea pică doar dacă pică toate bucățile; la o singură bucată, orice eroare o oprește, ca înainte.
- **`review`** (prompt v2): câte unul pe bucată, cu cel mult 4 schimbări fiecare, toate trimise deodată (`Promise.all`), pentru că citesc aceeași ciornă terminată și ating sloturi diferite. Fiecare primește sloturile, meniul și planul bucății, `part: { index, of, bars, tuneBars }`, grilele (originală și ciorna) **întregii piese** și scorurile întregii piese. Rămâne o singură rundă: fiecare slot e revăzut o dată. Garda se aplică pe rând, în ordinea bucăților, pe scorurile piesei întregi: review-ul unei bucăți se anulează întreg dacă strică o țintă pe care piesa, așa cum au lăsat-o review-urile dinainte, o atingea. Un review eșuat lasă ciorna pe bucata lui.
- **Rezultatul**: `parts` (intervalul de măsuri al fiecărei bucăți); la mai multe bucăți, `review.parts` = `[{ bars, verdict, changes, undone }]` (schimbările propuse, și cele anulate, pentru istoric), `review.verdict` = verdictele cu măsurile lor, `review.changes` = doar schimbările care rămân, `review.undone` = `null` (anularea e pe bucată). `calls` are `part` pe fiecare apel de bucată. `onStep(step, info)`: `info` e `null` la o singură bucată, `{ part, parts, bars }` înaintea fiecărui `execute` și `{ parts }` înaintea review-urilor.
- **UI**: stadiul numește bucata („bars 25–44 (part 2 of 3)") și spune că review-urile merg deodată; verdictul apare pe bucăți, fiecare cu rezultatul lui.
- **Măsurarea** (`eval/reports/compare-2026-09-19T16-37-52-096Z.json`): `eval/pieces/study-in-bb-aaba.json`, studiu original de 64 de măsuri AABA în Bb, 73 de sloturi, 3 bucăți (1–24, 25–44, 45–64), tritone / medium, 3 rulări pe mod. Toate 6 rulările: 0 clash-uri, densitatea în țintă (41–47%), `maxRun` 1–3, nicio cerere refuzată sau trunchiată, nicio problemă (două id-uri scurtate, recuperate). Bas **0,90** (0,89–0,91) cu plan + execute + review față de **0,84** (0,83–0,84) cu execute singur; mix de tehnici **4,67** (4–5) față de **3,67** (3–5); ca la 16 măsuri, câștigul vine din plan (ciorna are deja 0,90 și 4,67), review-ul schimbă 1–3 sloturi pe rulare și o dată a fost anulat de gardă pe o bucată (densitate). Timp: execute singur ≈ 82 s (3 apeluri în serie, ≈ 25 s fiecare), complet ≈ 156 s (plan ≈ 30 s, execute ≈ 79 s, review-urile în paralel ≈ 46 s în loc de ≈ 113 s una după alta). Cost: ≈ 0,41 $ execute singur, ≈ 1,00 $ complet; măsurarea întreagă 4,23 $. Ieșire: `plan` 2,0–2,4 mii de tokeni pe 16 fraze, `execute` 1,9–2,8 mii pe bucată, `review` 1,5–4,2 mii, toate sub 8192. **Granițele**: 24 → 25 e curată în toate rulările (F7 sau B7 → Bbmaj7, semiton sau cvintă); 44 → 45 e Gb7 → Cm7, triton în bas, în toate 6 — dar nu din cauza graniței: planul, care vede toată piesa, a cerut Gb7 pe măsura 44 în toate 3 rulările, cu justificări greșite („alunecă Gb-F în următorul ii-V", „coboară un semiton în Cm7-ul următor"), iar review-ul, care vede toată grila, l-a lăudat. E o greșeală a modelului la intervalul basului pe II7 → ii7; codul o vede (costul 1 din scorul de bas), modelul nu primește `bassStepToNext` în meniu. De reluat în Faza 5, dacă reharm-ul revine: `bassStepToNext` în meniul din prompt.

### 4. Validarea (`piece.js`, deterministă, plasă de siguranță)

Rulează pe rezultatul final, indiferent de sursă (pipeline, editare manuală, import): pentru fiecare notă structurală, acordul activ pe acel beat:
- în chord tones ∪ tensiuni disponibile → **ok**
- în lista de avoid → **warning** (galben, măsura rămâne)
- altfel → **reject**: slotul revine la original, marcat roșu, cu motivul afișat. Cu candidați generați corect, cazul nu ar trebui să apară — dacă apare, e un test de scris.

### 5. Realizarea (`realize.js`, Faza 3b, deterministă)

Grila validată devine un aranjament cântabil pe Genos: pentru fiecare slot, bas (fundamentala sau nota de după `/`), voicing de mână stângă ales din biblioteca analizorului (rootless A/B, drop 2, shell, cvartal) prin căutarea celui mai apropiat de voicing-ul precedent (aceeași funcție de voice leading din `analyzer.js`), în registrul E2–A4 (planul zicea E2–C4, dar rootless A/B standard pe Cmaj7 sunt E3 G3 B3 D4 și B3 D4 E4 G4, iar cu o octavă mai jos cad sub low interval limits; registrul e configurabil în `suggestVoicings`) cu respectarea low interval limits, și melodia deasupra. Sugestiile din Faza 2 (`voicings.js`) folosesc deja aceste reguli: șabloane rootless A/B (sloturile de 9 și 13 rezolvate după acord: b9/b13 pe dominantele alterate), shell, drop 2 în toate inversiunile, cvarte suprapuse; fiecare candidat trece prin analizor fără avertismente; ordonare: aceeași textură (număr de note) ca voicing-ul precedent, apoi deplasare minimă, apoi tipul. Output: secvență de evenimente MIDI cu timp, redată de `output.js` sincron cu metronomul. Butoane A/B: original / reharm.

Precizări din implementare (Faza 3b, pasul 1; decizii Edi: aranjamentul întâi, bas ținut, trei canale, fără dublarea melodiei):
- **`theory/realize.js`**: `realize(piece, { register, bassRegister, melodyGap, velocity })` → `{ events: [{ beat, duration, part, midi, velocity }], voicings: [{ bar, beat, symbol, notes, type, doublesMelody, reason }], totalBeats }`, cu timpul în timpi de la primul downbeat (independent de tempo). **Basul**: fundamentala sau nota de după slash, ținută pe durata acordului și reluată la fiecare schimbare, într-o singură octavă, deci fiecare notă are un singur loc (linia sare o septimă doar la trecerea D#→E): implicit E1–D#2, unde stă un contrabas, cu A1–G#2 și E2–D#3 ca opțiuni în Settings → Arrangement (`BASS_REGISTERS`, setarea `bassRegister`). **Mâna stângă**: începe mereu deasupra basului și niciodată la un interval „muddy" de el (aceleași low interval limits ale analizorului, aplicate perechii bas–nota de jos a mâinii stângi); dintre voicings preferă **întâi textura plină** (4 note), apoi mișcarea minimă față de precedentul — altfel un shell forțat de un loc strâmt se lipea de toate acordurile următoare, pentru că sugestiile din drill păstrează textura precedentă; voicing-ul e ținut pe acord; vârful stă sub cea mai joasă notă a melodiei care sună peste acord (`melodyGap` 1 = nu atinge și nu trece melodia); dintre variante o alege pe cea care **dublează cele mai puține clase de note ale melodiei**, apoi după voice leading — deci când o notă e inevitabilă (F-ul din G7 sub o melodie F), le evită totuși pe celelalte; `doublesMelody` spune când a rămas o dublare. Dacă nimic nu încape sub melodie, mâna stângă tace pe acel acord, cu motiv, iar basul și melodia merg mai departe. **Melodia**: exact cea înregistrată. Pe un ii–V–I fără melodie iese forma A / B / A clasică (Dm7 F A C E, G7 F A B E, Cmaj7 E G B D).
- **`midi/player.js`**: `arrangementMessages(events, { tempo, startMs, channels, parts })` → `[{ time, data }]`, pur; la același moment note-off vine înaintea note-on, ca o notă repetată să fie reatacată. Canale implicite: melodie 1, mâna stângă 2, bas 3, schimbabile din Settings („Arrangement channels"); pe Genos fiecare canal primește vocea lui. Vocile se pot opri separat din tab-ul Reharm (bife persistate), deci Edi poate compa singur peste bas și melodie.
- **Redarea**: `output.sendScheduled` trimite mesajele cu marcaj de timp Web MIDI (livrarea e treaba browserului, nu a timerelor JS), `output.silence(channels)` golește coada portului (`clear()`) și trimite All Notes Off pe fiecare canal; `metronome.performanceTimeOf(bar, beat)` e inversul lui `positionOf`, ca mesajele să cadă pe grila metronomului, după o măsură de numărătoare. Tempo-ul e cel din tab-ul Progression. În timpul redării, statusul arată măsura și timpul, iar claviatura aprinde voicing-ul mâinii stângi; la sfârșitul piesei, la Stop sau la schimbarea tab-ului, redarea se oprește curat. `reharmonize` întoarce acum și `reharmonized`: piesa cu acordurile alese la onset-urile lor reale (nu desfășurate ca în textul grilei) și melodia neatinsă, adică exact ce cântă „Play reharm".

### 6. Partener de studiu (Faza 5)

- **Lock & regenerate**: utilizatorul blochează măsurile care-i plac; la regenerare, sloturile blocate au un singur candidat (cel ales), restul se rezolvă normal.
- **Cereri pe măsură**: „darker", „simpler", „delay the resolution" — text liber atașat slotului, transmis în `execute` ca `hint`; codul nu îl interpretează, doar îl trimite.
- **Explain**: click pe orice acord → un apel `explain` cu analiza slotului și `why`-ul, răspuns în 2–3 propoziții.
- **Guess mode**: aplicația ascunde alegerea AI-ului pe o măsură, utilizatorul cântă ce ar pune el, analizorul identifică acordul cântat și îl compară cu candidatul ales (aceeași tehnică? aceeași fundamentală?).

### 7. Stiluri ca date și evaluarea (Faza 5)

Profil de stil (`styles/tritone.json`, exemplu):

```js
{ name: "tritone", techniques: { "tritone-sub": 1.0, "related-ii": 0.7, "quality-change": 0.5, "chromatic-approach": 0.3 }, maxDensity: 0.5, maxRun: 3, rules: ["Only substitute dominants that resolve", "Never change the first chord of a phrase"] }
```

`techniques` ordonează candidații și intră în prompt ca priorități; `rules` intră în prompt ca text. Profilurile noi se creează din UI și se pot exporta.

Few-shot cu reharm-urile proprii: perechi `{ original, reharm, notes }` salvate local (nu în repo, decât dacă piesa e din domeniul public); la `execute` se atașează maximum 2 exemple din același stil. Așa modelul învață gustul lui Edi, iar perechile sunt și material de studiu.

Evaluare: `eval/pieces/*.json` — 6–10 piese scurte din domeniul public (compozitor decedat de peste 70 de ani; verificat înainte de commit) cu melodie și grilă; `eval/run.js` rulează pipeline-ul pe toate cu un stil și un `PROMPT_VERSION` dat și scrie un raport cu metricile din `scoring.js`. Rating-urile utilizatorului (sus/jos pe fiecare măsură, în UI) se salvează local cu `PROMPT_VERSION` și stil, exportabile ca JSON. Regula: orice schimbare de prompt sau de profil se rulează pe setul de evaluare înainte de commit; dacă `clashes` > 0 sau `density` iese din țintă, nu se commit-uie.
