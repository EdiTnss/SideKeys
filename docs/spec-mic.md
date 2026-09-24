# SideKeys — spec-mic.md

Prototipul de intrare pe microfon: ce s-a măsurat, cum, ce a ieșit și de ce ne
oprim. Punctul e din P0 ([docs/PRODUCT.md](PRODUCT.md)): *„Prototip de intrare pe
microfon cu `basic-pitch-ts`, măsurat pe 20 de voicings. Prag de acceptare: peste
90% identificate corect **cu octava exactă**."* Codul stă în `mic-proto/`, în afara
lui `src/`, și nu se leagă la aplicație.

**Verdict (2026-09-24): nu trece. 45% pe cele 20, cu tavan de 72% pe 93.** Modul
microfon din P4 rămâne închis până când modelul se schimbă, nu regula de citire.

## Ce e biblioteca

`@spotify/basic-pitch` 1.0.1 (repo `spotify/basic-pitch-ts`), Apache-2.0, publicat
2022-08-05, ultimul push în repo 2023-05-23. Dependențe: `@tensorflow/tfjs ^3.2.0`
(instalat 3.21.0) și `@tonejs/midi`. Modelul are **16.782 de parametri**, 725 KB de
greutăți plus 170 KB de `model.json`, și vine în pachet.

Trei lucruri verificate în sursă, pentru că au decis designul:

- `evaluateModel` acceptă `AudioBuffer` **sau `Float32Array`**, deci măsurătoarea
  rulează în Node, fără `tfjs-node` (care ar cere build nativ pe Windows). WAV-ul
  se citește de mână, în `wav.js`, fără nicio dependență în plus.
- Modelul se încarcă din fișierele locale prin un `IOHandler` scris de noi
  (`model.js`): build-ul de browser al TensorFlow.js aduce modele prin HTTP și nu
  are handler de `file://`. `tfjs` 3.21 pornește curat pe Node 24 și înregistrează
  doar backend-ul `cpu`.
- Ieșirea brută e disponibilă: `frames` are 88 de înălțimi de la MIDI 21, la ~86
  de cadre pe secundă (22050/256), deja tăiată de suprapuneri și aliniată la
  începutul audio-ului. Deci nu suntem obligați să trecem prin detectorul de note
  al bibliotecii — pentru un acord ținut, întrebarea nu e „unde începe fiecare
  notă", ci „ce sună în secunda asta".

Așteptarea, dinainte de măsurătoare: lucrarea modelului (ICASSP 2022,
arXiv:2203.09893) raportează pe MAESTRO, pian solo, **F-measure pe note 70,9%**,
față de 95,2% pentru „Onsets and Frames", modelul specializat pe pian. Pragul
nostru e mai sever decât un F-measure, fiindcă cere **tot** setul exact: dacă
erorile pe note ar fi independente, 0,709 la a patra ≈ 25% din voicings de 4 note.
Ca să treci de 90% pe patru note ai nevoie de ~97,4% pe fiecare notă.

## Cum s-a măsurat

### Corpusul nu e inventat

Cele 93 de voicings sunt **ce a cântat Edi pe Genos pe 2026-09-19**, reconstruite
din `harness/sessions/genos-2026-09-19-drill-blues-rhythm.json`: timpii reali de
atac, velocitățile reale (20–55; Edi cântă încet), simbolul acordului și verdictul
pe care aplicația l-a dat atunci. Adevărul de referință vine din MIDI, cu octava
exactă, deci nu poate conține greșeli de transcriere. Corpusul: 2–9 note (cele mai
multe 5–7), registru MIDI 29–72, 15 simboluri, 14 cu probleme în verdict.

`corpus.js` reconstruiește perechile note-on/note-off cu velocitate, apoi pentru
fiecare snapshot ia notele care erau apăsate când a tras debounce-ul. Un voicing
incomplet (o notă din snapshot care nu se regăsește pe bandă) e sărit.

### Împărțirea s-a fixat înainte

10 voicings pentru reglarea pragurilor, **20 pentru cifra de poartă**, restul
extra. Stratificat pe număr de note, determinist, cu duplicatele scoase (Edi a
repetat voicings în drill; sinteza e deterministă, deci un set repetat ar fi
răspuns la fel de două ori și ar fi irosit un loc). Împărțirea stă în
`corpus.json`, scrisă înainte de orice măsurătoare — altfel cifra e reglată pe
propriul ei set de test și nu înseamnă nimic.

