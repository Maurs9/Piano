# Sight-Reading Adaptiv pentru Étude — Implementation Plan v3

> **For Hermes / Agent:** Use subagent-driven-development skill to implement this plan task-by-task.
> Dacă skill-ul respectiv nu este disponibil, folosește ciclul TDD din secțiunea 12 și review separat după fiecare etapă. Nu instala instrumente și nu implementa întregul document fără autorizarea utilizatorului.

**Goal:** Livrarea întâi a unui antrenament de citire la prima vedere cu scor explicabil și exerciții reproductibile (MVP), apoi extinderea către practică pe fragmente (V2) și estimarea adaptivă a nivelului (V3).

**Architecture:** Reutilizăm motoarele `SR` și `RD`, rendererul SVG (`srRender`) și infrastructura de input din `etude.html`. Separăm modelul partiturii în ticks, înregistrarea execuției (recorder conectat atât la `on` cât și la `off`), evaluatorul pur (`srtEvaluate`) și controlerul sesiunii. Păstrăm aplicația statică și toate funcțiile de model/fingerprint/evaluare **100% sincrone și pure**; registrul nou de încercări (`etude-sight-v1`) are o singură sursă de adevăr și nu intră în regulile generice de sincronizare (`SYNC_ADD` / `SYNC_MAX`) ale contoarelor vechi.

**Tech Stack:** HTML/CSS/JavaScript în `etude.html`, SVG existent, Web Audio, inputurile existente (MIDI, BLE MIDI, tastatură, pointer), Playwright. Stocare sincronă în `localStorage` cu notificare între taburi prin evenimentul `storage`; lipsa capabilităților de stocare nu blochează practica.

**Status:** Specificație de implementare revizuită (v3). Pragurile și curriculumul de mai jos sunt decizii inițiale de produs, aliniate cu evaluatorul ritmic existent (`rdRhGradeHand`), nu rezultate validate pedagogic.

**Data:** 6 noiembrie 2026.

**Bază inspectată:** `origin/main`, commit `2f69f5cc0795c4e0f6759261a57ecdac5e533eb1`.

**Documente anterioare:**
- `docs/plans/2026-11-06-sight-reading-research-and-plan.md` (v1 — istoric al cercetării)
- `docs/plans/2026-11-06-sight-reading-improved-plan.md` (v2 — specificație intermediară)
Documentul de față (v3) înlocuiește v2 ca specificație propusă pentru implementare, rezolvând integrarea cu pipeline-ul de input existent, sincronismul fingerprint-ului pe origini non-HTTPS/LAN, simplificarea persistenței în MVP și maparea UI peste controalele existente.

---

## 1. Domeniu, dovezi și limite

### 1.1. Ce este verificat în codul de bază

Referințele sunt simboluri la commitul de mai sus; numerele de linie sunt orientative.

| Componentă | Observație verificată în `etude.html` | Consecință pentru implementare în v3 |
|---|---|---|
| `srAssessFinish` | Procentul actual folosește notele corecte raportate la notele așteptate (`100 * good / totalN`). `SR.wrongExtra` este afișat, dar nu reduce procentul. | Primul livrabil înlocuiește calculul cu evaluatorul pur `srtEvaluate` și păstrează separat rezultatele istorice `sheet.best`. |
| `srKeyInput` și `srAssessLoop` | Evaluarea existentă face matching greedy în timp real și marchează `SR.results[nid] = 'good' \| 'bad'` în timpul redării. | În modurile în tempo, în timpul stării `playing` se mișcă doar cursorul; colorarea notelor se aplică la `completed` din rezultatul optim returnat de `srtEvaluate`. |
| `onInputChange`, `handleNoteOn`, `handleNoteOff`, `inputOwners` | `handleNoteOn`/`handleNoteOff` deduplică prin `held` și `inputOwners`, dar `onInputChange(kind, midi)` trimite către `SR` doar `kind === 'on'` cu `heldOrder[heldOrder.length - 1]`, fără `off`, fără `source` și fără distincția eliberare fizică vs pierdere focus (`releaseFocusInput`). | În M3 extindem `onInputChange(kind, midi, source, releaseKind)` astfel încât recorderul `SR` să primească direct evenimentele `on` și `off` cu `midi`, `source` și `releaseKind`. |
| `rdRhPress`, `rdRhRelease`, `rdRhGradeHand` | Exercițiile de ritm (`RD.L.ty === 'rh'`) au deja un mini-recorder cu `open: Map` (curățat în `releaseFocusInput`) și ferestre temporale de `100 ms` (`good`) și `180 ms` (`near`). | Păstrăm aceleași praguri temporale (`100 ms` / `180 ms`) în `srtEvaluate` pentru coerență în toată aplicația și urmăm același tipar la pierderea focusului. |
| `srEvents`, `srRender` | Modelul existent acceptă note, acorduri și pauze `R`; rendererul citește `ts`. | Folosim adaptorul `srtToLegacyPiece(piece)` către `srRender`, păstrând corespondența stabilă între `event.id` / pitch și `nid`-ul SVG. |
| `srStepsBuild` | Notele sunt grupate după momentul de atac și mâinile selectate. | Păstrăm grupurile simultane pentru modul pas cu pas (`learn`); în tempo, acordurile nu impun o ordine de apăsare a notelor componente. |
| `rdSightGen`, `rdSightStart`, `rdGenMelody` | Generatorul actual folosește `Math.random()` și construiește exerciții 4/4, iar intrarea în sight-reading se face atât din tabul Drills (`rdSightStart`) cât și din tabul Pieces (`rdGenMelody`). | Noul generator primește explicit profilul și seed-ul; ambele puncte de intrare folosesc același flux și aceeași mapare de moduri. |
| `srAssessStart`, `srPlayGap` | Mâna neexersată poate fi redată automat prin `previewNote`. | Această asistență este permisă în practică, dar dezactivată în „Prima încercare în tempo”. |
| `rdData`, `syncData`, `SYNC_ADD`, `SYNC_MAX` | Există progres și reguli de comasare specifice datelor actuale din `ptt-v3`. | Registrul nou folosește cheia separată `etude-sight-v1` și nu intră în `syncData`. |
| `isBackupPayload` | Validatorul de bază verifică `p.v === 3 && isRecord(p.data)`. | Extindem exportul/importul prin câmpul opțional `sightLedger`, validat separat fără a rupe backup-urile `v:3` existente. |

În verificarea anterioară a ramurii care a intrat în acest `main` au trecut 112 teste Playwright în Chromium. La implementare (M0) se capturează un baseline nou, cu commit, browser, comandă și rezultat.

### 1.2. Ce preluăm din cercetarea externă

- Descrierea oficială Piano Marvel menționează preview de 20 de secunde, avans la minimum 80% și oprire după trei strike-uri. Acestea documentează produsul lor, nu validează un algoritm propriu Étude.[1]
- Complete Music Reading Trainer descrie exerciții progresive și mai multe modalități de input, inclusiv claviatură virtuală și MIDI. Reținem ideea de exerciții focalizate și accesibile prin mai multe inputuri.[2]
- Sight Reading Factory descrie personalizarea ambitusului, ritmurilor și salturilor; aceeași pagină precizează că funcția respectivă nu este disponibilă pentru pian. Folosim ideea de constrângeri ca inspirație, fără a atribui pianului funcții neconfirmate.[3]

