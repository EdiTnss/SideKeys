# Voicing Lab — spec-capture.md

Cum `midi/capture.js` și `midi/input.js` transformă notele apăsate într-un snapshot de voicing. Mutat neschimbat din `CLAUDE.md` pe 2026-09-19; se citește când se lucrează la captură.

## Cum funcționează captura (snapshot de voicing)

1. `input.js` ține un `Set` cu notele apăsate acum (note-on adaugă, note-off / velocity 0 scoate).
2. La fiecare **note-on**, resetează un timer de ~300 ms. Note-off scoate nota din set, dar nu repornește timer-ul; în schimb, primul note-off de după ultimul note-on reține o copie a setului de dinaintea lui. Când timer-ul expiră, emite un eveniment `voicing` cu notele sortate crescător: setul curent, dacă are ≥ 2 note; altfel copia reținută, dacă are ≥ 2 note; altfel nimic.
3. Motivul: când te așezi pe un acord, notele nu ajung simultan; fără debounce am analiza și stările intermediare. Note-off nu repornește timer-ul pentru că nici degetele nu se ridică simultan: altfel analizorul ar primi, după 300 ms, un acord parțial și ar raporta „lipsește 7" pe un acord cântat corect. Copia de dinaintea primului note-off acoperă acordurile staccato (apăsate și eliberate sub 300 ms), care altfel n-ar produce niciun snapshot; setul curent are prioritate ca o notă greșită corectată rapid să nu fie raportată. 300 ms e punct de plecare, se face configurabil.
4. Nota de „next" (o notă foarte gravă, configurabilă) e interceptată înainte să intre în set, ca să nu ajungă în analiza acordului ținut.
5. Ascultăm pe toate canalele. Genos poate transmite părțile pe canale diferite; filtrăm doar dacă apar note nedorite (ex. de la acompaniamentul auto — de dezactivat din Genos în timpul studiului).
