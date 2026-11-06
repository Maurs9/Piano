# Sight-Reading Adaptiv pentru Étude — Implementation Plan v3

> **For Hermes / Agent:** Use subagent-driven-development skill to implement this plan task-by-task.
> Dacă skill-ul respectiv nu este disponibil, folosește ciclul TDD din secțiunea 12 și review separat după fiecare etapă. Nu instala instrumente și nu implementa întregul document fără autorizarea utilizatorului.

**Goal:** Livrarea întâi a unui antrenament de citire la prima vedere cu scor explicabil și exerciții reproductibile (MVP), apoi extinderea către practică pe fragmente (V2) și estimarea adaptivă a nivelului (V3).

**Architecture:** Reutilizăm motoarele `SR` și `RD`, rendererul SVG (`srRender`) și infrastructura de input din `etude.html`. Separăm modelul partiturii în ticks, înregistrarea execuției (recorder conectat atât la `on` cât și la `off`), evaluatorul pur (`srtEvaluate`) și controlerul sesiunii. Păstrăm aplicația statică și toate funcțiile de model, fingerprint și evaluare **100% sincrone și pure**; registrul nou de încercări (`etude-sight-v1`) are o singură sursă de adevăr, nu intră în regulile generice de sincronizare (`SYNC_ADD` / `SYNC_MAX`) ale contoarelor vechi și își serializează scrierile între taburi prin Web Locks.

**Tech Stack:** HTML/CSS/JavaScript în `etude.html`, SVG existent, Web Audio, inputurile existente (MIDI, BLE MIDI, tastatură, pointer), Playwright. Pentru înregistrarea eligibilă folosim `localStorage` coordonat exclusiv între taburi prin Web Locks (`navigator.locks`) și notificări prin evenimentul `storage`; lipsa capabilităților nu blochează practica.

**Status:** Specificație de implementare revizuită (v3.2). Pragurile și curriculumul de mai jos sunt decizii inițiale de produs, aliniate cu evaluatorul ritmic existent (`rdRhGradeHand`), nu rezultate validate pedagogic.

**Data:** 6 noiembrie 2026.

**Bază inspectată:** `origin/main`, commit `2f69f5cc0795c4e0f6759261a57ecdac5e533eb1`.

**Documente anterioare:**
- `docs/plans/2026-11-06-sight-reading-research-and-plan.md` (v1 — istoric al cercetării)
- `docs/plans/2026-11-06-sight-reading-improved-plan.md` (v2 — specificație intermediară)
Documentul de față (v3) combină regulile stricte de concurență, ordinea celor două lock-uri, starea `pendingSave`, proprietatea pe tab și recuperarea din v2 cu precizia de integrare în codul existent din `etude.html` (pipeline-ul `onInputChange`, alinierea cu `rdRhGradeHand`, fingerprint-ul sincron FNV-1a 64-bit cu vectori verificați și maparea UI compactă).

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
| **Prima încercare în tempo** | Butonul `assess` pe o piesă generată **neexpusă încă** (când coordonarea registrului este disponibilă) | Fără `Listen`, fără ținte pe clape, fără nume de note pe portativ, fără acompaniament automat | **O singură încercare** eligibilă pe conținut local nou (preview 20 s → count-in 1 măsură → execuție) | Scor detaliat + statut `firstSight: true` salvat în `etude-sight-v1` |
| **Practică în tempo** | Același buton `assess` după consumarea primei încercări, pe piese de repertoriu fixe sau după apăsarea „Treci în practică” | Configurabile (inclusiv BPM, `Listen`, mâini separate) și vizibile în rezultat | Nelimitate | Scor detaliat din același evaluator `srtEvaluate`, etichetat `practice` |
| **Evaluare adaptivă — V3** | Sesiune dedicată din Drills (`RD` mode `test` pe unitatea `sr`) | Reguli fixe pe sesiune | Fragmente noi | Nivel estimat Étude, experimental (livrabil V3) |

**De ce această mapare UI:** Păstrăm selectorul `#rd-mode` compact (esențial la lățimea de 320 px pe mobil) și evităm aglomerarea barei de control cu 4 butoane permanente. Când o piesă nouă din generator este pregătită în modul `assess`, panoul obține mai întâi rezervarea exclusivă (`claiming`), apoi intră în starea `preview` (20 s cronometru vizibil, buton primar „Pornește acum” și buton secundar „Treci în practică”). După finalizare sau trecerea în practică, piesa rămâne disponibilă oricând pentru „Practică în tempo” și „Practică pas cu pas”.

### 2.2. Etape

**MVP — obligatoriu înainte de extindere**
1. Scor corect (`srtEvaluate`), recorder conectat la `on`/`off` și model în ticks cu contract stabil.
2. Generator determinist P1–P2, o singură mână la alegere, 4/4 și 3/4, pauze simple.
3. Flux complet: pregătire, claim coordonat între taburi, preview (20 s), count-in, execuție fără colorare prematură, rezultat explicabil (inclusiv starea `pendingSave` dacă stocarea eșuează la final).
4. Registru local (`etude-sight-v1`) al expunerilor și încercărilor, cu proprietar pe tab (`ownerTabId`), protocol explicit al celor două lock-uri Web Locks, protecție la reset (`generation`) și recuperare a rezervărilor orfane.
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