### 1.3. Ce nu afirmăm

- Scorul Étude nu este SASR și nu se convertește în scor SASR.
- „Look-ahead” și digitația propusă sunt funcții de antrenament de evaluat, nu garanții de progres.
- Prima vedere înseamnă „prima expunere înregistrată în acest profil local”, nu absența oricărei expuneri în viața utilizatorului.
- Rezultatele din surse de input diferite nu sunt presupuse comparabile înainte de verificarea latenței.

---

## 2. Decizii de produs și livrare

### 2.1. Moduri distincte și maparea lor în UI

| Mod conceptual | Mapare în UI (`#rd-mode` / stare) | Ajutoare permise | Reluări | Rezultat |
|---|---|---|---|---|
| **Practică pas cu pas** | Butonul existent `learn` („Pas cu pas”) | Indicii opționale, mâini separate, `Listen`, ținte pe clape | Nelimitate | Progres de practică; consumă eligibilitatea de primă vedere a piesei afișate |
| **Prima încercare în tempo** | Butonul `assess` pe o piesă generată **neexpusă încă** (cu badge „Prima vedere disponibilă”) | Fără `Listen`, fără ținte pe clape, fără nume de note pe portativ, fără acompaniament automat | **O singură încercare** eligibilă pe conținut local nou (preview 20 s → count-in 1 măsură → execuție) | Scor detaliat + statut `firstSight: true` salvat în `etude-sight-v1` |
| **Practică în tempo** | Același buton `assess` după consumarea primei încercări, pe piese de repertoriu fixe sau după apăsarea „Treci în practică” | Configurabile (inclusiv BPM, `Listen`, mâini separate) și vizibile în rezultat | Nelimitate | Scor detaliat din același evaluator `srtEvaluate`, etichetat `practice` |
| **Evaluare adaptivă — V3** | Sesiune dedicată din Drills (`RD` mode `test` pe unitatea `sr`) | Reguli fixe pe sesiune | Fragmente noi | Nivel estimat Étude, experimental (livrabil V3) |

**De ce această mapare UI:** Păstrăm selectorul `#rd-mode` compact (esențial la lățimea de 320 px pe mobil) și evităm aglomerarea barei de control cu 4 butoane permanente. Când o piesă nouă din generator este pregătită în modul `assess`, panoul intră în starea `preview` (20 s cronometru vizibil, buton primar „Pornește acum” și buton secundar „Treci în practică”). După finalizare sau trecerea în practică, piesa rămâne disponibilă oricând pentru „Practică în tempo” și „Practică pas cu pas”.

### 2.2. Etape

**MVP — obligatoriu înainte de extindere**
1. Scor corect (`srtEvaluate`), recorder conectat la `on`/`off` și model în ticks cu contract stabil.
2. Generator determinist P1–P2, o singură mână la alegere, 4/4 și 3/4, pauze simple.
3. Flux complet: pregătire, claim sincron, preview (20 s), count-in, execuție fără colorare prematură, rezultat explicabil.
4. Registru local sincron (`etude-sight-v1`) al expunerilor și încercărilor, cu reguli clare de abandon și backup.
5. Interfață și teste pentru limbile suportate de baza de integrare, mobil (320 px) și offline.

**V2 — practică mai utilă**
- Fragmente pe măsuri (`srtSlicePiece`) și progresie ghidată adaptată mâinilor existente.
- Exerciții simple cu două mâini și feedback vizual suplimentar.
- Digitație doar pentru configurații explicit suportate.

**V3 — estimare adaptivă și extensii**
- Profiluri P3–P6, după validarea rendererului și generatorului.
- Nivel estimat Étude, limite ale estimării și istoric versionat al sesiunilor.
- Look-ahead opțional, statistici și comparații în interiorul aceluiași protocol.

**În afara MVP:** import arbitrar MusicXML în evaluarea nouă, 6/8, pedală evaluată, legato/articulații punctate, digitație generală, clasamente, backend, echivalare cu examene externe și rescrierea întregii aplicații în module.

---

## 3. Arhitectură și contracte

Fluxul propus (toate etapele de model, fingerprint și evaluare sunt **sincrone**):

```text
profil + seed → srtGenerate → srtValidatePiece → srtFingerprint (sincron)
                                                       ↓
                                            eligibilitate / claim sincron
                                                       ↓
preview (20s) → count-in → recorder (on/off) → srtEvaluate → salvare rezultat
                                 ↓                                  ↓
                         onInputChange extins              UI / etude-sight-v1
```

Funcții propuse:

- `srtGenerate(profile, seed)`: model determinist, pur, independent de DOM și ceas.
- `srtValidatePiece(piece, profile)`: validare structurală, ritmică și de profil.
- `srtToLegacyPiece(piece)`: adaptor pentru `srRender`, care atașează fiecărei note generate un `eventId` stabil pentru maparea `nid ↔ expectedNote.id`.
- `srtFingerprint(piece)`: funcție **pură și sincronă** care returnează identitatea canonică a conținutului (`v1:<hex64>`).
- `srtBuildExpected(piece, config)`: evenimente evaluate în milisecunde (`id`, `midi`, `hand`, `onMs`, `offMs`).
- `srtEvaluate(expected, performed, config)`: evaluator pur și reproductibil.
- `srtTransition(state, event)`: mașina de stări pură a sesiunii, fără efecte secundare.
- `srtLedgerUpdate(operation)`: acces sincron, validat, la `localStorage['etude-sight-v1']`.
- `srtSlicePiece(piece, startBar, endBar)`: V2, nu condiție pentru MVP.

### 3.1. Reprezentarea muzicală

Propunere de model:

```js
{
  schemaVersion: 1,
  generatorVersion: 1,
  profileId: 'P1.a',
  seed: 42,
  meter: { num: 4, den: 4 },
  ticksPerQuarter: 480,
  key: { tonic: 'C', mode: 'major', keyN: 0 },
  bars: 4,
  events: [
    { id: 'rh-0', hand: 'rh', onsetTick: 0, durationTick: 480,
      pitches: [{ midi: 60, spelling: 'C4', finger: 1 }] }
  ]
}
```

Reguli:
- `pitches: []` reprezintă o pauză, nu un eveniment de evaluat ca notă.
- Timpul muzical se stochează în ticks întregi (`ticksPerQuarter = 480`); conversia în beats se face în adaptorul `srtToLegacyPiece`.
- Un acord este un eveniment cu mai multe înălțimi în `pitches` (ordonate crescător după `midi`), nu o ordine obligatorie de apăsare.
- Durata fiecărei voci umple exact măsurile (`bars * meter.num * (480 * 4 / meter.den)` ticks); nu deducem sfârșitul piesei doar din ultima notă atacată.
- În MVP nu există anacruze, schimbări de măsură, voci suprapuse în aceeași mână sau legături peste bara de măsură.
- Obiectele partiturii nu se modifică în timpul execuției. Rezultatele au structură separată.

### 3.2. Identitatea conținutului (Sincronă și Independentă de Contextul Securizat)