### Sunetul: sinteză, apoi drum acustic simulat

`synth.js` sintetizează un ton de pian scris de la zero: parțiale inarmonice
(`f_k = k·f0·√(1+B·k²)`), parțialele înalte mor mai repede, atac de 4 ms, iar
velocitatea schimbă și strălucirea, nu doar amplitudinea. Redă **gestul**, nu un
acord-bloc: fiecare voce își păstrează atacul, eliberarea și velocitatea.

Măsurat pe drum, cu implicații: timbrul bogat (14 parțiale, inarmonic) iese **mai
bine** decât unul curat cu 3 parțiale. Modelul e antrenat pe instrumente reale, iar
un ton aproape sinusoidal e în afara distribuției — deci „curat" nu e un caz mai
ușor, e un caz mai străin.

`degrade.js` adaugă drumul acustic, ca filtre fixe (o măsurătoare trebuie să se
repete): reflexii de cameră (IR rar, RT60 0,45–0,7 s), tăierea de bas a unui
microfon de laptop (trece-sus 110–190 Hz, 2 poli), trece-jos 7–9 kHz, zgomot roz
plus brum de 50 Hz la 24–34 dB SNR. Trei lanțuri: `direct` (fără nimic), `laptop`,
`harsh`.

### Fereastra de citire

De la ultimul atac plus 120 ms, până la o secundă mai târziu, dar niciodată după
prima eliberare (minim 200 ms). Adică regimul stabilizat al acordului, cu toate
notele apăsate — ~86 de cadre de dovadă pentru **același** set de note.

### Patru cititoare și un oracol

| cititor | regula |
|---|---|
| `flat @t` | media activării pe fereastră ≥ t |
| `gap` | cea mai mare cădere relativă în lista sortată descrescător (peste un prag-plafon de 0,12) |
| `cliff` | **prima** cădere de cel puțin ×1,35, nu cea mai mare |
| `tracker` | `outputToNotesPoly` + `noteFramesToTime` ale bibliotecii, notele care sună la mijlocul ferestrei |
| `oracle` | **nu e cititor, e tavanul**: există *vreun* prag care întoarce exact notele cântate? |

Oracolul e metrica ce decide dacă mai merită reglaj: dacă el nu poate, nicio regulă
în formă de prag nu poate, și lipsa e în model. Toate cititoarele văd aceeași
inferență — modelul e partea scumpă (~3 s pe fereastră de 2 s, pe backend-ul `cpu`
în JS pur), citirea nu — deci o măturare de praguri costă o singură inferență.

Metricile: potrivire exactă de set cu octava (**poarta**); dacă verdictul
aplicației s-ar fi schimbat (`analyzeVoicing` pe ambele seturi, comparat prin
`verdictOf`); plus diagnostice — precizie și recall pe note, alunecări de octavă,
note fantomă, defalcare pe număr de note.

## Cifrele

Pragul s-a fixat pe cele 10 de reglaj **înainte** de a atinge poarta:
`flat @0.4` (80% pe reglaj, față de 40% la 0,5 și 40% la 0,3).
`report-tune-thresholds.json`.

**Poarta, 20 de voicings** (`report-gate.json`):

| | 3–4 note | 5–6 note | 7+ note | total | verdict identic |
|---|---|---|---|---|---|
| `laptop`, `flat @0.4` | 67% (4/6) | 56% (5/9) | **0%** (0/5) | **45%** (9/20) | 50% |
| `harsh`, `flat @0.4` | 67% | 56% | 0% | 45% | 50% |
| `direct`, `flat @0.4` | 83% | 11% | 0% | 30% | 45% |
| oracol (`laptop`) | | | | 60% (12/20) | — |
| `tracker` (`laptop`) | | | | 30% (6/20) | 45% |

**Tot corpusul, 93 de voicings, lanțul `laptop`** (`report-all-laptop.json`):