Fluxul propus (funcțiile de model, fingerprint și evaluare sunt **sincrone și pure**; doar mutațiile registrului `srtLedgerUpdate` sunt serializate prin Web Locks):

```text
profil + seed → srtGenerate → srtValidatePiece → srtFingerprint (sincron)
                                                       ↓
                             attempt lock → srtLedgerUpdate(claimExposure) [scurt]
                                                       ↓
preview (20s) → count-in → recorder (on/off) → srtEvaluate → srtLedgerUpdate(finishAttempt)
                                 ↓                                       ↓
                         onInputChange extins                   UI / etude-sight-v1
```

Funcții propuse:

- `srtGenerate(profile, seed)`: model determinist, pur, sincron, independent de DOM și ceas.
- `srtValidatePiece(piece, profile)`: validare structurală, ritmică și de profil (sincronă, pură).
- `srtToLegacyPiece(piece)`: adaptor sincron pentru `srRender`, care atașează fiecărei note generate un `eventId` stabil pentru maparea `nid ↔ expectedNote.id`.
- `srtCanonicalString(piece)`: serializare canonică deterministă a conținutului muzical.
- `srtFingerprint(piece)`: funcție **pură și sincronă** care aplică FNV-1a 64-bit peste `srtCanonicalString(piece)` și returnează `v1:<hex16>`.
- `srtBuildExpected(piece, config)`: evenimente evaluate în milisecunde (`id`, `midi`, `hand`, `onMs`, `offMs`).
- `srtEvaluate(expected, performed, config)`: evaluator pur, sincron și reproductibil.
- `srtTransition(state, event)`: mașina de stări pură a sesiunii, fără efecte secundare.
- `srtLedgerUpdate(operation)`: acces coordonat prin Web Locks la `localStorage['etude-sight-v1']`; nu este funcție pură.
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
- Un acord este un eveniment cu mai multe înălțimi în `pitches` (ordonate crescător după `midi`, apoi lexicografic după `spelling`), nu o ordine obligatorie de apăsare.
- Durata fiecărei voci umple exact măsurile (`bars * meter.num * (480 * 4 / meter.den)` ticks); nu deducem sfârșitul piesei doar din ultima notă atacată.
- În MVP nu există anacruze, schimbări de măsură, voci suprapuse în aceeași mână sau legături peste bara de măsură.
- Obiectele partiturii nu se modifică în timpul execuției. Rezultatele au structură separată.

### 3.2. Identitatea conținutului: Specificare Exactă și Vectori de Test

Fingerprint-ul se calculează dintr-o serializare canonică versionată (`srtCanonicalString(piece)`) care include exclusiv măsura, `ticksPerQuarter`, tonalitatea/armura, numărul de măsuri și evenimentele muzicale ordonate după `(hand, onsetTick)`.

Nu includem seed-ul, titlul, limba, tema, BPM-ul, `event.id`, `finger` sau `profileId`: aceeași partitură regenerată prin alt seed ori redeschisă la alt tempo nu devine automat nouă, iar schimbarea digitației nu șterge expunerea.

**Formatul exact al stringului canonic (`v1`):**
```text
v1|meter=<num>/<den>|tpq=<ticksPerQuarter>|key=<keyN>:<tonic>:<mode>|bars=<bars>|events=<ev0>;<ev1>;...
```
unde fiecare eveniment `<ev>` (ordonat după `hand` în ordinea `'lh' < 'rh'`, apoi crescător după `onsetTick`) este serializat ca:
- pentru pauză (`pitches.length === 0`): `<hand>:<onsetTick>:<durationTick>:R`
- pentru notă sau acord (`pitches` sortat crescător după `(midi, spelling)`): `<hand>:<onsetTick>:<durationTick>:<midi0>:<spelling0>,<midi1>:<spelling1>,...`

**Algoritmul exact de hash (`srtFingerprint` — FNV-1a 64-bit peste UTF-8):**
Folosim FNV-1a pe 64 de biți (`BigInt`) peste octeții UTF-8 (`new TextEncoder().encode(canonicalStr)`), astfel încât funcția să fie 100% sincronă și disponibilă inclusiv atunci când aplicația este deschisă pe telefon/tabletă prin HTTP pe IP local în LAN (`http://192.168.x.x:8787`, unde `crypto.subtle` este indisponibil):
- `offset_basis = 0xcbf29ce484222325n`
- `prime = 0x100000001b3n`
- `mask = 0xffffffffffffffffn`
- Pentru fiecare octet `b` din reprezentarea UTF-8:
  `hash ^= BigInt(b); hash = (hash * prime) & mask;`
- Rezultat returnat: `'v1:' + hash.toString(16).padStart(16, '0')` (16 cifre hexazecimale lowercase).