Fingerprint-ul se calculează dintr-o serializare canonică versionată care include măsura, tonalitatea/armura, mâinile, pauzele, atacurile (`onsetTick`), duratele (`durationTick`) și notația înălțimilor (`midi`, `spelling`). Ordonarea cheilor și a notelor din acord este fixă.

Nu includem seed-ul, titlul, limba, tema, BPM-ul, `event.id` sau ID-ul profilului: aceeași partitură regenerată prin alt seed ori redeschisă la alt tempo nu devine automat nouă. Metadatele de digitație (`finger`) se exclud; schimbarea lor nu șterge expunerea.

**Algoritm (v3):** În loc de `crypto.subtle.digest` (care este asincron și indisponibil pe `http://192.168.x.x` la testarea pe mobil în LAN sau pe `file://`), folosim un hash determinist sincron pe 64 de biți (pereche FNV-1a / Cyrb53 pe două seed-uri prime, formatată ca `v1:` + 16 caractere hexazecimale lowercase) peste stringul canonic UTF-8.
- Astfel `srtFingerprint(piece)` este 100% sincron, pur și rapid (< 0.05 ms).
- Testele verifică determinismul, invarianța la BPM/seed/digitație și sensibilitatea la orice schimbare de înălțime, durată, pauză, măsură sau armură.

**Limită:** MVP recunoaște identitatea exactă definită mai sus, nu asemănarea melodică sau orice transpoziție. Fragmentarea unei piese deja expuse nu produce conținut eligibil nou; V2 păstrează identitatea și intervalul sursei.

---

## 4. Recorder, pipeline de input și ceas

### 4.1. Conectarea la pipeline-ul de input din `etude.html`

În codul existent (`etude.html`), `onInputChange(kind, midi)` trimite către `SR` doar `kind === 'on'` și folosește `heldOrder[heldOrder.length - 1]`, fără `off` și fără `source`. În M3 actualizăm pipeline-ul fără a rupe niciun modul existent (`analysis`, `explore`, `learn`, `sing`, `RD`, `SES`):

1. `handleNoteOn(midi, vel, source = 'midi')` apelează `onInputChange('on', midi, source, null)` atunci când nota trece din neapăsată în apăsată (`!held.has(midi)` înainte de adăugare).
2. `handleNoteOff(midi, source = 'midi', releaseKind = 'physical')` apelează `onInputChange('off', midi, source, releaseKind)` atunci când ultimul proprietar din `inputOwners` eliberează nota.
3. `releaseFocusInput()` și `releaseLiveInput()` transmit `releaseKind = 'focus'` (respectiv `'reset'` în `panic()`), astfel încât recorderul știe dacă eliberarea a fost fizică sau tehnică.
4. Când `view0() === 'read'` și recorderul `SR` este activ, `onInputChange` trimite evenimentul către `srtRecordInput(kind, midi, source, releaseKind, performance.now())`.

### 4.2. Evenimente înregistrate

```js
{
  id: 'input-17',
  midi: 60,
  onMs: 1000,
  offMs: 1480,
  source: 'midi',
  releaseKind: 'physical'
}
```

- Timpurile sunt relative la începutul execuției (`SR.t0`) și provin din același ceas monoton (`performance.now()`) ancorat la `actx.currentTime` la startul count-in-ului.
- `offMs` rămâne `null` până la eliberare; la finalul capturii (`T + 250 ms`) nu inventăm un note-off fizic (`offMs` rămâne `null`, `releaseKind: null`).
- `onMs = 0` este primul timp al piesei, nu începutul count-in-ului.
- Recorderul **nu** primește notele produse de metronom (`srClick`), `previewNote`, `srListen` sau acompaniamentul mâinii inactive (`srPlayGap`).
- Mesajele duplicate pe o notă deja ținută nu produc atacuri fictive. Repetarea reală după note-off produce un atac nou.
- Nu atribuim mâna pe baza canalului MIDI. În MVP mâna este aleasă dinainte; V2 raportează pe mâini doar când atribuirea este neambiguă.
- Clapele deja apăsate înainte de deschiderea ferestrei de captură (`< -250 ms`) sunt ignorate până la eliberare și reapăsare. Un note-on efectiv în intervalul `[-250 ms, 0)` este evaluabil după regulile normale de asociere, chiar dacă nota rămâne ținută peste începutul piesei.

### 4.3. Ferestre, latență și afișare în timpul execuției

- Înregistrăm o fereastră de `250 ms` înainte de începutul piesei și `250 ms` după sfârșitul muzical `T` (`[-250 ms, T + 250 ms]`); evenimentele din afara ei nu influențează scorul.
- Calculăm sfârșitul muzical `T` din durata completă în ticks a măsurilor, inclusiv pauzele finale. Captura atacurilor rămâne activă până la `T + 250 ms` inclusiv. Numai după această barieră înghețăm recorderul, rulăm `srtEvaluate` și intrăm în `completed`. Testăm explicit un atac suplimentar între `T` și `T + 250 ms`.
- Atacurile din count-in (`< -250 ms`) nu sunt notate și nu pot satisface primele note ale piesei.
- **Fără colorare contradictorie în timp real:** În timpul stării `playing` (atât în „Prima încercare în tempo”, cât și în „Practică în tempo”), pe portativ avansează doar cursorul (`srCursor`). Nu colorăm notele în `good`/`bad` din `srAssessLoop` pe parcursul execuției, deoarece asocierea optimă per înălțime (Secțiunea 5.1) se decide global la `T + 250 ms`. Imediat la intrarea în `completed`, fiecare notă de pe portativ primește atributul vizual `data-s` corespunzător clasificării din `srtEvaluate` (`good`, `near`, `bad`).
- MVP folosește compensare de latență zero (`latencyOffsetMs: 0`) și salvează acest fapt în configurație. Nu ajustăm retroactiv offset-ul ca să maximizăm scorul.
- Sursa de input (`midi`, `ble`, `kb`, `ptr`) este stocată în rezultat. O schimbare de sursă în timpul primei încercări marchează încercarea cu `mixedInput: true` și o exclude din comparațiile stricte V3; practica poate continua.
- Ascunderea paginii (`visibilitychange`), suspendarea contextului audio, deconectarea instrumentului MIDI sau `panic()` opresc eligibilitatea și trec încercarea în `interrupted`; nu sunt greșeli muzicale și nu produc strike.

Durata fizică a apăsării și notele ținute peste pauză sunt doar diagnostice în MVP. Evaluarea strictă a duratelor (similară cu opțiunea `dur` din `rdRhGradeHand`) este livrabil separat în V2.

---

## 5. Evaluatorul: reguli exacte pentru MVP

Toate pragurile de mai jos fac parte din `scoringVersion: 1` și sunt aliniate cu pragurile din `rdRhGradeHand` (`100 ms` / `180 ms`).

### 5.1. Asocierea notelor