| cititor | exact | verdict identic | recall | precizie |
|---|---|---|---|---|
| `gap 0.12` | 51% (47/93) | 59% | 92% | 96% |
| `cliff 0.12` | 44% (41/93) | 52% | 88% | 97% |
| `flat @0.4` | 43% (40/93) | 51% | 87% | 99% |
| `tracker` | 25% (23/93) | 46% | 86% | 95% |
| **oracol** | **72% (67/93)** | 72% | — | — |

Pe număr de note, cu `gap`: **3–4 note 76% (16/21)**, 5–6 note 54% (25/46),
**7+ note 23% (6/26)**.

Cifra de poartă rămâne **45%**: pragul a fost fixat înainte. Că `gap` iese mai bine
pe 93 (51%) e o alegere făcută **după** ce am văzut datele, deci optimistă — și e
totodată o lecție despre reglat pe 10 exemple: pe setul de reglaj, `flat @0.4`
părea cel mai bun cititor.

## De ce nu se repară cu o regulă mai bună

Trei observații din profilurile de activare (`inspect.mjs`), nu din totaluri:

1. **Eșecul e „note lipsă", nu „note inventate".** Precizia stă la 96–99%.
   Modelul aude mai puține voci decât s-au cântat.
2. **Nu există prag fix bun.** Notele cântate ocupă primele ranguri și apoi lista
   cade, dar înălțimea căderii se mută de la acord la acord: la un Cmaj7 de 6 note
   ultima notă reală stă la 0,468, la un F7 de 7 note la 0,218, iar prima fantomă
   din alt acord stă la 0,326. Orice valoare fixă taie greșit undeva.
3. **Cazul care omoară ideea.** La un F7 de 7 note cu octave duble (Eb3+Eb4,
   A3+A4), octavele superioare **reale** vin la 0,22–0,29, mai slabe decât
   fantomele de octavă din alte acorduri (0,26–0,33). Dovada pentru o octavă reală
   slabă și pentru una fantomă e identică în ieșirea modelului. Iar octavele duble
   sunt normale într-un voicing de jazz cu două mâini, deci nu e un caz marginal.
   Tăierea fantomelor pe criteriu armonic ar fi ucis note reale — verificat pe
   cazuri concrete înainte de a renunța la ea.

Și oracolul confirmă de unde vine lipsa: **72%** pe 93. Restul de 28% sunt voicings
în care modelul n-a raportat deloc notele lipsă, la nicio valoare de prag.

## Argumentul de produs

Mai tare decât procentul: modul de eșec e exact cel mai prost pentru poziționarea
din `PRODUCT.md` („profesorul care îți spune ce ai greșit la mâini"). Aplicația nu
ar spune „n-am auzit bine" — ar spune **„îți lipsește cvinta"** unui pianist care a
cântat-o. Verdictul s-ar schimba la jumătate din acorduri (51–59% identic). Un
microfon care tace e mai bun decât unul care se înșală cu încredere.

## Limita a măsurătorii, spusă explicit

Timbrul e sintetizat, nu înregistrat, iar drumul acustic e simulat, nu real. Un
pian eșantionat prin boxele Genos-ului (care are și compresie proprie) ar putea ieși
mai bine decât sinteza — dovada că distribuția contează e chiar diferența
„curat" / „bogat" de mai sus. **Decizie Edi, 2026-09-24**: scriem verdictul acum și
nu mai investim 10 minute de Genos ca să-l confirmăm, fiindcă distanța până la 90%
e prea mare ca s-o acopere timbrul: de la 45% (sau 51%) la 90%, cu tavan de 72%
peste tot ce poate face un prag.

Infrastructura rămâne în repo. Dacă vreodată se reia, drumul cel mai scurt e:
`node measure.js --set gate --chain laptop`, plus etapa 1 din design — o pagină care
deschide microfonul și portul MIDI în același timp, cu referința venită din MIDI, și
cu `echoCancellation`, `noiseSuppression` și `autoGainControl` **oprite**
(pornite, Chrome procesează semnalul pentru voce și taie exact conținutul armonic
care se măsoară).

Ce ar schimba răspunsul, în ordinea plauzibilității: un model specializat pe pian
(„Onsets and Frames" dă 95,2% pe note față de 70,9%, deci acolo e saltul); un model
instrument-agnostic mai nou decât 2022; sau restrângerea produsului la voicings de
3–4 note, unde am măsurat 76% — tot sub prag, dar altă discuție.