**Vectori de referință (calculați cu Node.js):**
1. String canonic:
   `v1|meter=4/4|tpq=480|key=0:C:major|bars=1|events=rh:0:480:60:C4;rh:480:480:62:D4;rh:960:960:60:C4`
   → Fingerprint: `v1:e8020957ec2a1005`
2. String canonic (cu pauză pe timpul 2):
   `v1|meter=4/4|tpq=480|key=0:C:major|bars=1|events=rh:0:480:60:C4;rh:480:480:R;rh:960:960:60:C4`
   → Fingerprint: `v1:8472a9986749aba1`

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
- Sursa de input (`midi`, `ble`, `kb`, `ptr`) este stocată în rezultat. O schimbare de sursă în timpul primei încercări invalidează încercarea pentru comparații (`mixedInput: true`); practica poate continua.
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

## 6. Prima încercare: mașina de stări, proprietate pe tab și eligibilitate

### 6.1. Stări

```text
idle → preparing → claiming → preview → countIn → playing → completed (saved)
                        ↓         ↓         ↓          ↓         ↓
                     blocked   abandoned  abandoned  interrupted pendingSave → saved / abandoned
```

- `preparing`: generare, validare, calcul fingerprint sincron, pregătire audio și verificare input; partitura nu este încă vizibilă.
- `claiming`: tabul dobândește **întâi** lock-ul de sesiune al încercării (`etude-sight-attempt-<attemptId>`) și, în timp ce acesta este activ, dobândește **scurt** blocarea exclusivă a registrului (`etude-sight-ledger-v1`) pentru a verifica eligibilitatea și a persista rezervarea `{ attemptId, ownerTabId, generation, fingerprint }`. Blocarea registrului este eliberată imediat după scrierea în `localStorage`, **înainte** de intrarea în `preview`. Dacă `fingerprint` a fost deja expus (sau coordonarea este indisponibilă), eliberăm și lock-ul încercării și intrăm în `blocked` / modul `practice`.
- `preview`: abia după salvarea rezervării și eliberarea lock-ului registrului afișăm partitura și pornim cronometrul de 20 s (păstrând activ doar lock-ul încercării `etude-sight-attempt-<attemptId>`). La sfârșitul celor 20 s (sau la apăsarea „Pornește acum”) se trece automat în `countIn`. Utilizatorul poate apăsa „Treci în practică”, ceea ce marchează încercarea ca `abandoned`, eliberează lock-ul încercării și comută în „Practică în tempo”.
- `countIn`: o măsură de metronom; configurația (BPM, mână, ajutoare) este înghețată.
- `playing`: recorder activ în fereastra `[-250 ms, T + 250 ms]`; pe portativ se mișcă doar cursorul.
- `completed`: tranziția din `playing` spre `completed` are loc **numai după bariera `T + 250 ms`**. Evaluatorul produce și îngheață rezultatul calculat, colorăm notele pe portativ și apelăm `finishAttempt` sub `etude-sight-ledger-v1` (verificând `generation` și `ownerTabId`). Dacă salvarea reușește, eliberăm lock-ul încercării `etude-sight-attempt-<attemptId>`.
- `pendingSave`: dacă salvarea rezultatului la `completed` eșuează (de ex. `QuotaExceededError`), rezultatul calculat rămâne înghețat și afișat pe ecran, iar **lock-ul încercării `etude-sight-attempt-<attemptId>` rămâne deținut** cât timp pagina permite reîncercarea salvării („Reîncearcă salvarea”) sau renunțarea explicită („Continuă fără salvare”). Astfel, un alt tab nu poate considera rezervarea orfană și nu o poate marca `abandoned` cât timp utilizatorul încearcă să salveze rezultatul. Lock-ul încercării se eliberează doar după reușita salvării, după renunțarea explicită (care încearcă marcarea `abandoned`) sau la închiderea paginii.
- `abandoned` / `interrupted`: fără scor de primă vedere și fără strike (în V3); conținutul rămâne marcat ca expus, lock-ul încercării este eliberat, iar piesa poate fi exersată imediat în practică.

### 6.2. Ordinea lock-urilor, proprietarul rezervării și recuperarea

Verificăm dacă fingerprint-ul exista **înaintea claim-ului**, nu după preview. Preview-ul autorizat nu își invalidează propria încercare (`attemptId`).

O rezervare are `{ attemptId, ownerTabId, generation, fingerprint }`. După rezervare, alt tab poate deschide același conținut doar ca practică. Eligibilitatea este legată de tupla `(attemptId, ownerTabId, generation)`, nu o proprietate booleană globală recalculată la redraw.