1. Extindem acordurile în note așteptate individuale cu ID-uri stabile (`event.id + ':' + midi`). Selectăm doar mâna evaluată.
2. Construim candidați numai pentru **aceeași înălțime MIDI** și distanță temporală `|performed.onMs - expected.onMs| <= windowMs`.
3. Fereastra maximă este `250 ms`. Pentru aceeași înălțime MIDI repetată apropiat, fereastra unei note așteptate este `min(250, 0.45 * minNeighborDeltaMs)`, unde `minNeighborDeltaMs` este cel mai mic interval temporal până la atacul așteptat anterior sau următor al aceleiași înălțimi MIDI. Pentru o singură apariție a acelei înălțimi rămâne `250 ms`.
4. Asocierea se rezolvă independent pe fiecare înălțime MIDI prin **programare dinamică monotonă** (fără inversarea ordinii atacurilor aceleiași înălțimi):
   - Maximizăm numărul de note asociate (`TP`),
   - La egalitate, minimizăm suma erorilor absolute `sum(|onMs_perf - onMs_exp|)`,
   - La egalitate, preferăm perechile cu timp așteptat mai mic, apoi timp executat mai mic, apoi ID stabil.
5. Notele simultane cu înălțimi diferite (acorduri) sunt evaluate pe pitch-uri diferite, deci pot fi apăsate în orice ordine în interiorul ferestrei lor, fără ca un greedy global să consume greșit o notă.
6. O notă așteptată neasociată este `missed` (`FN`); un atac executat neasociat în `[-250 ms, T + 250 ms]` este `extra` (`FP`).
7. Pentru feedback vizual în UI, un atac `extra` poate fi adnotat cu poziția temporală pe portativ, fără a modifica `TP`, `FP` sau `FN`.

### 5.2. Clasificarea temporală

Pentru fiecare notă așteptată:
- `good`: asociată, cu `|errorMs| <= 100`.
- `near`: asociată, cu `100 < |errorMs| <= 180` (și în fereastra admisă de asociere).
- `lateOrEarly`: asociată valid în fereastra admisă (de ex. `180 < |errorMs| <= 250`), dar peste `180 ms`. Contribuie la `TP` (înălțime atinsă în fereastră), dar primește `0` puncte la `rhythmAcc`.
- `missed`: nu există asociere validă.

Ferestrele includ capătul superior (`<= 100`, `<= 180`, `<= windowMs`); testele acoperă exact limitele (`100`, `100.001`, `180`, `180.001`, `250`, `250.001`).

### 5.3. Formule

Notăm:
- `N`: numărul de note așteptate;
- `TP`: note asociate cu înălțime corectă în fereastra permisă (`good + near + lateOrEarly`);
- `FN = N - TP`;
- `FP`: atacuri neasociate în fereastra înregistrată `[-250 ms, T + 250 ms]`;
- `G`: numărul de asocieri `good`, `Q`: numărul de asocieri `near`.

```text
pitchPrecision = TP / (TP + FP), sau 0 când TP + FP === 0
pitchRecall    = TP / N
pitchF1        = 100 * (2 * TP) / (2 * TP + FP + FN)
rhythmAcc      = 100 * (G + 0.5 * Q) / N
score          = min(pitchF1, rhythmAcc)
```

- `N = 0` produce `status: 'invalid'`, cu scoruri `null`; nu acordăm 100% unei piese goale.
- Pentru `N > 0` și tăcere (`TP = 0, FP = 0`), `pitchF1 = 0`, `rhythmAcc = 0`, `score = 0`.
- Deciziile de stele și eligibilitate folosesc valorile în virgulă mobilă nerotunjite; rotunjim (`Math.round`) numai la afișare.
- O substituție greșită (apăsarea lui Re în loc de Do) produce `1 FN` (Do ratat) și `1 FP` (Re suplimentar). Nu scădem separat încă o penalizare.
- Atacurile `extra` (`FP`) al căror `onMs` cade strict în interiorul unei pauze notate (și în afara ferestrelor de asociere ale notelor vecine) sunt raportate în `restViolations` ca subset diagnostic al `FP`, fără penalizare aditivă dublă în `score`, dar blochează acordarea a 3 stele.

### 5.4. Stele și diagnostice

- **3 stele:** `score >= 95`, `FP === 0` și `restViolations === 0`.
- **2 stele:** `score >= 80`, dacă nu sunt îndeplinite condițiile pentru 3 stele.
- **1 stea:** `score >= 60`.
- **0 stele:** `score < 60`.
- **„Perfect”:** numai dacă `G === N` (toate notele sunt `good`), `FN === 0` și `FP === 0`.

Returnăm în obiectul rezultat:
- `status` (`'valid'` | `'invalid'`), `scoringVersion: 1`,
- `N`, `TP`, `FP`, `FN`, `G`, `Q`, `lateOrEarlyCount`, `restViolations`,
- `pitchPrecision`, `pitchRecall`, `pitchF1`, `rhythmAcc`, `score`, `stars`, `perfect`,
- `meanOffsetMs` (media semnată a `onMs_perf - onMs_exp` pentru notele asociate; `null` dacă `TP === 0`),
- `meanAbsoluteOffsetMs` (media absolută; `null` dacă `TP === 0`),
- `noteResults` (rezultat per notă așteptată, cu `expectedId`, `classification`, `matchedInputId`, `errorMs`),
- `extraInputs` (lista atacurilor `FP`).

Nu suprascriem vechile recorduri `data.sheet[id].best` cu scoruri din noul evaluator. Rezultatele noi sunt salvate în `etude-sight-v1` și afișate clar.

### 5.5. Vectori de acceptare

Exemplele presupun patru note așteptate (`N = 4`); asocierile enumerate sunt în ferestrele permise.

| Execuție | TP / FP / FN | G / Q | pitchF1 | rhythmAcc | score | Stele |
|---|---|---|---:|---:|---:|---:|
| Perfectă | 4 / 0 / 0 | 4 / 0 | 100 | 100 | 100 | 3 |
| O substituție greșită | 3 / 1 / 1 | 3 / 0 | 75 | 75 | 75 | 1 |
| Toate corecte + 1 atac suplimentar | 4 / 1 / 0 | 4 / 0 | 88.888889 | 100 | 88.888889 | 2 (FP > 0) |
| Trei la timp și una `near` | 4 / 0 / 0 | 3 / 1 | 100 | 87.5 | 87.5 | 2 |
| Patru asociate, dar una `lateOrEarly` (220 ms) | 4 / 0 / 0 | 3 / 0 | 100 | 75 | 75 | 1 |
| Tăcere | 0 / 0 / 4 | 0 / 0 | 0 | 0 | 0 | 0 |

---

## 6. Prima încercare: mașina de stări și eligibilitate

### 6.1. Stări

```text
idle → preparing → claiming → preview → countIn → playing → completed
                        ↓         ↓         ↓          ↓
                    practice  abandoned  abandoned  interrupted
```

