# SideKeys — DIRECTION.md

Noua direcție de produs, discutată și stabilită de Edi cu Claude pe 2026-10-11. Aici e ce
s-a hotărât, de ce, și ce rămâne de decis.

## Cum se citește acest fișier (pentru Claude Code)

- **Prioritatea dintre documente.** Pe 2026-10-11, după ce Edi a aprobat textul propus, direcția
  a intrat în `docs/PRODUCT.md` și în `CLAUDE.md`. De atunci **acest fișier nu mai câștigă la
  contradicție**: `PRODUCT.md` e sursa de adevăr pentru scop, iar aici rămân consemnarea deciziei
  (de ce arată produsul așa), mecanicile de joc, ecranele și deciziile încă deschise. Dacă găsești
  o contradicție între ele, e o scăpare de-a noastră: semnaleaz-o, nu alege singur.
- **Ce rămâne neschimbat.** Regulile de colaborare din `CLAUDE.md` rămân valabile: partener, nu
  aprobare reflexă; întrebare la ambiguitate; confirmare înaintea pașilor mari. La fel rămân
  convențiile de teste, harness, jurnal și commit-uri.
- **Nicio schimbare în repo fără aprobarea lui Edi.** Se propune conținutul și se așteaptă
  răspunsul.

## Decizii luate (2026-10-11)

1. **Publicul: un singur produs, cu un singur drum, de la începător la jazz.**
   - Nu „pian pentru începători", ci **cântatul din acorduri**. Utilizatorii vizați sunt
     clapiștii de trupă, pianiștii de biserică/worship, cei care acompaniază vocea și cei
     care vor să cânte din lead sheet. Jazzmanul serios rămâne în public.
   - Începătorul intră la nivelul 1 (triade).
   - Avansatul face un **test de plasare de ~60 de secunde** și sare direct la unitatea lui.
   - Nu facem două produse.
2. **Tonul vizual: instrument premium gamificat**, în stilul lui Melodics, nu un Duolingo jucăuș.
   - Rămâne întunecat și elegant, dar cu feedback cald și animat: clape care se aprind,
     combo, stele.
   - Jazzmanul nu trebuie să se simtă tratat ca un copil.
   - **Fără mascotă**; regula din `assets/BRAND.md` rămâne.
3. **Livrarea: un singur cod, ambalat în patru forme, în ordinea asta:**
   1. **Web**, pe `sidekeys.app`: ușa din față, fără fricțiune, cu link-uri partajabile.
   2. **PWA instalabilă** din Chrome/Edge: fereastră proprie fără bară de adresă, icon în
      Start/taskbar, offline. Rezolvă „aspectul neprofesional" fără costul unui installer.
   3. **Desktop (Electron sau Tauri)**, doar când îl cer utilizatorii plătitori sau dacă vrem
      Microsoft Store / Steam ca canal de distribuție.
   4. **iPad**, prin shell nativ (Capacitor) cu MIDI nativ. Safari nu are Web MIDI, deci
      ăsta e singurul drum spre iPad.
4. **Gamificarea devine nucleul experienței**, nu un strat lipit deasupra. Ordinea de
   construcție e obligatorie:
   1. bucla de bază să fie plăcută în sine;
   2. apoi structura (drum, unități, nivele);
   3. abia apoi meta-jocul (XP, streak).
5. **Shell nou cu framework**: Vite + TypeScript + React sau Svelte (alegerea e deschisă, vezi
   mai jos). `render.js` scris de mână nu poate duce animații, rutare și multe ecrane.
6. **Reharm-ul revine ca puzzle determinist, fără apel AI.**
   - Exemplu de nivel: „găsește un tritone sub care merge peste melodia asta".
   - Răspunsul se validează în `candidates.js` + `piece.js`.
   - Pipeline-ul AI (`ai/pipeline.js`) rămâne dovadă tehnică, cum era.

## Ce NU se schimbă, chiar și în direcția nouă