**Protocolul exact al celor două lock-uri (evitarea ferestrei de orfan fals și a blocării registrului):**
1. **Ordinea la rezervare (`claiming`):**
   - Pasul 1: Generează `attemptId` și dobândește `navigator.locks.request('etude-sight-attempt-' + attemptId, { mode: 'exclusive' }, () => attemptLeasePromise)`. Acest lock rămâne deținut prin promisiunea `attemptLeasePromise` pe toată durata sesiunii (`claiming` → `preview` → `countIn` → `playing` → `completed` / `pendingSave`), dar **nu** înfășoară lock-ul registrului pe durata sesiunii.
   - Pasul 2: După ce callback-ul lui `etude-sight-attempt-<attemptId>` a pornit (deci lock-ul încercării este garantat activ), apelează `srtLedgerUpdate({ type: 'claimExposure', ... })`, care dobândește exclusiv `etude-sight-ledger-v1` doar pentru câteva milisecunde (citire → validare → scriere în `localStorage`), apoi returnează și **eliberează imediat `etude-sight-ledger-v1`** înainte de `preview`.
   - Dacă `claimExposure` este respins (conținut deja expus), rezolvăm imediat `attemptLeasePromise` pentru a elibera `etude-sight-attempt-<attemptId>`.
2. **Ordinea la recuperare (`recoverOrphanClaims`):**
   - Sub blocarea exclusivă `etude-sight-ledger-v1`, citim registrul curent, verificăm `generation` și identificăm rezervările fără rezultat terminal în `attempts`.
   - Pentru fiecare astfel de rezervare, testăm neblocant `navigator.locks.request('etude-sight-attempt-' + attemptId, { ifAvailable: true }, lock => Boolean(lock))`. Deoarece cererea are `ifAvailable: true`, ea nu așteaptă niciodată și nu poate produce deadlock.
   - Dacă `lock` este `null` (adică un tab proprietar activ ține încă `etude-sight-attempt-<attemptId>` în `preview`, `countIn`, `playing` sau `pendingSave`), rezervarea este **activă** și nu este atinsă.
   - Numai dacă `lock` este obținut (tabul proprietar s-a închis sau a dat refresh) și starea din registru este încă neterminată în aceeași `generation`, marcăm încercarea drept `abandoned` și salvăm registrul înainte de eliberarea `etude-sight-ledger-v1`.

Reguli obligatorii suplimentare:
- Orice afișare a unei partituri din noul sistem în afara preview-ului autorizat înregistrează mai întâi `recordExposure(fingerprint, reason)`, sub aceeași blocare scurtă `etude-sight-ledger-v1` ca rezervarea. Operația este idempotentă.
- Dacă expunerea nu poate fi persistată (eroare de stocare sau lipsa Web Locks), practica poate continua cu avertisment, dar dezactivăm eligibilitatea de primă vedere în tabul curent.
- MVP permite „Prima încercare” numai pe conținut generat de noul protocol (`srtGenerate`). Piesele fixe din `PIECES` rămân în practică.
- `Listen` înainte de claim înregistrează expunere și permite numai practică ulterior. `Listen`, indicii sau reluare în timpul primei încercări încheie eligibilitatea (`abandoned`), eliberează lock-ul încercării și cer trecere explicită la practică.
- Schimbarea limbii, temei sau dimensiunii ferestrei nu invalidează execuția și nu resetează recorderul.
- Durata efectivă de preview (`previewDurationMs`, <= 20000 ms) este salvată în rezultat când utilizatorul apasă „Pornește acum”.

---

## 7. Persistență, concurență și backup

### 7.1. O singură sursă de adevăr (`etude-sight-v1`)

Păstrăm progresul existent în `ptt-v3`, dar folosim cheia separată `etude-sight-v1` pentru noul registru. Motivul este izolarea completă de regulile generice `SYNC_ADD` / `SYNC_MAX` din `syncData`.

Nu menținem o a doua copie autoritară a încercărilor în `data.reading`. UI-ul citește registrul; rezumatele din memorie sunt derivate și reconstruibile.

```js
{
  schemaVersion: 1,
  generation: 'gen-1762460000000-a1b2',
  revision: 1,
  exposures: {
    // fingerprint → { firstSeenAt, reason, claim: { attemptId, ownerTabId, generation } }
  },
  attempts: {
    // attemptId → rezultat terminal imuabil (status: 'completed' | 'abandoned' | 'interrupted', generation, ownerTabId, ...)
  },
  prefs: { practiceHints: true, lookAhead: false },
  sessions: { /* V3: rezumate versionate */ }
}
```

### 7.2. Protocolul de scriere coordonat între taburi

Deoarece `localStorage` nu oferă un mutex între taburi conform specificației WHATWG Web Storage, toate scrierile în registru (`srtLedgerUpdate(operation)`) sunt serializate prin blocarea exclusivă `etude-sight-ledger-v1` folosind Web Locks API (`navigator.locks.request('etude-sight-ledger-v1', { mode: 'exclusive' }, ...)`):