- `preparing`: generare, validare, calcul fingerprint sincron, pregătire audio și verificare input; partitura nu este încă vizibilă.
- `claiming`: verificăm sincron în `etude-sight-v1` dacă `fingerprint` a mai fost expus; dacă nu, persistăm imediat expunerea cu `claimAttemptId`. Dacă a fost deja expus (sau stocarea e indisponibilă), intrăm direct în modul `practice` cu explicație clară.
- `preview`: abia după salvarea expunerii afișăm partitura și pornim cronometrul de 20 s. La sfârșitul celor 20 s (sau la apăsarea „Pornește acum”) se trece automat în `countIn`. Utilizatorul poate apăsa „Treci în practică”, ceea ce marchează încercarea ca `abandoned` și comută în „Practică în tempo”.
- `countIn`: o măsură de metronom; configurația (BPM, mână, ajutoare) este înghețată.
- `playing`: recorder activ în fereastra `[-250 ms, T + 250 ms]`; pe portativ se mișcă doar cursorul.
- `completed`: tranziția din `playing` spre `completed` are loc **numai după bariera `T + 250 ms`**. Evaluatorul produce rezultatul, colorăm notele pe portativ și salvăm rezultatul în `etude-sight-v1`.
- `abandoned` / `interrupted`: fără scor de primă vedere și fără strike (în V3); conținutul rămâne marcat ca expus și poate fi exersat imediat în practică.

### 6.2. Reguli de eligibilitate

Verificăm dacă fingerprint-ul exista **înaintea claim-ului**, nu după preview. Preview-ul autorizat nu își invalidează propria încercare (`attemptId`).

Reguli obligatorii:
- Orice afișare a unei partituri din noul sistem în afara preview-ului autorizat (de ex. deschiderea în modul `learn` sau `practice`) apelează sincron `srtLedgerUpdate({ type: 'recordExposure', fingerprint, reason })` înainte de desenare. Operația este idempotentă.
- Dacă `localStorage` aruncă excepție (de ex. mod privat restrictiv sau `QuotaExceededError`), practica funcționează normal cu un mesaj informativ, dar modul „Prima încercare” este dezactivat.
- MVP permite „Prima încercare” numai pe conținut generat de noul protocol (`srtGenerate`). Piesele fixe din `PIECES` rămân în practică.
- Apăsarea `Listen` în timpul `preview`, `countIn` sau `playing` încheie eligibilitatea (`abandoned`) și trece sesiunea în practică.
- Refresh-ul paginii nu reia o rezervare ca încercare nouă: orice claim rămas în starea `claimed` fără rezultat terminal este marcat `abandoned` la următoarea citire/inițializare.
- Schimbarea limbii, temei sau dimensiunii ferestrei nu invalidează execuția și nu resetează recorderul.
- Durata efectivă de preview (`previewDurationMs`, <= 20000 ms) este salvată în rezultat când utilizatorul apasă „Pornește acum”.

---

## 7. Persistență, sincronizare și backup

### 7.1. O singură sursă de adevăr (`etude-sight-v1`)

Păstrăm progresul existent în `ptt-v3`, dar folosim cheia separată `etude-sight-v1` pentru noul registru. Motivul este izolarea completă de regulile generice `SYNC_ADD` / `SYNC_MAX` din `syncData`.

Nu menținem o a doua copie autoritară a încercărilor în `data.reading`. UI-ul citește registrul prin helperul `srtLedgerRead()`.

```js
{
  schemaVersion: 1,
  generation: 'gen-1762460000000-a1b2',
  revision: 1,
  exposures: {
    // fingerprint → { firstSeenAt, reason, claimedByAttemptId }
  },
  attempts: {
    // attemptId → rezultat terminal imuabil (status: 'completed' | 'abandoned' | 'interrupted')
  },
  prefs: { practiceHints: true, lookAhead: false },
  sessions: { /* V3: rezumate versionate */ }
}
```

### 7.2. Protocolul sincron de scriere (fără Web Locks în MVP)

Deoarece `localStorage` este sincron pe thread-ul principal, iar `srtFingerprint` în v3 este de asemenea sincron, toate operațiile din `srtLedgerUpdate(op)` se execută atomic în cadrul aceluiași turn de event-loop:
1. Citește `localStorage.getItem('etude-sight-v1')` și validează schema.
2. Verifică `generation` și precondițiile operației (`claimExposure`, `recordExposure`, `finishAttempt`, `abandonAttempt`, `updatePrefs`, `resetLedger`, `importLedger`).
3. Aplică transformarea idempotentă și incrementează `revision`.
4. Scrie JSON-ul în `localStorage.setItem('etude-sight-v1', ...)`.
5. Un listener `window.addEventListener('storage', ...)` pe cheia `etude-sight-v1` notifică tabul curent dacă un alt tab a consumat între timp expunerea sau a făcut reset, actualizând UI-ul fără condiții de cursă asincrone.

### 7.3. Creșterea datelor și limite

- Păstrăm cel mult ultimele **500 de încercări** în `attempts`, ordonate determinist după `(finishedAt, attemptId)`.
- Expunerile (`exposures`) nu se șterg la trunchierea `attempts`, pentru ca exercițiile vechi să nu redevină fals „noi”.
- Limita pentru `exposures` în MVP este **4096 de identități**. La atingerea ei, practica rămâne disponibilă, iar pentru noi prime încercări UI-ul cere o arhivare/resetare explicită a registrului.
- Dacă salvarea rezultatului la `completed` eșuează (`QuotaExceededError`), rezultatul rămâne vizibil pe ecran cu starea „rezultat nesalvat în stocarea locală” și buton de reîncercare/export.
- Dacă în `etude-sight-v1` este găsită o `schemaVersion > 1` (scrisă de o versiune viitoare), nu o suprascriem cu `{}`; păstrăm datele intacte și permitem practica + exportul.

### 7.4. Backup și migrare

- Backup-urile existente `v:3` continuă să fie acceptate de `isBackupPayload`.
- La exportul JSON din aplicație includem câmpul opțional `sightLedger` cu conținutul validat din `etude-sight-v1`.
- Absența lui `sightLedger` într-un backup vechi nu șterge registrul curent de expuneri.
- La importul obișnuit:
  - Construim și validăm integral registrul candidat înainte de scriere.
  - Facem reuniunea (`union`) dicționarului `exposures` (păstrând cel mai vechi `firstSeenAt`).
  - Reuniunea `attempts` după `attemptId`: încercările cu același ID și conținut identic se deduplică; dacă același `attemptId` are conținut diferit, importul este respins cu explicație clară.
  - Orice rezervare importată neterminată (`claimed`) este marcată `abandoned` la import (nu poate transfera un claim activ).
  - Aplicăm limita de 500 pentru `attempts`; dacă `exposures` reunite depășesc 4096 sau validatorul găsește valori invalide (NaN/Infinity, scoruri în afara `[0, 100]`, MIDI în afara `[0, 127]`), importul este respins fără modificarea registrului curent.
  - Nicio valoare din backup nu este interpolată neescapată în `innerHTML`.

---

## 8. Generatorul MVP: P1–P2

Profilul este o configurație explicită, nu doar un număr de dificultate. Mâna (`rh` sau `lh`) se alege separat; cheia este determinată de mână (`treble` pentru `rh`, `bass` pentru `lh`).

