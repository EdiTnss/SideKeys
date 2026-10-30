# Interfața jocului: trei uși, un pas evident

Aprobată de Edi pe 2026-10-30 („sunt de acord cu interfața, hai să o integrăm”), după prototipul
de pe claude.ai: https://claude.ai/artifact/CT8iZX6ukr31WvyqF2L1FN (9 ecrane de telefon, 5 de
desktop). Prototipul arată intenția; acest fișier ține regulile. Unde se contrazic, câștigă acest
fișier.

## De ce

Pe telefon, ecranul de start avea un paragraf și opt carduri egale, pe patru ecrane de scroll,
fără niciun meniu. Drumul, Training și Teoria se găseau doar coborând până la cardurile lor. În
nivel stăteau patru butoane la fel de importante, cu nume interne („Play armed”, „Start the timed
run”). Un om nou nu știa de unde s-o ia (Edi, 2026-10-30: „intri într-un ecran plin cu funcții și
nu înțelegi de unde s-o iei”).

## Regulile

1. **Trei uși, numite cu verbe**: **Play / Joacă** (drumul, cu stele), **Practice / Exersează**
   (liber, fără stele), **Learn / Învață** (teoria). Pe ecran îngust stau jos, ca bară de taburi;
   de la 760 px în sus stau în stânga, ca o coloană, cu un rând de explicație sub fiecare nume.
2. **Un singur buton mare pe ecran.** Pe Play e „Continuă”; pe Practice, „Reia ultima”; în nivel,
   clapa însăși.
3. **O funcție apare când îți folosește.** Recapitularea apare doar când are ceva de recapitulat.
   Seria de zile și minutele apar după prima zi jucată. Butonul de timed apare în nivel doar
   după a doua stea; până atunci, a treia stea se cere din Rezultat.
4. **Fiecare final duce undeva.** Rezultatul arată ce urmează: lucrul de reparat (cu „Exersează
   X” și „Cum se construiește?”), a treia stea în timp, nivelul următor.
5. **În nivel nu e nicio navigare**: doar ieșirea (×), progresul, acordul, clapa.
6. **Cu o clapă MIDI conectată, butoanele Play și Clear dispar**: se cântă pe clapă. Clapa de
   ecran le păstrează.
7. **Antetul vechi se împarte.** Starea clapei și seria stau în navigare. Comutatorul „Sound in
   the app”, limba, formularul de noutăți și legătura spre Laborator trec în **Settings / Setări**,
   la care duce rotița din navigare. Prima vizită are comutatorul de limbă pe ecran, pentru că
   Setările nu se văd încă.

## Prima vizită

Un browser care n-a jucat nimic și n-a trecut încă prin ea vede trei pași, câte o atingere fiecare:

1. **Ce face**: un acord judecat, desenat (C, cu notele colorate și „Clean”), și întrebarea
   „Cu ce cânți?”: clapă MIDI (cere permisiunea browserului) sau ecranul.
2. **De unde pornești**: „Abia încep” → Triade, „Cânt din acorduri” → Septacorduri, „Cânt jazz”
   → Rootless. Toate unitățile rămân deschise; alegerea doar pornește primul nivel al unității.
   Rămâne așa până există testul de plasare (Edi, 2026-10-30).
3. **Primul acord**, în nivelul ales, cu notele acordului scrise sub el („C = C · E · G”) pentru
   „Abia încep”. Ceilalți le pot cere cu „Arată notele”.

Trecerea prin prima vizită se ține minte în browser (cheia `welcomed`). Cine are deja progres nu
o vede niciodată.

## Ce nu se schimbă

Stelele, prima încercare care contează, pragurile, challenge-ul, Review-ul, Training-ul și
paginile de teorie rămân exact cum sunt (`spec-game.md`). Se schimbă doar unde stau și cum se
ajunge la ele. Nicio regulă din `src/` nu se mută în shell.

## Precizări din implementare

- **„Arată notele”** scrie notele acordului cerut, cu aceeași funcție ca verdictul după o
  greșeală (`chordToneNames`). Nu colorează clape: un acord are multe voicing-uri, iar o clapă
  colorată dinainte ar spune că doar acela e corect.
- **„Exersează X”** din Rezultat pornește un drill de Training pe calitatea slabă, în toate cele
  12 tonalități, în forma nivelului dacă forma există pentru acea calitate. Nu schimbă alegerile
  salvate ale Training-ului.
- **„Comping peste bas”** din Practice duce la Laborator (`lab/`), unde e raportul. Rămâne marcat
  „avansat” și în engleză până ajunge în joc.