1. Citește ultimul registru din `localStorage.getItem('etude-sight-v1')` și validează-i schema.
2. **Verifică `generation` și precondițiile operației:**
   - Pentru `finishAttempt` și `abandonAttempt`, operația transportă obligatoriu `(attemptId, ownerTabId, generation)` capturate la `claimExposure`.
   - **Protecție strictă la reset:** Dacă `operation.generation !== ledger.generation`, operația este respinsă cu `{ ok: false, reason: 'stale_generation' }` fără a modifica registrul. O încercare începută înaintea unui reset în alt tab nu poate salva rezultate în generația nouă.
   - Dacă `attemptId` nu aparține lui `operation.ownerTabId`, operația este respinsă (`reason: 'owner_mismatch'`).
3. Aplică transformarea mică și idempotentă și incrementează `revision`.
4. Salvează registrul complet în `localStorage.setItem('etude-sight-v1', ...)` înainte de eliberarea blocării.
5. Recitește pentru confirmarea scrierii și notifică celelalte taburi (evenimentul `storage` notifică cititorii UI, dar nu înlocuiește Web Locks).

Nu așteptăm audio, rețea sau animații în interiorul blocării `etude-sight-ledger-v1`.

Operații distincte: `claimExposure`, `recordExposure`, `recordListen`, `finishAttempt`, `abandonAttempt`, `recoverOrphanClaims`, `updatePrefs`, `resetLedger`, `importLedger`. Salvarea de două ori a aceluiași rezultat (`same attemptId, same payload`) este idempotentă și nu dublează încercarea.

**Fără Web Locks sau stocare disponibilă:** practica funcționează normal; nu promitem prima încercare coordonată între taburi și dezactivăm modul „Prima încercare” cu o explicație clară în UI.

### 7.3. Creșterea datelor, `pendingSave` și eșecuri

- Păstrăm cel mult ultimele **500 de rezultate detaliate** în `attempts`, ordonate determinist după `(finishedAt, attemptId)`.
- Expunerile (`exposures`) nu se șterg odată cu trunchierea `attempts`, pentru ca exercițiile vechi să nu redevină fals „noi”.
- Limita pentru `exposures` în MVP este **4096 de identități**. La atingerea ei, practica rămâne disponibilă, dar o nouă primă încercare este oprită până la o decizie explicită de arhivare sau resetare. Nu eliminăm în tăcere identități.
- La `QuotaExceededError` sau eroare de scriere înainte de preview nu afișăm conținutul ca încercare eligibilă; eliberăm imediat lock-ul încercării și oferim practică.
- **Starea `pendingSave` la eșecul salvării după execuție:** Dacă salvarea rezultatului la `completed` eșuează (`QuotaExceededError`), sesiunea intră în `pendingSave`: rezultatul calculat rămâne înghețat pe ecran cu mesajul „rezultat nesalvat”, iar **lock-ul încercării (`etude-sight-attempt-<attemptId>`) rămâne deținut** cât timp pagina permite reîncercarea salvării (cu același `attemptId`, `ownerTabId` și `generation`). Astfel, un alt tab care rulează `recoverOrphanClaims` vede lock-ul ocupat și **nu** marchează rezervarea drept `abandoned`. Lock-ul încercării este eliberat doar după ce reîncercarea salvării reușește, utilizatorul renunță explicit la salvare sau pagina se închide.
- Un `resetLedger` generează un `generation` nou sub blocarea exclusivă. Orice încercare pornită înaintea resetului (inclusiv una aflată în `pendingSave`) va fi respinsă la `finishAttempt` cu `reason: 'stale_generation'` datorită verificării `operation.generation === ledger.generation`.
- Dacă în `etude-sight-v1` este găsită o `schemaVersion > 1` (scrisă de o versiune viitoare), nu o înlocuim automat cu `{}`; păstrăm datele intacte, oferim export și menținem doar practica.

### 7.4. Backup și migrare

- Backup-urile existente `v:3` continuă să fie acceptate de `isBackupPayload`.
- Extindem exportul printr-un câmp opțional, versionat, `sightLedger`, fără a modifica semnificația lui `data` pentru aplicația existentă.
- Absența lui `sightLedger` într-un backup vechi nu șterge registrul curent de expuneri.
- Importul obișnuit se execută sub blocarea `etude-sight-ledger-v1`:
  - Construim și validăm integral registrul candidat înainte de scriere.
  - **Păstrăm `generation`-ul curent al profilului local** și rezervările locale active (cele ale căror lock-uri `etude-sight-attempt-<id>` sunt deținute de un tab local activ).
  - Rezervările neterminate provenite din fișierul importat nu sunt reluabile și sunt înregistrate doar ca expuneri istorice (`abandoned`). Importul nu poate transfera dreptul activ de primă încercare.
  - Facem reuniunea (`union`) dicționarului `exposures` și a dicționarului `attempts` după `attemptId`.
  - Rezultatele cu același `attemptId` și conținut identic se deduplică. Dacă același `attemptId` are conținut diferit, respingem importul și explicăm conflictul.
  - Aplicăm limita de 500 pentru `attempts` după reuniune. Dacă `exposures` reunite depășesc 4096 sau validatorul găsește valori invalide (NaN/Infinity, scoruri în afara `[0, 100]`, MIDI în afara `[0, 127]`), respingem importul fără modificarea registrului curent.
  - Intrările nevalidate nu ajung niciodată în `innerHTML`.