| Profil | Măsură | Ambitus | Durate permise | Salt maxim diatonic | Pauze |
|---|---|---|---|---|---|
| `P1.a` | 4/4 | Poziție fixă de 5 note | Pătrimi, doimi | Secundă (pas treptat + repetări) | Nu |
| `P1.b` | 4/4 | Poziție fixă de 5 note | Pătrimi, doimi | Terță | Nu |
| `P1.c` | 4/4 | Poziție fixă de 5 note | Pătrimi, doimi | Terță; cel puțin o notă repetată | Nu |
| `P2.a` | 4/4 | Poziție fixă de 5 note | Pătrimi, doimi | Terță | Pauză de pătrime (minimum 1) |
| `P2.b` | 3/4 | Poziție fixă de 5 note | Pătrimi, doimi | Terță | Pauză de pătrime (minimum 1) |
| `P2.c` | 3/4 sau 4/4 (din profil/seed) | Maximum o octavă (`C4–C5` / `C3–C4`) | Pătrimi, doimi | Terță | Pătrime sau doime când încape |

Valori inițiale: Do major (`keyN: 0`), 4 măsuri, 60 BPM în prima încercare (în practică tempo-ul poate fi schimbat liber). Pozițiile fixe de 5 note sunt `C4–G4` pentru mâna dreaptă și `C3–G3` pentru mâna stângă; ultima notă a măsurii 4 se rezolvă pe tonică (`C4` / `C3`) cu durată de doime (sau pătrime/doime punctată în 3/4).

### 8.1. Invariante obligatorii

- Aceeași tuplă `(generatorVersion, profileId, hand, seed)` produce exact aceeași structură.
- PRNG intern determinist (ex. Mulberry32 pe `seed` întreg pe 32 de biți validat); `Math.random()` este interzis în `srtGenerate`.
- Duratele pozitive umplu exact fiecare măsură în grila de ticks (`ticksPerQuarter = 480`).
- Fiecare măsură conține cel puțin o notă în MVP (fără măsuri complet goale).
- Nicio durată nu traversează bara de măsură în MVP.
- Înălțimile, salturile diatonice între note consecutive (ignorând pauzele intermediare) și ritmurile respectă constrângerile profilului.
- Cerințele de varietate sunt verificate de `srtValidatePiece`:
  - `P1.c`: cel puțin o pereche de note consecutive cu aceeași înălțime;
  - `P2.a`, `P2.b`, `P2.c`: cel puțin o pauză în piesă, dar **niciodată pe primul timp din prima măsură** (`onsetTick === 0`).
- Generarea are o limită fixă de încercări deterministe; o configurație invalidă/imposibilă aruncă o eroare explicită, fără a „repara” în tăcere profilul.
- Rendererul (`srRender` prin `srtToLegacyPiece`) și evaluatorul (`srtBuildExpected`) primesc exact același model validat.

Testăm seed-urile întregi `0..999` pentru fiecare profil (`P1.a`–`P2.c`) și fiecare mână (`rh`, `lh`), plus seed-uri de margine și profiluri invalide.

### 8.2. Digitație

MVP poate atașa doar degetul de start pe prima notă pentru poziția fixă de 5 degete (`C4–G4` RH / `C3–G3` LH). În `P2.c` (ambitus de o octavă), `finger` este `null` în MVP — nu inventăm digitație nesigură la schimbări de poziție. Digitația nu este criteriu de notare.

---

## 9. V2: fragmente și două mâini

### 9.1. Practice Slicer (`srtSlicePiece`)

Contract: `startBar` și `endBar` sunt indecși de măsură de la `1`, inclusivi (`1 <= startBar <= endBar <= piece.bars`). Fragmentul extras este reindexat să înceapă la `onsetTick = 0`, are `bars = endBar - startBar + 1` și păstrează metadatele `sourceFingerprint` și `{ startBar, endBar }`.

- Acceptă modelul validat cu măsură fixă și fără legături peste bara de măsură.
- Un fragment extras este întotdeauna marcat pentru practică (`eligibleForFirstSight: false`), nu ca piesă nouă.
- O piesă cu o singură mână nu primește pași goi pentru mâna absentă.
- Progresia ghidată propusă în V2: pas cu pas → tempo redus (75% BPM) → tempo țintă (100% BPM); pentru piese cu două mâini se adaugă RH, LH și împreună.

### 9.2. Două mâini

Începem în V2 cu registre separate (`lh < 60 <= rh`) și fără unison între mâini. Dacă o notă suplimentară (`FP`) nu poate fi atribuită neambiguu unei mâini, scorul global rămâne exact, iar raportul pe mâini marchează nota suplimentară ca globală.

---

## 10. V3: nivel estimat, nu „calibrare” garantată

**Condiție de intrare:** MVP și V2 stabile, generatorul verificat și review muzical al unui eșantion de exerciții din fiecare profil P3–P6.

### 10.1. Protocol experimental inițial

- Familie de profiluri fixă pe sesiune, aceeași mână/configurație, același protocol de preview (20 s) și aceeași sursă de input.
- Maximum **8 fragmente eligibile** finalizate sau **3 rezultate sub prag** (strike-uri).
- Criteriu de promovare pe un fragment:
  - Treaptă `+2` dacă `pitchF1 >= 96` și `rhythmAcc >= 90`;
  - Treaptă `+1` dacă `pitchF1 >= 85` și `rhythmAcc >= 80`.
- **Regula de confirmare în pereche:** Prima promovare la un profil `P` este provizorie (`provisionalLevel = P`) și programează al doilea fragment nou la **același profil `P`**. A doua promovare consecutivă la `P` confirmă `confirmedLevel = P` și avansează cu `min(step1, step2)` trepte.
- O nereușită (`pitchF1 < 85` sau `rhythmAcc < 80`) adaugă 1 strike, închide perechea curentă de confirmare și coboară un nivel (limitat la minimul familiei).
- La atingerea plafonului familiei, după confirmarea ultimului profil disponibil, sesiunea se încheie cu `stopReason: 'ceilingReached'`.
- O întrerupere tehnică (`interrupted`) nu produce strike și nu confirmă nivelul.

### 10.2. Definiția rezultatului sesiunii V3

- `confirmedLevel`: cel mai înalt profil confirmat prin două promovări consecutive în sesiune (sau `null` dacă nu s-a confirmat niciunul — afișat ca „date insuficiente”).
- `provisionalLevel`: cel mai înalt profil cu cel puțin o promovare.
- `testedRange`, `attemptsCount`, `strikes`, `stopReason` (`'maxAttempts'`, `'threeStrikes'`, `'ceilingReached'`, `'abandoned'`).

---

## 11. Interfață, localizare și accesibilitate

- În MVP, panoul de rezultat din `#rd-verdict` / sumarul execuției explică separat:
  - **Înălțimi (Pitch F1):** note atinse / așteptate (`TP / N`) și note suplimentare (`FP`),
  - **Ritm (Rhythm Acc):** atacuri la timp (`G`), apropiate (`Q`), întârziate/grăbite (`lateOrEarly`) și tendința medie (`meanOffsetMs` — ex. „în medie +18 ms mai târziu”),
  - **Statutul încercării:** badge clar „Prima vedere” vs „Practică în tempo”.