- **`src/theory/**` rămâne JS pur, fără DOM, fără dependențe, testat cu `node --test`.**
  - Nu e birocrație. Tot pe el stau exercițiile generate procedural, scorurile deterministe
    (stele, XP) și verificarea anti-trișat a rezultatelor de clasament pe server, cu același cod.
  - Shell-ul nou importă `theory/` neatins.
- **Culorile de teorie și regula de accesibilitate** din `styles.css` și `BRAND.md`:
  - accentul magenta nu apare niciodată pe o clapă sau într-un verdict;
  - culorile de verdict nu se schimbă.
- **Pragul de feedback de sub 100 ms.**
- **Test întâi** pentru orice atinge `analyzer.js`, `chords.js` sau scheduler-ul de repetiție
  spațiată. Același lucru pentru logica nouă de scor (stele, XP).
- **Fără material protejat**: niciun standard, nicio melodie protejată. Doar material original
  sau din domeniul public.

## Diagnosticul de pornire

- **Motorul e partea rară și valoroasă**: analizorul, voice leading-ul, `realize.js` +
  `player.js`, harness-ul, 238 de teste. Nimeni de pe piață nu judecă *cum* ai cântat un acord.
- **Interfața e un panou de control pentru dezvoltator.**
  - Are 3 tab-uri și în jur de 30 de controale; doar tab-ul Progression are ~17 (selecturi,
    Import/Export JSON, Save/Load/Delete, bife de voci).
  - Nu există un „ce fac azi?" și nici progres vizibil, în afară de o linie de statistici.
- **`weakSpots` din `ui/stats.js` există, dar nu-l folosește nimic.** E motorul de retenție
  nefolosit.

## Pitch-ul (diferențiatorul)

Simply Piano, Melodics, Yousician și Playground Sessions verifică toate dacă ai cântat **notele
din partitură**. SideKeys judecă un **răspuns deschis**: îți cer Dm7, orice voicing valid e
acceptat, iar scorul vine din *calitatea* lui (registru, low interval limits, note evitate,
voice leading). Nimeni altcineva nu poate gamifica gândirea armonică, pentru că nimeni nu are
un analizor care să judece așa ceva.

Al doilea avantaj: **motorul e fabrica de conținut.** Exercițiile se generează procedural
(12 tonalități × calități × tipuri de voicing), deci nu e nevoie de piese licențiate. Ce
trebuie scris de mână sunt doar textele scurte de lecție: Claude scrie draftul, Edi verifică
teoria.

## Mecanicile de joc

| Mecanică | Ce e | Pe ce se sprijină |
|---|---|---|
| **Stele 1–3** pe exercițiu | ★ corect · ★★ curat (nimic muddy, fără note evitate) · ★★★ elegant (voice leading strâns, la tempo) | `analyzer.js`, `voiceLeading.js` |
| **Drumul** (harta) | Unități: Triade → Inversiuni → Septacorduri → Shell → Rootless A/B → Drop 2 → Quartal → ii–V–I în 12 tonalități → Comping. Fiecare unitate se termină cu un **boss**: progresia la tempo, în timed | `progressions.js`, `ui/session.js`, metronomul |
| **Challenge-ul zilei** (stil Wordle) | Același exercițiu pentru toți, **fără cont**, cu rezultat partajabil ca grilă de pătrățele colorate. Singurul mecanism de creștere organică | analizorul; seed zilnic determinist |
| **Streak** | Cu „freeze" și obiectiv zilnic în minute | local, apoi sincronizat |
| **Tabla de măiestrie** | 12 tonalități × calități; căsuțele se colorează pe măsură ce le stăpânești. Obiectivul avansatului | `ui/stats.js` |
| **Antrenamentul tău** | Recapitulare zilnică din `weakSpots`, cu repetiție spațiată (SM-2). Utilizatorul vede sesiunea, nu algoritmul | `weakSpots` + scheduler nou, testat |
| **Smooth Operator** | Cânți o progresie cu mișcare totală minimă; scorul e numărul de semitonuri. Voice leading-ul devine joc. Doar noi îl putem face | `voiceLeading.js` |
| **Fix the Mud** | Primești un voicing prost și îl repari schimbând cât mai puține note | analizorul |
| **Chord Rush** | 60 de secunde, câte acorduri corecte prinzi, cu combo | drill-ul |
| **Ghost** | Concurezi cu tine de ieri | statisticile, banda sesiunii |
| **Gig Mode** | Aplicația cântă bas și tobe, tu acompaniezi și primești raport pe măsuri. Momentul „fun" și puntea spre raportul de comping plătit | `realize.js`, `player.js`; **tobele sunt de scris** |
| **Reharm puzzle** | Nivel avansat: găsește substituția care merge peste melodie | `candidates.js`, `piece.js` (fără AI) |