---

## 8. Generatorul MVP: P1–P2

Profilul este o configurație explicită, nu doar un număr de dificultate. Mâna (`rh` sau `lh`) se alege separat; cheia este determinată de mână (`treble` pentru `rh`, `bass` pentru `lh`).

| Profil | Măsură | Ambitus | Durate permise | Salt maxim diatonic | Pauze |
|---|---|---|---|---|---|
| `P1.a` | 4/4 | Poziție fixă de 5 note | Pătrimi (`480`), doimi (`960`) | Secundă (pas treptat + repetări) | Nu |
| `P1.b` | 4/4 | Poziție fixă de 5 note | Pătrimi (`480`), doimi (`960`) | Terță | Nu |
| `P1.c` | 4/4 | Poziție fixă de 5 note | Pătrimi (`480`), doimi (`960`) | Terță; cel puțin o notă repetată | Nu |
| `P2.a` | 4/4 | Poziție fixă de 5 note | Pătrimi (`480`), doimi (`960`) | Terță | Pauză de pătrime (`480`, minimum 1) |
| `P2.b` | 3/4 | Poziție fixă de 5 note | Pătrimi (`480`), doimi (`960`) | Terță | Pauză de pătrime (`480`, minimum 1) |
| `P2.c` | 3/4 sau 4/4 (fixată în profil) | Maximum o octavă (`C4–C5` / `C3–C4`) | Pătrimi (`480`), doimi (`960`) | Terță | Pătrime (`480`) sau doime (`960`) când încape |

Valori inițiale: Do major (`keyN: 0`), 4 măsuri, 60 BPM în prima încercare (în practică tempo-ul poate fi schimbat liber). Pozițiile fixe de 5 note sunt `C4–G4` pentru mâna dreaptă și `C3–G3` pentru mâna stângă.
**Regulă de cadență finală (fără contradicții de durată):** Măsura a 4-a se încheie pe tonică (`C4` / `C3`) folosind **exclusiv duratele permise de tabelul profilului** — în `4/4` ultima notă este o doime (`960` ticks) precedată de două pătrimi sau o doime; în `3/4` (`P2.b`, `P2.c`) măsura a 4-a este alcătuită dintr-o pătrime pe timpul 1 urmată de o doime pe tonică pe timpii 2–3 (`480 + 960 = 1440` ticks). Nu folosim doimi punctate în MVP, astfel încât generatorul și validatorul `srtValidatePiece` aplică exact aceeași mulțime de durate (`[480, 960]`).

### 8.1. Invariante obligatorii

- Aceeași tuplă `(generatorVersion, profileId, hand, seed)` produce exact aceeași structură.
- PRNG intern determinist (Mulberry32 pe `seed` întreg pe 32 de biți validat); `Math.random()` este interzis în `srtGenerate`.
- Duratele pozitive aparțin exclusiv listei de durate a profilului (`[480, 960]` în MVP) și umplu exact fiecare măsură în grila de ticks (`ticksPerQuarter = 480`).
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
  - **Scor înălțimi (F1):** procentul `Math.round(pitchF1)`%,
  - **Note atinse (Recall):** `TP / N`,
  - **Atacuri suplimentare:** `FP`,
  - **Ritm (Rhythm Acc):** procentul `Math.round(rhythmAcc)`%, atacuri la timp (`G`), apropiate (`Q`), întârziate/grăbite (`lateOrEarly`) și tendința medie (`meanOffsetMs` — ex. „în medie +18 ms mai târziu”),
  - **Statutul încercării:** badge clar „Prima vedere” vs „Practică în tempo” (sau „Rezultat nesalvat” în starea `pendingSave`).