- Informația pe portativ și în sumar nu se transmite numai prin culoare: fiecare stare are etichetă textuală/simbol (`✓`, `≈`, `✗`, `+`) și tooltip SVG (`<title>`), similar cu `rdRhNoteTip`.
- Anunțurile `aria-live` se emit doar la schimbarea stării sesiunii (`preview`, `countIn`, `playing`, `completed`), niciodată pe fiecare frame de animație a cursorului.
- Controalele `Start` / `Pornește acum`, `Treci în practică` și `Stop` rămân vizibile fără scroll orizontal la **320 px** lățime și în landscape scund.
- `prefers-reduced-motion` este respectat.
- Redimensionarea ferestrei și schimbarea limbii (`ro` / `en` etc.) sau a temei (`light` / `dark`) în timpul `preview` sau `completed` nu pierd recorderul, nu regenerează piesa și nu invalidează încercarea.
- Folosim dicționarul și funcția `t(...)` / `tl(...)` existente în `etude.html` la momentul integrării.

---

## 12. Implementare task-by-task, cu TDD

### 12.1. Pregătire fără atingerea muncii locale

Dacă directorul principal are modificări în lucru pe altă ramură, nu face `checkout`, `reset`, `clean` sau `stash` distructiv. Creează un worktree separat din `origin/main` (sau ramura țintă aprobată de utilizator):

```bash
git -C C:/Users/mariu/Desktop/etude fetch origin
git -C C:/Users/mariu/Desktop/etude worktree add -b feature/sight-reading-v3 C:/Users/mariu/Desktop/etude-sight-reading origin/main
```

În worktree-ul de lucru:

```bash
npm ci
npx playwright install chromium
PW_CHANNEL= npm test -- --workers=4
```

Dacă portul `8787` este deja folosit de alt worktree, identifică procesul înainte de a rula testele pentru a nu testa alt fișier `etude.html`.

### 12.2. Ciclu obligatoriu pentru fiecare comportament

1. Scrie **un** test care exprimă următorul comportament.
2. Rulează testul țintit; verifică **FAIL (RED)** din motivul așteptat.
3. Implementează minimul necesar în `etude.html`.
4. Rulează din nou testul; cere **PASS (GREEN)**.
5. Rulează testele conexe, apoi regresia relevantă.
6. Refactorizează numai cu testele verzi.
7. Commit local mic, cu fișiere explicite; fără push sau merge automat.

Numele testelor noi încep cu `[srt:<categorie>]`, iar în CLI se filtrează cu `--grep 'srt:<categorie>'`.

### 12.3. Sarcini MVP, în ordinea dependențelor

| ID | Fișiere de modificat/creat | Comportamente și criteriu de ieșire | Test țintit |
|---|---|---|---|
| **M0** | Fără schimbări de produs | Captură baseline pe `main`; verificare că serverul de test servește worktree-ul curent și suita existentă trece. | Suita existentă |
| **M1** | `etude.html`; creare `tests/sight-reading-model.spec.mjs` | Modelul în ticks (`ticksPerQuarter = 480`), `srtValidatePiece`, adaptorul `srtToLegacyPiece` cu păstrarea `eventId ↔ nid`, `srtBuildExpected` și `srtFingerprint` **sincron** (Cyrb53/FNV-1a 64-bit hex). Teste pentru piesă goală, durate invalide, acord/pauză, invarianța fingerprint-ului la BPM/seed/digitație și sensibilitatea la note/pauze/măsură. | `srt:model` |
| **M2** | `etude.html`; creare `tests/sight-reading-score.spec.mjs` | Evaluatorul pur `srtEvaluate`: asociere monotonă prin programare dinamică per înălțime MIDI, restrângerea ferestrei la `45%` pentru note repetate apropiate, independența ordinii în acorduri, toți vectorii din Secțiunea 5.5, limitele exacte `100 ms` / `180 ms` / `250 ms`, `restViolations` și stele. | `srt:score` |
| **M3** | `etude.html`; creare `tests/sight-reading-recorder.spec.mjs` | Extinderea `onInputChange(kind, midi, source, releaseKind)` pentru a propaga `on` și `off` către recorderul `SR`; ignorarea clapelor ținute înainte de `-250 ms`; captură în `[-250 ms, T + 250 ms]`; excluderea sunetelor generate de aplicație (`srClick`, `previewNote`, `srListen`, `srPlayGap`); tratarea `releaseFocusInput` și `panic`. | `srt:recorder` |
| **M4** | `etude.html`; `tests/sight-reading-score.spec.mjs`; `tests/app.spec.mjs` | Integrarea `srtEvaluate` în modul în tempo (`assess`): oprirea colorării greedy din timpul `playing`, bariera de finalizare la `T + 250 ms`, colorarea notelor pe portativ la `completed`, separarea de `data.sheet[id].best`. Regresie: apăsarea tuturor clapelor (keyboard-mashing) nu mai produce 100% sau 3 stele. | `srt:integration` |
| **M5** | `etude.html`; creare `tests/sight-reading-generator.spec.mjs` | Generatorul determinist `srtGenerate(profile, seed)` pentru `P1.a`–`P2.c`, ambele mâini (`rh`, `lh`), PRNG fără `Math.random()`, verificarea invariantelor pe seed-urile `0..999` și respingerea profilurilor imposibile. | `srt:generator` |
| **M6** | `etude.html`; creare `tests/sight-reading-ledger.spec.mjs` | Registrul sincron `etude-sight-v1` (`srtLedgerRead`, `srtLedgerUpdate`): `claimExposure`, `recordExposure`, `finishAttempt`, `abandonAttempt`, idempotență, trunchierea la 500 de încercări fără ștergerea celor până la 4096 de expuneri, sincronizare prin evenimentul `storage` și fallback la practică dacă `localStorage` e blocat. | `srt:ledger` |
| **M7** | `etude.html`; creare `tests/sight-reading-flow.spec.mjs` | Mașina de stări `srtTransition` și integrarea în UI (`rdSightStart`, `rdGenMelody`, `#rd-mode`): `preparing → claiming → preview (20 s) → countIn → playing → completed`, butonul „Pornește acum”, butonul „Treci în practică”, invalidarea eligibilității la `Listen` / refresh / pierdere vizibilitate, re-rularea aceleiași piese ca „Practică în tempo”. | `srt:flow` |
| **M8** | `etude.html`; `tests/sight-reading-ledger.spec.mjs` | Export/import backup cu câmpul opțional `sightLedger`: compatibilitate cu backup-uri `v:3` fără `sightLedger`, reuniunea expunerilor și încercărilor, respingerea conflictelor de conținut pe același `attemptId`, transformarea claim-urilor neterminate importate în `abandoned`, protecția la `schemaVersion` viitoare. | `srt:backup` |
| **M9** | `etude.html`; creare `tests/sight-reading-ui.spec.mjs` | Sumarul explicabil al rezultatului (Pitch F1, Rhythm Acc, extra, offset mediu, badge Primă vedere vs Practică), simboluri non-culoare + tooltips pe note, responsivitate la 320 px și landscape, păstrarea stării la schimbarea limbii/temei. | `srt:ui` |
| **M10** | `tests/sight-reading-ui.spec.mjs`; `sw.js` (numai dacă e necesar) | Funcționare offline după prima încărcare, suita completă de regresie Playwright și verificare end-to-end. | `srt:offline` + suita completă |

Exemplu de rulare țintită:

```bash
PW_CHANNEL= npx playwright test tests/sight-reading-score.spec.mjs --grep 'srt:score' --workers=1
```

Exemplu de test de contract în Playwright:

```js
test('[srt:score] silence on a non-empty score is zero', async ({ app, page }) => {
  await app.open();
  const r = await page.evaluate(() => srtEvaluate(
    [{ id: 'rh-0:60', midi: 60, hand: 'rh', onMs: 0, offMs: 1000 }],
    [],
    { scoringVersion: 1 }
  ));
  expect(r.status).toBe('valid');
  expect(r.score).toBe(0);
  expect(r.stars).toBe(0);
  expect(r.meanOffsetMs).toBeNull();
});
```

### 12.4. Sarcini ulterioare (V2 și V3)

- **V2.1:** `srtSlicePiece` și teste dedicate în `tests/sight-reading-slicer.spec.mjs`.
- **V2.2:** Progresie ghidată pe fragmente (pas cu pas → 75% BPM → 100% BPM), fără pași pentru mâini inexistente.
- **V2.3:** Exerciții cu două mâini, acorduri și raportare per mână; versiune nouă de scoring dacă se punctează duratele (`offMs`).
- **V3.1:** Profilurile P3–P6, câte unul pe rând, cu validare de notație și digitație.
- **V3.2:** Algoritmul adaptiv pur (confirmare în pereche la același profil, maximum 8 probe sau 3 strike-uri) și simulări în `tests/sight-reading-adaptive.spec.mjs`.
- **V3.3:** UI pentru nivelul estimat (`confirmedLevel` vs `provisionalLevel`), fără echivalare cu examene externe.
- **V3.4:** Look-ahead opt-in, testat pentru accesibilitate și `prefers-reduced-motion`.

---

## 13. Matricea de verificare și porțile de acceptare

### 13.1. Teste automate obligatorii

| Domeniu | Cazuri care nu trebuie omise |
|---|---|
| **Scor (`srt:score`)** | Perfect, tăcere, note suplimentare (`FP`), substituții (`1 FN + 1 FP`), note lipsă, `near`, `lateOrEarly`, piesă goală (`N = 0`), limitele exacte `100 / 180 / 250 ms`, `restViolations` |
| **Polifonie & Repetări** | Acord cântat în ordine diferită a notelor, note repetate apropiate (restrângerea ferestrei la `45%`), un singur atac care nu poate satisface două note așteptate |
| **Recorder (`srt:recorder`)** | Propagarea `on` și `off` cu `source` și `releaseKind`, clapă ținută dinainte de `-250 ms` vs atac la `-100 ms`, captură până la `T + 250 ms`, excluderea `srClick` / `previewNote` / `srListen`, pierderea focusului (`releaseFocusInput`) |
| **Generator (`srt:generator`)** | Toate profilurile `P1.a`–`P2.c`, ambele mâini (`rh`, `lh`), seed-urile `0..999`, absența pauzei pe primul timp din măsura 1, rezolvarea pe tonică, respingerea unui profil invalid |
| **Prima vedere (`srt:flow`)** | Preview 20 s valid, „Pornește acum”, „Treci în practică”, expunere anterioară în `learn`/`practice`, apăsare `Listen`, refresh în timpul preview/execuție, schimbare BPM pe același conținut |
| **Stocare & Backup (`srt:ledger`, `srt:backup`)** | Izolarea `etude-sight-v1` față de `ptt-v3`, idempotență la salvare, limita de 500 `attempts` și 4096 `exposures`, backup `v:3` vechi fără `sightLedger`, conflict de `attemptId` la import, `QuotaExceededError` |
| **UI & Accesibilitate (`srt:ui`)** | Română și engleză, light/dark, viewports `320 px`, `390 px`, `1024 px`, `1920 px` și landscape scund, simboluri non-culoare pe note, `prefers-reduced-motion` |
| **Offline (`srt:offline`)** | Încărcare offline după vizită online pe aceeași origine; fingerprint și evaluare 100% funcționale fără conexiune sau context HTTPS |

### 13.2. Comenzi de verificare

```bash
PW_CHANNEL= npx playwright test tests/sight-reading-*.spec.mjs --workers=1
PW_CHANNEL= npm test -- --workers=4
```

- Cerem zero erori neașteptate și zero teste selectate în gol dacă se folosește `--grep`.
- Testele unitare de scor și generator injectează direct structuri de date în `page.evaluate(...)` (execuție în milisecunde, fără așteptări de timp real). Testele de integrare (`srt:flow`, `srt:recorder`) verifică legătura cu ceasul și DOM-ul real.

**Poarta MVP:** toate livrabilele `M1`–`M10` sunt verificate automat, suita existentă nu regresează, salvările `v:3` rămân compatibile, iar nicio funcție V2/V3 nu este prezentată fals drept activă.

---

## 14. Lansare, compatibilitate și revenire

- Implementarea se face într-un worktree separat, în pași mici verificabili (M1 → M10).
- Păstrăm compatibilitatea completă cu piesele fixe din `PIECES` și cu recordurile `data.sheet[id].best`.
- Revert-ul codului nu corupe `ptt-v3`: cheia `etude-sight-v1` este ignorată de versiunile anterioare ale aplicației și nu modifică `syncData`.

---

## 15. Rezumatul modificărilor față de v2

1. **Fingerprint sincron (`srtFingerprint`):** Înlocuit SHA-256 asincron (`crypto.subtle`) cu hash determinist sincron pe 64 de biți (Cyrb53 / FNV-1a pereche), garantând funcționarea pe `http://192.168.x.x` (testare mobilă în LAN) și `file://`, și păstrând tot pipeline-ul de model/claim 100% sincron.
2. **Persistență simplificată în MVP (`etude-sight-v1`):** Eliminată dependența de Web Locks asincrone în MVP în favoarea operațiilor atomice sincrone pe `localStorage` + ascultarea evenimentului `storage`, reducând complexitatea și suprafața de bug-uri în M6/M8.
3. **Cablarea explicită a pipeline-ului de input în M3:** Specificată extinderea `onInputChange(kind, midi, source, releaseKind)` și integrarea cu `handleNoteOn`, `handleNoteOff`, `releaseFocusInput` și `panic`, plus alinierea cu pragurile (`100 ms` / `180 ms`) din `rdRhGradeHand`.
4. **Mapare UX clară și compactă în `#rd-mode`:** Specificat cum „Prima încercare în tempo” și „Practică în tempo” partajează curat modul în tempo (`assess`) în funcție de eligibilitatea piesei, cu preview de 20 s, „Pornește acum” și „Treci în practică”, păstrând interfața suplă pe 320 px.
5. **Afișare coerentă în timpul execuției (`playing` vs `completed`):** Eliminată colorarea greedy în timp real din timpul `playing` în modurile în tempo, aplicând clasificarea vizuală (`good`, `near`, `bad`) la `completed` direct din rezultatul optim calculat de `srtEvaluate` după bariera `T + 250 ms`.

## Sources

[1] https://pianomarvel.com/en/article/the-ultimate-sight-reading-test
[2] https://completemusicreadingtrainer.com
[3] https://www.sightreadingfactory.com/focus/customization