**Reguli de design ale jocului:**
- **XP pe calitate și dificultate, nu pe volum.** Plafon pe repetițiile identice, altfel
  oamenii spamează acorduri ușoare.
- **Fără ligi și fără clasamente globale în prima versiune.** Cu puțini utilizatori, un
  clasament gol demotivează. Excepție: clasamentul challenge-ului zilei.
- **`explain` (Ask Claude) rămâne singurul apel AI**, folosit ca indiciu de antrenor.

## Ecranele

1. **Azi**: streak-ul, challenge-ul zilei, „continuă drumul", antrenamentul tău. Un singur
   buton mare.
2. **Drumul**: harta cu unitățile, nivelele și stelele.
3. **Jocul**: full-focus — acordul mare, claviatura mare, feedback animat pe clape, sunet real
   de pian, combo. **Zero selecturi.**
4. **Rezultatul**: stele, XP și **un singur** lucru de reparat (ex. „îți lipsește cvinta pe
   m7b5 de 4 ori"), plus „Încă o dată".
5. **Laboratorul**: drill-ul liber și progresiile de acum, pentru avansați. Se păstrează, doar
   nu mai stau pe prima pagină.
6. **Profilul**: tabla de măiestrie și statisticile.

## Fricțiunea: ținte

- **Fără cont la început.** Progresul se ține local; contul servește doar la sincronizare.
- **Clapa MIDI detectată automat**, cu ecranul „apasă orice clapă". Fără clapă: claviatura de
  pe ecran și literele, cum e azi.
- **Primul acord cântat în sub 30 de secunde** de la deschiderea paginii.
- **Sunet de pian din sample-uri**, în locul synth-ului cu oscilatoare (`audio/synth.js`).
  Contează enorm pentru senzația de „fun".
- **Setările ascunse**, nimic tehnic pe drumul principal (Import JSON, Save session etc.
  stau în Laborator sau în Settings).

## Desktop (.exe): ce implică, pentru când îi vine rândul

- **Electron**:
  - include Chromium, deci Web MIDI merge identic pe Windows și Mac;
  - installer-ul are ~100 MB.
- **Tauri**:
  - installer-ul are ~10 MB, dar folosește browserul sistemului;
  - pe Windows e WebView2 (Chromium), deci în regulă;
  - **pe macOS e WKWebView, fără Web MIDI**, deci e nevoie de MIDI nativ printr-un plugin.
    Arhitectura de acces MIDI din `midi/input.js` + `midi/virtual.js` permite un port nativ
    ca încă o sursă.
- **Semnarea codului e obligatorie.** Un .exe nesemnat afișează SmartScreen („Windows protected
  your PC"), care arată mai neprofesional decât un site.
  - **Windows**: certificat sau serviciul Microsoft de semnare, ori distribuție prin
    Microsoft Store. **Costurile actuale sunt de verificat** înainte de decizie.
  - **macOS**: Apple Developer (99 $/an) + notarizare.
- **Mentenanța nu se termină la lansare**: auto-update, raportare de erori, licențe în afara
  store-urilor.
- **Costul cel mai mare e fricțiunea instalării.** Challenge-ul zilnic partajabil trebuie să
  rămână pe web.

## Începătorii și microfonul: de re-măsurat

- **Ce s-a măsurat deja.** Prototipul de microfon a picat (45% față de pragul de 90%), dar pe
  voicing-uri cu două mâini, cu octava exactă; cauza au fost dublările de octavă
  (`docs/spec-mic.md`).
- **De ce merită reluat.** Exercițiile de începător (triade de 3–4 note, registru mijlociu)
  sunt o problemă diferită.
- **Propunerea:** o zi de lucru — se re-măsoară `mic-proto/` pe un corpus de începător, cu
  prag și criteriu stabilite cu Edi înainte. Dacă trece, se deschid pianele acustice și
  iPad-ul pentru nivelurile de început.
- **Fără promisiuni**: se măsoară, nu se presupune.

## Riscul principal

În afară de Edi, n-a folosit încă nimeni aplicația, iar poarta P0 (cele 40 de emailuri) e
suspendată. Riscul nu e interfața, e să construim două luni un joc pe care nu-l vede nimeni.
De aceea prima livrare e mică, publică și măsurabilă.

## Prima livrare (~2 săptămâni)

Lista și DoD-ul au intrat în `PRODUCT.md` ca **P1 — Jocul, prima livrare publică**, cu poarta
celor 40 de adrese mutată acolo. Se citesc de acolo, ca să nu existe două liste.

**Ce aduce Edi la livrarea asta:** un clip cu el cântând pe aplicația nouă. Clipul plus
formularul repornesc ceasul porții.

## Decizii deschise (se întreabă Edi, nu se presupun)

1. ~~**React sau Svelte pentru shell.**~~ — **închisă pe 2026-10-11: Svelte 5 + Vite +
   TypeScript**, la recomandarea lui Claude, acceptată de Edi. Motivele: ce se mișcă la 60 fps
   vine din afara framework-ului (MIDI, metronom, lookahead audio), iar reactivitatea compilată
   atinge doar nodul schimbat; animațiile cerute de direcție sunt în limbaj (`transition:`,
   `animate:`, `svelte/motion`), nu într-o dependență în plus; runtime mai mic pentru „primul
   acord în sub 30 de secunde" și pentru offline; mai puține concepte de explicat. Contra, asumat:
   React e bifa din anunțurile de job, iar Svelte 5 cu runes e mai nou în ce știe Claude — se ține
   în frâu cu versiune fixată, runes only și zero librării de componente.
2. **Ordinea exactă a unităților** și conținutul testului de plasare. Teoria e a lui Edi.
3. **Formula de stele**: pragurile pentru „curat" și „elegant" (ex. câte semitonuri înseamnă
   voice leading „strâns"). Se scrie ca specificație, ca tabelul de calități al analizorului,
   înainte de cod.
4. **Sursa de sample-uri de pian**: licența (ex. Salamander Grand, CC-BY) și dimensiunea
   descărcării.
5. **Ce se întâmplă cu UI-ul vechi**: rămâne ca „Laborator" în shell-ul nou sau se reface
   acolo de la zero.
6. ~~**Vechea generalizare a regulii de anticipare**~~ — **închisă pe 2026-10-11**: se
   anticipează numai peste bara de măsură. Edi a respins schimbările din mijlocul măsurii și
   anticiparea din măsura de numărătoare; a păstrat fereastra de jumătate de timp muzical (în
   3/4, „și"-ul lui 3) și ultimul acord fără loop. Regula, cu motivele, e în
   `docs/spec-capture.md`.

## Primul pas în Claude Code

1. Se citește acest fișier și `PRODUCT.md`.
2. Se propune lui Edi (fără să se scrie nimic în repo):
   - a) textul actualizărilor pentru `PRODUCT.md` și `CLAUDE.md` care reflectă direcția nouă;
   - b) **un prototip vizual al celor patru ecrane principale** (Azi, Drumul, Jocul,
     Rezultatul), ca să se discute pe imagini înainte de cod;
   - c) recomandarea React vs Svelte.
3. După aprobare: specificația stelelor și a XP-ului (document), apoi prima livrare, pas cu pas.