- Informația pe portativ și în sumar nu se transmite numai prin culoare: fiecare stare are etichetă textuală/simbol (`✓`, `≈`, `✗`, `+`) și tooltip SVG (`<title>`), similar cu `rdRhNoteTip`.
- Anunțurile `aria-live` se emit doar la schimbarea stării sesiunii (`preview`, `countIn`, `playing`, `completed`, `pendingSave`), niciodată pe fiecare frame de animație a cursorului.
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
| **M1** | `etude.html`; creare `tests/sight-reading-model.spec.mjs` | Modelul în ticks (`ticksPerQuarter = 480`), `srtValidatePiece`, adaptorul `srtToLegacyPiece` cu păstrarea `eventId ↔ nid`, `srtBuildExpected`, `srtCanonicalString` și `srtFingerprint` **sincron** (FNV-1a 64-bit cu vectorii exacti `v1:e8020957ec2a1005` și `v1:8472a9986749aba1`). Teste pentru piesă goală, durate invalide, acord/pauză, invarianța fingerprint-ului la BPM/seed/digitație și sensibilitatea la note/pauze/măsură. | `srt:model` |
| **M2** | `etude.html`; creare `tests/sight-reading-score.spec.mjs` | Evaluatorul pur `srtEvaluate`: asociere monotonă prin programare dinamică per înălțime MIDI, restrângerea ferestrei la `45%` pentru note repetate apropiate, independența ordinii în acorduri, toți vectorii din Secțiunea 5.5, limitele exacte `100 ms` / `180 ms` / `250 ms`, `restViolations` și stele. | `srt:score` |
| **M3** | `etude.html`; creare `tests/sight-reading-recorder.spec.mjs` | Extinderea `onInputChange(kind, midi, source, releaseKind)` pentru a propaga `on` și `off` către recorderul `SR`; ignorarea clapelor ținute înainte de `-250 ms`; captură în `[-250 ms, T + 250 ms]`; excluderea sunetelor generate de aplicație (`srClick`, `previewNote`, `srListen`, `srPlayGap`); tratarea `releaseFocusInput` și `panic`. | `srt:recorder` |
| **M4** | `etude.html`; `tests/sight-reading-score.spec.mjs`; `tests/app.spec.mjs` | Integrarea `srtEvaluate` în modul în tempo (`assess`): oprirea colorării greedy din timpul `playing`, bariera de finalizare la `T + 250 ms`, colorarea notelor pe portativ la `completed`, separarea de `data.sheet[id].best`. Regresie: apăsarea tuturor clapelor (keyboard-mashing) nu mai produce 100% sau 3 stele. | `srt:integration` |
| **M5** | `etude.html`; creare `tests/sight-reading-generator.spec.mjs` | Generatorul determinist `srtGenerate(profile, seed)` pentru `P1.a`–`P2.c`, ambele mâini (`rh`, `lh`), PRNG Mulberry32 fără `Math.random()`, cadența finală în 4/4 și 3/4 exclusiv din duratele permise (`[480, 960]`), verificarea invariantelor pe seed-urile `0..999` și respingerea profilurilor imposibile. | `srt:generator` |
| **M6** | `etude.html`; creare `tests/sight-reading-ledger.spec.mjs` | Registrul `etude-sight-v1` coordonat prin Web Locks: achiziția `etude-sight-attempt-<id>` **înainte** de publicarea rezervării sub blocarea scurtă `etude-sight-ledger-v1` (eliberată înainte de `preview`), `claimExposure` atomic între două taburi concurente, protecția unei încercări active (inclusiv în `pendingSave`) la citirea/recuperarea din alt tab, recuperarea doar a rezervărilor orfane cu reverificarea `generation` sub lock, respingerea `finishAttempt` cu `generation` veche după un reset în alt tab, idempotență, limitele 500/4096 și fallback explicit la practică fără Web Locks. | `srt:ledger` |
| **M7** | `etude.html`; creare `tests/sight-reading-flow.spec.mjs` | Mașina de stări `srtTransition` și integrarea în UI (`rdSightStart`, `rdGenMelody`, `#rd-mode`): `preparing → claiming → preview (20 s) → countIn → playing → completed / pendingSave`, butonul „Pornește acum”, butonul „Treci în practică”, reîncercarea salvării din `pendingSave` cu păstrarea lock-ului încercării, invalidarea eligibilității la `Listen` / refresh / pierdere vizibilitate, re-rularea aceleiași piese ca „Practică în tempo”. | `srt:flow` |
| **M8** | `etude.html`; `tests/sight-reading-ledger.spec.mjs` | Export/import backup cu câmpul opțional `sightLedger`: compatibilitate cu backup-uri `v:3` fără `sightLedger`, păstrarea `generation`-ului curent și a rezervărilor active locale, transformarea claim-urilor importate în `abandoned`, reuniunea expunerilor și încercărilor, respingerea conflictelor de conținut pe același `attemptId`, protecția la `schemaVersion` viitoare. | `srt:backup` |
| **M9** | `etude.html`; creare `tests/sight-reading-ui.spec.mjs` | Sumarul explicabil al rezultatului (Scor înălțimi F1 %, Note atinse `TP / N`, Atacuri suplimentare `FP`, Rhythm Acc %, offset mediu, badge Primă vedere vs Practică), simboluri non-culoare + tooltips pe note, responsivitate la 320 px și landscape, păstrarea stării la schimbarea limbii/temei. | `srt:ui` |
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
| **Generator (`srt:generator`)** | Toate profilurile `P1.a`–`P2.c`, ambele mâini (`rh`, `lh`), seed-urile `0..999`, absența pauzei pe primul timp din măsura 1, cadența pe tonică în 4/4 și 3/4 exclusiv din duratele permise (`[480, 960]`), respingerea unui profil invalid |
| **Prima vedere (`srt:flow`)** | Preview 20 s valid, „Pornește acum”, „Treci în practică”, expunere anterioară în `learn`/`practice`, apăsare `Listen`, refresh în timpul preview/execuție, schimbare BPM pe același conținut |
| **Stocare, Concurență & Backup (`srt:ledger`, `srt:backup`)** | Ordinea lock-urilor (`attempt-lock` înainte de `ledger-lock` scurt), două taburi cu claim simultan pe același fingerprint, citire/recuperare în Tab B fără abandonarea încercării active sau aflate în `pendingSave` din Tab A, reset în Tab B urmat de `finishAttempt` respins (`stale_generation`) în Tab A, idempotență la salvare, limita de 500 `attempts` și 4096 `exposures`, backup `v:3` vechi fără `sightLedger`, conflict de `attemptId` la import, claim importat transformat în `abandoned`, `QuotaExceededError` |
| **UI & Accesibilitate (`srt:ui`)** | Afișare separată pentru Scor înălțimi F1 %, Note atinse (`TP / N`) și Atacuri suplimentare (`FP`); română și engleză, light/dark, viewports `320 px`, `390 px`, `1024 px`, `1920 px` și landscape scund, simboluri non-culoare pe note, `prefers-reduced-motion` |
| **Offline (`srt:offline`)** | Încărcare offline după vizită online pe aceeași origine; fingerprint și evaluare 100% funcționale fără conexiune sau context HTTPS |

### 13.2. Comenzi de verificare

```bash
PW_CHANNEL= npx playwright test tests/sight-reading-*.spec.mjs --workers=1
PW_CHANNEL= npm test -- --workers=4
```

- Cerem zero erori neașteptate și zero teste selectate în gol dacă se folosește `--grep`.
- Testele unitare de scor și generator injectează direct structuri de date în `page.evaluate(...)`. Testele de integrare (`srt:flow`, `srt:recorder`, `srt:ledger`) verifică legătura cu ceasul, DOM-ul și coordonarea între două pagini Playwright din același `BrowserContext`.

**Poarta MVP:** toate livrabilele `M1`–`M10` sunt verificate automat, suita existentă nu regresează, salvările `v:3` rămân compatibile, iar nicio funcție V2/V3 nu este prezentată fals drept activă.

---

## 14. Lansare, compatibilitate și revenire

- Implementarea se face într-un worktree separat, în pași mici verificabili (M1 → M10).
- Păstrăm compatibilitatea completă cu piesele fixe din `PIECES` și cu recordurile `data.sheet[id].best`.
- Revert-ul codului nu corupe `ptt-v3`: cheia `etude-sight-v1` este ignorată de versiunile anterioare ale aplicației și nu modifică `syncData`.

---

## 15. Rezumatul arhitecturii v3.2 (Sinteza finală)

1. **Fingerprint sincron și complet specificat (`srtFingerprint` — §3.2):** FNV-1a pe 64 de biți (`BigInt`, `offset_basis = 0xcbf29ce484222325n`, `prime = 0x100000001b3n`) peste octeții UTF-8 ai serializării canonice `srtCanonicalString(piece)`, cu vectori de test verificați cu Node.js (`v1:e8020957ec2a1005` și `v1:8472a9986749aba1`), funcționând inclusiv pe HTTP în LAN la testarea pe mobil.
2. **Protocolul exact al celor două lock-uri și starea `pendingSave` (§6.1–6.2, §7.2–7.3):**
   - La `claiming`, tabul dobândește întâi `etude-sight-attempt-<attemptId>` (ținut pe durata sesiunii prin promisiune) și în interiorul lui dobândește **scurt** `etude-sight-ledger-v1` pentru a publica rezervarea, eliberând `etude-sight-ledger-v1` înainte de `preview`.
   - Dacă salvarea rezultatului la `completed` eșuează (`QuotaExceededError`), sesiunea intră în `pendingSave` cu rezultatul înghețat și **păstrează `etude-sight-attempt-<attemptId>`** cât timp utilizatorul poate reîncerca salvarea, prevenind abandonarea falsă din alt tab.
   - Orice scriere verifică `operation.generation === ledger.generation` sub `etude-sight-ledger-v1`.
3. **Cablarea explicită a pipeline-ului de input în M3 (§4.1):** Extinderea `onInputChange(kind, midi, source, releaseKind)` și integrarea cu `handleNoteOn`, `handleNoteOff`, `releaseFocusInput` și `panic`, plus alinierea cu pragurile (`100 ms` / `180 ms`) din `rdRhGradeHand`.
4. **Cadență în 3/4 și 4/4 fără contradicții de durată (§8):** Măsura finală folosește exclusiv duratele permise de tabelul profilului (`480` și `960` ticks), eliminând doima punctată din MVP.
5. **Mapare UX compactă și afișare separată F1 / Recall / Extra (§2.1, §4.3, §11):** Afișarea distinctă a Scorului înălțimi F1 (%), a Notelor atinse (`TP / N`) și a Atacurilor suplimentare (`FP`), plus aplicarea culorilor și simbolurilor pe note doar la `completed`, după bariera `T + 250 ms`.

## Sources

[1] https://pianomarvel.com/en/article/the-ultimate-sight-reading-test
[2] https://completemusicreadingtrainer.com
[3] https://www.sightreadingfactory.com/focus/customization
