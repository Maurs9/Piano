# Sight-Reading Adaptiv pentru Étude — Implementation Plan v2

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.
> Dacă skill-ul respectiv nu este disponibil, folosește ciclul TDD din secțiunea 12 și review separat după fiecare etapă. Nu instala instrumente și nu implementa întregul document fără autorizarea utilizatorului.

**Goal:** Livrarea întâi a unui antrenament de citire cu scor explicabil și exerciții reproductibile, apoi extinderea către practică pe fragmente și estimarea adaptivă a nivelului.

**Architecture:** Reutilizăm motoarele `SR` și `RD`, rendererul și infrastructura de input. Separăm modelul partiturii, înregistrarea execuției, evaluatorul pur și controlerul sesiunii. Păstrăm aplicația statică; registrul nou de încercări are o singură sursă de adevăr și nu intră accidental în regulile generice de sincronizare a contoarelor vechi.

**Tech Stack:** HTML/CSS/JavaScript în `etude.html`, SVG existent, Web Audio, inputurile existente, Playwright. Pentru înregistrarea eligibilă folosim stocare locală și coordonare explicită între taburi; lipsa capabilităților nu blochează practica.

**Status:** Propunere de proiectare, nu implementare. Pragurile și curriculumul de mai jos sunt decizii inițiale de produs, nu rezultate validate pedagogic.

**Data:** 6 noiembrie 2026.

**Bază inspectată:** `origin/main`, commit `2f69f5cc0795c4e0f6759261a57ecdac5e533eb1`.

**Document anterior:** `docs/plans/2026-11-06-sight-reading-research-and-plan.md`. Acesta rămâne neschimbat. Documentul de față îl înlocuiește ca specificație propusă pentru implementarea funcțiilor de sight-reading, nu ca istoric al cercetării.

---

## 1. Domeniu, dovezi și limite

### 1.1. Ce este verificat în codul de bază

Referințele sunt simboluri la commitul de mai sus; numerele de linie nu sunt contracte stabile.

| Componentă | Observație verificată | Consecință pentru implementare |
|---|---|---|
| `srAssessFinish` | Procentul actual folosește notele corecte raportate la notele așteptate. `SR.wrongExtra` este afișat, dar nu reduce procentul. | Primul livrabil corectează scorul și păstrează separat rezultatele istorice. |
| `srKeyInput` | Evaluarea existentă înregistrează rezultate pe note, nu un jurnal complet al execuției. | Evaluatorul nou necesită un recorder; simpla înlocuire a formulei nu este suficientă. |
| `handleNoteOn`, `handleNoteOff`, `inputOwners` | Există deduplicare a inputului și gestiune a surselor care țin aceeași notă. | Recorderul se conectează la evenimentele efective de input, nu la fiecare mesaj brut duplicat. |
| `srEvents`, `srRender` | Modelul existent acceptă note, acorduri și pauze `R`; rendererul citește `ts`. | Folosim un adaptor compatibil, nu înlocuim gratuit rendererul. Asta nu dovedește suport complet pentru orice notație nouă. |
| `srStepsBuild` | Notele sunt grupate după momentul de atac și mâinile selectate. | Păstrăm grupurile simultane; nu impunem o ordine globală arbitrară notelor unui acord. |
| `rdSightGen` | Generatorul actual folosește aleatoriu global și construiește exerciții 4/4. | Noul generator primește explicit profilul și seed-ul. |
| `srAssessStart`, `srPlayGap` | Mâna neexersată poate fi redată automat. | Această asistență este permisă în practică, nu într-o evaluare neasistată. |
| `rdData`, `syncData`, `SYNC_ADD`, `SYNC_MAX` | Există progres și reguli de comasare specifice datelor actuale. | Nu aplicăm implicit aceleași reguli încercărilor sau nivelurilor noi. |
| `isBackupPayload` | Validatorul de bază nu definește schema noului registru. | Salvările noi au validare și import/export explicit. |

În verificarea anterioară a ramurii care a intrat în acest `main` au trecut 112 teste Playwright în Chromium. Acest rezultat este istoric, nu o rulare efectuată pentru documentul de față și nu o dovadă că funcțiile propuse există. La implementare se capturează un baseline nou, cu commit, browser, comandă și rezultat.

### 1.2. Ce preluăm din cercetarea externă

- Descrierea oficială Piano Marvel menționează preview de 20 de secunde, avans la minimum 80% și oprire după trei strike-uri. Acestea documentează produsul lor, nu validează un algoritm propriu Étude.[1]
- Complete Music Reading Trainer descrie exerciții progresive și mai multe modalități de input, inclusiv claviatură virtuală și MIDI. Reținem ideea de exerciții focalizate și accesibile prin mai multe inputuri.[2]
- Sight Reading Factory descrie personalizarea ambitusului, ritmurilor și salturilor; aceeași pagină precizează că funcția respectivă nu este disponibilă pentru pian. Folosim ideea de constrângeri ca inspirație, fără a atribui pianului funcții neconfirmate.[3]

**Limită a verificării externe:** aceste afirmații au fost verificate în extrasele indexate returnate pentru paginile oficiale la 6 noiembrie 2026. Extragerea directă a paginilor nu a funcționat prin backendul disponibil. Nu pretindem testarea produselor sau validarea eficienței pedagogice.

### 1.3. Ce nu afirmăm

- Scorul Étude nu este SASR și nu se convertește în scor SASR.
- „Look-ahead” și digitația propusă sunt funcții de antrenament de evaluat, nu garanții de progres.
- Prima vedere înseamnă „prima expunere înregistrată în acest profil local”, nu absența oricărei expuneri în viața utilizatorului.
- Rezultatele din surse de input diferite nu sunt presupuse comparabile înainte de verificarea latenței.

---

## 2. Decizii de produs și livrare

### 2.1. Moduri distincte

| Mod | Ajutoare | Reluări | Rezultat |
|---|---|---|---|
| **Practică pas cu pas** | Indicii opționale, mâini separate, ascultare | Nelimitate | Progres de practică; fără nivel de prima vedere |
| **Practică în tempo** | Configurabile și vizibile în rezultat | Nelimitate | Scor al execuției, etichetat practică |
| **Prima încercare în tempo** | Fără ascultare, fără ținte pe clape, fără acompaniament al mâinii inactive | O încercare eligibilă pe conținut local nou | Scor și statut de eligibilitate; fără nivel calibrat în MVP |
| **Evaluare adaptivă — V3** | Reguli fixe pe sesiune | Fragmente noi | Nivel estimat Étude, experimental |

Nu schimbăm implicit experiența pas cu pas existentă și nu ascundem toate etichetele clapelor pentru toți utilizatorii. Evaluarea neasistată blochează țintele preventive și afișarea dinamică a numelor notelor din partitură; arată exact ce ajutoare sunt dezactivate.

### 2.2. Etape

**MVP — obligatoriu înainte de extindere**
1. Scor corect, recorder și evaluator cu contract stabil.
2. Generator determinist P1–P2, o singură mână la alegere, 4/4 și 3/4, pauze simple.
3. Flux complet: pregătire, preview, count-in, execuție, rezultat.
4. Registru local al expunerilor și încercărilor, cu reguli de abandon și sincronizare.
5. Interfață și teste pentru limbile suportate de baza de integrare, mobil și offline.

**V2 — practică mai utilă**
- Fragmente pe măsuri și progresie ghidată adaptată mâinilor existente.
- Exerciții simple cu două mâini și feedback vizual suplimentar.
- Digitație doar pentru configurații explicit suportate.

**V3 — estimare adaptivă și extensii**
- Profiluri P3–P6, după validarea rendererului și generatorului.
- Nivel estimat Étude, limite ale estimării și istoric versionat.
- Look-ahead opțional, statistici și comparații în interiorul aceluiași protocol.

**În afara MVP:** import arbitrar MusicXML în evaluarea nouă, 6/8, pedală evaluată, legato/articulații punctate, digitație generală, clasamente, backend, echivalare cu examene externe și rescrierea întregii aplicații în module.

---

## 3. Arhitectură și contracte

Fluxul propus:

```text
profil + seed → srtGenerate → srtValidatePiece → srtFingerprint
                                             ↓
                                      eligibilitate/claim
                                             ↓
preview → count-in → recorder → srtEvaluate → salvare rezultat
                         ↓                          ↓
                 input live existent        UI / progres nou
```

Funcții propuse, încă neimplementate:

- `srtGenerate(profile, seed)`: model determinist, independent de DOM și ceas.
- `srtValidatePiece(piece, profile)`: validare structurală, ritmică și de profil.
- `srtToLegacyPiece(piece)`: adaptor pentru `srRender`, fără pierderea identității evenimentelor.
- `srtFingerprint(piece)`: identitate canonică a conținutului.
- `srtBuildExpected(piece, config)`: evenimente evaluate în milisecunde.
- `srtEvaluate(expected, performed, config)`: rezultat pur și reproductibil.
- `srtTransition(state, event)`: tranziții pure, fără redare sau stocare implicită.
- `srtLedgerUpdate(operation)`: acces coordonat la registru; nu este funcție pură.
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
- Timpul muzical se stochează în ticks întregi; conversia în beats se face în adaptor.
- Un acord este un eveniment cu mai multe înălțimi, nu o ordine obligatorie de apăsare.
- Durata fiecărei voci umple exact măsurile; nu deducem sfârșitul piesei doar din ultima notă atacată.
- În MVP nu există anacruze, schimbări de măsură, voci suprapuse în aceeași mână sau legături peste bara de măsură.
- Obiectele partiturii nu se modifică în timpul execuției. Rezultatele au structură separată.

### 3.2. Identitatea conținutului

Fingerprint-ul se calculează dintr-o serializare canonică versionată care include măsura, tonalitatea/armura, mâinile, pauzele, atacurile, duratele și notația înălțimilor. Ordonarea cheilor și a notelor din acord este fixă.

Nu includem seed-ul, titlul, limba, tema, BPM-ul sau ID-ul profilului: aceeași partitură regenerată prin alt seed ori redeschisă la alt tempo nu devine automat nouă. Metadatele de digitație se exclud; schimbarea lor nu șterge expunerea.

Algoritmul propus este SHA-256 peste reprezentarea canonică. Testele folosesc vectori cu rezultate calculate de un instrument, nu hash-uri scrise din memorie. Se păstrează versiunea canonicalizării și se migrează identitățile înaintea schimbării formatului.

**Limită:** MVP recunoaște identitatea exactă definită mai sus, nu asemănarea melodică sau orice transpoziție. Fragmentarea unei piese deja expuse nu produce conținut eligibil nou; V2 păstrează identitatea și intervalul sursei.

---

## 4. Recorder și ceas

### 4.1. Evenimente înregistrate

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

- Timpurile sunt relative la începutul execuției și provin din același ceas monoton ca `SR.t0`.
- `offMs` poate fi `null` până la eliberare; la final nu inventăm un note-off fizic.
- `onMs = 0` este primul timp al piesei, nu începutul count-in-ului.
- Recorderul nu primește notele produse de metronom, `previewNote`, `Listen` sau acompaniament.
- Mesajele duplicate nu produc atacuri fictive. Repetarea reală după note-off produce un atac nou.
- Nu atribuim mâna pe baza canalului MIDI. În MVP mâna este aleasă dinainte; V2 raportează pe mâini doar când atribuirea este neambiguă.
- Clapele deja apăsate la deschiderea ferestrei de captură, la −250 ms, nu produc atac evaluabil până la eliberare și reapăsare. Un note-on efectiv în intervalul [−250, 0) este evaluabil după regulile normale de asociere, chiar dacă nota rămâne ținută peste începutul piesei.

### 4.2. Ferestre și latență

- Înregistrăm și o fereastră de 250 ms înainte și după piesă; evenimentele din afara ei nu influențează scorul.
- Calculăm sfârșitul muzical `T` din durata completă în ticks a măsurilor, inclusiv pauzele finale. Captura atacurilor rămâne activă până la `T + 250 ms`, inclusiv. Numai după această barieră înghețăm recorderul, evaluăm și intrăm în `completed`; notele încă ținute păstrează `offMs: null`. Testăm explicit un atac suplimentar după `T`, în interiorul ferestrei.
- Atacurile din count-in, anterioare acestei ferestre, nu sunt notate. Nu pot satisface primele note ale piesei.
- Asocierea timpurilor de input cu timpul audio se fixează la start; animația nu este sursa adevărului pentru scor.
- MVP folosește compensare de latență zero și salvează acest fapt în configurație. Nu ajustăm retroactiv offset-ul ca să maximizăm scorul.
- Sursa de input este stocată în rezultat. O schimbare de sursă în timpul primei încercări o invalidează pentru comparații; practica poate continua.
- Ascunderea paginii, suspendarea contextului audio, deconectarea instrumentului sau resetarea progresului opresc eligibilitatea; nu sunt greșeli muzicale și nu produc strike.

Durata fizică a apăsării și notele ținute peste pauză sunt diagnostice în MVP. Nu pretindem că evaluăm complet articulația sau durata sonoră cu pedală. Evaluarea strictă a duratelor este livrabil separat în V2.

---

## 5. Evaluatorul: reguli exacte pentru MVP

Toate pragurile de mai jos fac parte din `scoringVersion: 1`. Sunt valori inițiale de produs, care trebuie verificate, nu standarde universale.

### 5.1. Asocierea notelor

1. Extindem acordurile în note așteptate cu ID-uri stabile. Selectăm doar mâna evaluată.
2. Construim candidați numai pentru aceeași înălțime MIDI și distanță temporală în fereastra permisă.
3. Fereastra maximă este 250 ms. Pentru aceeași înălțime repetată apropiat, o limităm la 45% din cel mai mic interval până la atacul vecin al acelei înălțimi. Pentru o singură apariție rămâne 250 ms.
4. Asocierea este unu-la-unu: maximizăm numărul de note asociate, apoi minimizăm suma erorilor absolute. La egalitate folosim timpii, apoi ID-urile stabile. Pentru aceeași înălțime ordinea atacurilor nu se inversează.
5. Notele simultane cu înălțimi diferite pot veni în orice ordine. Nu folosim un greedy global care consumă greșit o notă necesară unui acord sau unei repetări.
6. O notă așteptată neasociată este `missed`; un atac neasociat este `extra`.
7. Asocierea opțională a unei note greșite cu o poziție din partitură servește doar feedbackului vizual. Nu schimbă asocierea corectă și nu adaugă o penalizare suplimentară peste formula de mai jos.

Pentru dimensiunea MVP, o programare dinamică per înălțime poate realiza regula de asociere. Nu adăugăm o dependență doar pentru acest algoritm fără necesitate demonstrată.

### 5.2. Clasificarea temporală

- `good`: eroare absolută de maximum 100 ms.
- `near`: eroare peste 100 ms și de maximum 180 ms, în fereastra admisă de asociere.
- `lateOrEarly`: asociere validă, dar eroare peste 180 ms.
- `missed`: nu există asociere validă.

Ferestrele includ capătul superior; testele acoperă exact limitele și valorile imediat dincolo de ele. Când fereastra de asociere este mai mică, ea are prioritate.

### 5.3. Formule

Notăm:
- `N`: numărul de note așteptate;
- `TP`: note asociate cu înălțime corectă în fereastra permisă;
- `FN = N - TP`;
- `FP`: atacuri neasociate în fereastra înregistrată;
- `G`: asocieri `good`, `Q`: asocieri `near`.

```text
pitchPrecision = TP / (TP + FP), sau 0 când nu există atacuri
pitchRecall    = TP / N
pitchF1        = 100 × 2TP / (2TP + FP + FN)
rhythmAcc      = 100 × (G + 0.5Q) / N
score          = min(pitchF1, rhythmAcc)
```

`N = 0` produce `status: invalid`, cu scoruri `null`; nu acordăm 100% unei piese goale. Pentru `N > 0` și tăcere, scorul este zero. Deciziile folosesc valorile nerotunjite; rotunjim numai afișarea.

O substituție greșită produce un `FN` și un `FP`, conform definiției preciziei și recall-ului. Nu mai scădem separat încă un procent pentru aceeași substituție.

Atacurile neasociate în interiorul unei pauze notate sunt `restViolations`, un subset diagnostic al `FP`, nu încă o penalizare aditivă. Ferestrele de atac ale notelor vecine au prioritate la limitele pauzelor. În V2, cu două mâini, nu numim „încălcare a pauzei mâinii stângi” o notă validă a mâinii drepte.

### 5.4. Stele și diagnostice

- 3 stele: `score >= 95`, `FP = 0` și nicio încălcare de pauză prin atac.
- 2 stele: `score >= 80`, dacă nu sunt îndeplinite condițiile pentru 3.
- 1 stea: `score >= 60`.
- Altfel: 0 stele.
- „Perfect”: numai dacă toate notele sunt `good`, nu există note lipsă și nu există atacuri suplimentare.

Returnăm și `meanOffsetMs`, `meanAbsoluteOffsetMs`, numărul de probe asociate, diagnosticul duratelor și rezultate per notă. Dacă nu există asocieri, mediile sunt `null`, nu zero. O medie semnată aproape de zero nu se interpretează singură ca ritm precis.

Nu suprascriem vechile recorduri `sheet.best` cu scoruri care au altă semnificație. Rezultatele noi sunt versionate și afișate separat până la o migrare explicită.

### 5.5. Vectori de acceptare

Exemplele presupun patru note așteptate; asocierile enumerate sunt în ferestrele permise. Valorile formulelor au fost calculate cu Python în timpul redactării.

| Execuție | TP / FP / FN | G / Q | pitchF1 | rhythmAcc | score |
|---|---|---|---:|---:|---:|
| Perfectă | 4 / 0 / 0 | 4 / 0 | 100 | 100 | 100 |
| O substituție greșită | 3 / 1 / 1 | 3 / 0 | 75 | 75 | 75 |
| Toate corecte și un atac suplimentar | 4 / 1 / 0 | 4 / 0 | 88,888889 | 100 | 88,888889 |
| Trei la timp și una `near` | 4 / 0 / 0 | 3 / 1 | 100 | 87,5 | 87,5 |
| Tăcere | 0 / 0 / 4 | 0 / 0 | 0 | 0 | 0 |

Teste suplimentare: atacuri pe toate clapele, note repetate, acord în ordine diferită, evenimente cu timp egal, o notă lungă peste mai multe atacuri așteptate și adăugarea unui atac care nu poate satisface nicio notă. Ultimul caz nu trebuie să mărească scorul.

---

## 6. Prima încercare: mașina de stări și eligibilitate

### 6.1. Stări

```text
idle → preparing → claiming → preview → countIn → playing → completed
                       ↓         ↓         ↓          ↓
                    blocked   abandoned  abandoned  interrupted
```

- `preparing`: generare, validare, pregătire audio și verificare input; partitura nu este încă vizibilă.
- `claiming`: calculăm eligibilitatea și persistăm rezervarea expunerii sub coordonare între taburi.
- `preview`: abia după salvare afișăm partitura; acesta este preview-ul permis primei încercări.
- `countIn`: configurația este înghețată; nu permitem schimbarea BPM-ului, mâinii sau ajutoarelor.
- `playing`: recorder activ; evaluarea nu depinde de fiecare frame desenat.
- `completed`: evaluatorul produce rezultat, apoi încercăm salvarea durabilă.
- Tranziția din `playing` spre `completed` are loc numai după bariera de captură `T + 250 ms`, nu la ultimul atac sau la ultima animație a piesei.
- `abandoned` / `interrupted`: fără nivel și fără strike; conținutul rămâne expus.

### 6.2. Momentul eligibilității

Verificăm dacă fingerprint-ul exista **înaintea claim-ului**, nu după preview. Preview-ul autorizat nu își invalidează propria încercare.

O rezervare are `attemptId`, `ownerTabId`, `generation` și fingerprint. După rezervare, alt tab poate deschide același conținut doar ca practică. Eligibilitatea este pentru încercarea rezervată, nu o proprietate booleană care se recalculează greșit la fiecare redraw.

Reguli obligatorii:
- Orice afișare a unei partituri din noul sistem în afara preview-ului autorizat înregistrează mai întâi `recordExposure(fingerprint, reason)`, sub aceeași blocare ca rezervarea. Operația este idempotentă. Practica și afișarea rezultatelor nu creează drept de încercare eligibilă; claim-ul autorizat își păstrează numai propria eligibilitate.
- Dacă expunerea nu poate fi persistată, practica poate continua cu avertisment, dar dezactivăm eligibilitatea în tabul curent. La recuperarea stocării cerem o alegere explicită de reluare a istoricului local; nu pretindem că expunerile nesalvate pot fi reconstruite după refresh. UI-ul explică această limită, iar utilizatorul poate rămâne exclusiv în practică. Garanția este pentru expunerile înregistrate, nu pentru istoricul pierdut al browserului.
- MVP permite prima încercare numai pe conținut generat de noul protocol. Piesele fixe și istoricul studiat în versiuni care nu înregistrau expunerile rămân practică; nu le declarăm retrospectiv nevăzute.
- `Listen` înainte de claim înregistrează expunere și permite numai practică ulterior.
- `Listen`, indicii sau reluare în timpul primei încercări încheie eligibilitatea și cer trecere explicită la practică.
- Refresh-ul nu reia o rezervare ca încercare nouă. O rezervare rămasă fără rezultat este tratată conservator ca abandonată la recuperare.
- Schimbarea limbii, temei sau dimensiunii ferestrei nu invalidează execuția dacă starea și timpul rămân intacte.
- În cazul unei pauze reale, nu reluăm scorul de prima vedere. Utilizatorul poate continua doar practica sau poate primi conținut nou.
- Schimbarea tempo-ului nu transformă același conținut într-o nouă primă vedere.
- Prima încercare în MVP folosește preview de 20 s și un count-in de o măsură. „Pornește acum” este permis și durata efectivă de preview este salvată; nu comparăm ulterior protocoale diferite fără etichetă.

Aceste reguli protejează semnificația rezultatului local, nu oferă protecție anti-fraudă. Ștergerea datelor browserului sau folosirea altui dispozitiv nu poate fi detectată de aplicația statică.

---

## 7. Persistență, concurență și backup

### 7.1. O singură sursă de adevăr

Decizie propusă: păstrăm progresul existent în `ptt-v3`, dar folosim cheia separată `etude-sight-v1` pentru noul registru. Motivul este izolarea de regulile generice `SYNC_ADD` / `SYNC_MAX` și de taburi cu versiuni mai vechi ale aplicației.

Nu menținem o a doua copie autoritară a încercărilor în `data.reading.sight`. UI-ul citește registrul; eventualele rezumate în memoria aplicației sunt derivate și reconstruibile.

```js
{
  schemaVersion: 1,
  generation: 'unique-reset-id',
  revision: 1,
  exposures: { /* fingerprint → prima expunere + claim */ },
  attempts: { /* attemptId → rezultat terminal imuabil */ },
  prefs: { practiceHints: true, lookAhead: false },
  sessions: { /* V3: rezumate versionate, nu maximul ratingurilor */ }
}
```

### 7.2. Protocolul de scriere

Toate scrierile noi folosesc aceeași blocare exclusivă `etude-sight-ledger-v1` prin Web Locks, când capabilitatea există:
1. Citește ultimul registru și validează-l.
2. Verifică generația și precondițiile operației.
3. Aplică o operație mică și idempotentă.
4. Salvează registrul complet înainte de eliberarea blocării.
5. Recitește pentru confirmarea rezultatului operației; notifică celelalte taburi.

Nu așteptăm audio, rețea sau UI în interiorul blocării. Evenimentele `storage` notifică cititorii; nu constituie singure un mecanism de blocare.

Operații distincte: `claimExposure`, `recordExposure`, `recordListen`, `finishAttempt`, `abandonAttempt`, `updatePrefs`, `resetLedger`, `importLedger`. `recordListen` înregistrează și expunerea înainte de redare. Salvarea de două ori a aceluiași rezultat nu dublează încercarea.

**Fără Web Locks, stocare disponibilă sau context compatibil:** practica funcționează; nu promitem prima încercare coordonată între taburi și nu actualizăm nivelul estimat. Afișăm o explicație, nu o eroare generică. Pagina deschisă prin `file:` nu primește garanții de coordonare ori offline echivalente unei origini HTTP stabile.

### 7.3. Creșterea datelor și eșecuri

- Păstrăm cel mult ultimele 500 de rezultate detaliate, ordonate după `(finishedAt, attemptId)`.
- Expunerile nu se șterg odată cu rezultatele. Altfel, conținutul vechi ar redeveni fals „nou”.
- Pentru MVP limita propusă este 4096 de identități expuse. La atingerea ei, practica rămâne disponibilă, dar o nouă primă încercare este oprită până la o decizie explicită de arhivare sau resetare. Nu eliminăm în tăcere identități.
- La `QuotaExceededError` sau eroare de scriere înainte de preview nu afișăm conținutul ca încercare eligibilă. Oferim practică.
- Dacă salvarea rezultatului eșuează, afișăm „rezultat nesalvat”; claim-ul rămâne consumat. O reîncercare de salvare păstrează același ID.
- Un reset schimbă generația. O încercare pornită înaintea resetului nu poate rescrie datele șterse.
- Valori necunoscute sau versiuni viitoare nu sunt înlocuite automat cu `{}`. Păstrăm datele și oferim export/recuperare; modul evaluat rămâne indisponibil până la rezolvare.

### 7.4. Backup și migrare

- Backup-urile existente `v:3` continuă să fie acceptate.
- Extindem exportul printr-un câmp opțional, versionat, `sightLedger`, fără a modifica semnificația lui `data` pentru aplicația existentă.
- Absența câmpului într-un backup vechi nu șterge registrul curent de expuneri.
- Importul obișnuit face reuniunea identităților expuse și a rezultatelor după ID, sub blocare. Preferințele urmează opțiunea explicită a utilizatorului.
- Construim și validăm integral registrul candidat înainte de scriere. Păstrăm generația curentă și rezervările locale active; rezervările importate nu sunt reluabile și contează numai ca expuneri istorice. Importul nu poate transfera dreptul activ de prima încercare între taburi sau profiluri.
- Rezultatele cu același `attemptId` și conținut identic se deduplică. Dacă același ID are conținut diferit, respingem importul și explicăm conflictul; nu alegem arbitrar rezultatul cu scor mai mare.
- Aplicăm limita de 500 de rezultate detaliate după reuniune, prin ordinea deterministă stabilită mai sus. Dacă identitățile expuse reunite depășesc limita de 4096 sau registrul candidat depășește bugetul de validare/stocare, respingem importul obișnuit fără modificarea registrului curent. Nu sacrificăm expuneri ca să încapă backup-ul.
- Restaurarea unui backup mai vechi nu redă eligibilitatea unor piese deja văzute în profilul curent.
- Înlocuirea totală este permisă numai ca reset explicit de profil; explicăm că se pierde continuitatea istoricului local.
- Validatorul refuză valori nefinite, scoruri în afara intervalului, note MIDI invalide, timpi incoerenți, ID-uri periculoase și colecții peste bugetul acceptat. Intrările nevalidate nu ajung în `innerHTML`.

---

## 8. Generatorul MVP: P1–P2

Profilul este o configurație explicită, nu doar un număr de dificultate. Mâna se alege separat; nu presupunem că stânga este automat un nivel mai avansat.

| Profil | Măsură | Ambitus | Durate | Salt maxim diatonic | Pauze |
|---|---|---|---|---|---|
| P1.a | 4/4 | Poziție de 5 note | Pătrimi, doimi | Secundă | Nu |
| P1.b | 4/4 | Aceeași poziție | Pătrimi, doimi | Terță | Nu |
| P1.c | 4/4 | Aceeași poziție | Pătrimi, doimi | Terță; repetări controlate | Nu |
| P2.a | 4/4 | Poziție de 5 note | Pătrimi, doimi | Terță | Pauză de pătrime |
| P2.b | 3/4 | Poziție de 5 note | Pătrimi, doimi | Terță | Pauză de pătrime |
| P2.c | 3/4 sau 4/4, fixată pe exercițiu | Maximum o octavă | Pătrimi, doimi | Terță | Pătrime sau doime când încape |

Valori inițiale: Do major, patru măsuri, 60 BPM în prima încercare. În practică tempo-ul poate fi schimbat. Pozițiile fixe sunt Do4–Sol4 pentru dreapta și Do3–Sol3 pentru stânga; profilul cu ambitus extins validează separat limitele.

### 8.1. Invariante obligatorii

- Aceeași pereche `(generatorVersion, profile, seed)` produce aceeași structură.
- Seed-ul este un întreg validat; nu folosim `Math.random()` în generator.
- Duratele pozitive umplu exact măsurile, cu grilă de ticks întreagă.
- Nu generăm numai pauze; fiecare măsură conține cel puțin o notă în MVP.
- Nicio durată nu traversează bara de măsură în MVP.
- Înălțimile, salturile și ritmurile respectă profilul.
- Cerințele de varietate sunt cuantificabile: de exemplu P1.c cere cel puțin o repetare; profilurile cu pauze cer cel puțin o pauză, dar nu la începutul primei măsuri.
- Generarea are o limită de încercări; o configurație imposibilă produce eroare explicită. Nu „reparăm” în tăcere profilul.
- Rendererul și evaluatorul primesc același model validat; nu reconstruim independent două partituri asemănătoare.

Testăm seed-urile întregi de la 0 inclusiv la 1000 exclusiv, pentru fiecare profil și mână. Acesta este un eșantion determinist de regresie, nu dovada tuturor seed-urilor posibile. Adăugăm separat seed-uri de margine și profiluri invalide.

### 8.2. Digitație

MVP poate afișa doar degetul de start pentru o poziție fixă validată. Nu atribuim automat digitație completă la salturi, transpoziții sau schimbări de poziție. În P2.c o indicație nesigură se omite, nu se inventează.

V2 definește un contract separat pentru întinderi, treceri ale degetului mare, direcția mâinii și coliziuni SVG. Digitația rămâne o recomandare, nu criteriu de notare.

---

## 9. V2: fragmente și două mâini

### 9.1. Practice Slicer

Contract: `startBar` și `endBar` sunt indecși de măsură de la 1, inclusivi, validați în limitele piesei. Fragmentul începe la tick zero și păstrează sursa și intervalul extras.

- MVP-ul de slicing V2 acceptă numai modelul simplu validat, cu măsură fixă și fără anacruze sau legături peste margine.
- Notele/pauzele de frontieră sunt tratate după o regulă documentată; dacă ar necesita tăiere sau legare neimplementată, selecția se refuză clar.
- Nu pretindem că simpla extragere din `rh` și `lh` rezolvă orice MusicXML.
- O piesă cu o singură mână nu primește pași goi pentru mâna absentă.
- Progresia propusă: pas cu pas → tempo redus → tempo țintă; pentru două mâini adăugăm separat RH, LH și împreună.
- Autoplay-ul mâinii inactive este ajutor de practică, etichetat în rezultat.

### 9.2. Două mâini

Începem cu registre separate și fără unison între mâini. Adăugăm teste pentru acorduri, atacuri simultane și input neatribuibil unei mâini. Dacă atribuirea este ambiguă, scorul total rămâne calculabil, dar nu afișăm acurateți pe mâini fictiv precise.

Duratele au o versiune nouă de evaluator numai după definirea tratamentului note-off, pedalei, pauzelor și legăturilor. Nu schimbăm retroactiv semnificația `scoringVersion: 1`.

---

## 10. V3: nivel estimat, nu „calibrare” garantată

**Condiție de intrare:** MVP stabil, generatorul verificat și review muzical al unui eșantion de exerciții din fiecare profil. P3–P6 se proiectează individual; nu se activează doar pentru că există un ID.

### 10.1. Protocol experimental inițial

- Familie de profiluri fixă pe sesiune, aceeași mână/configurație, același protocol de preview și sursă de input stabilă.
- Maximum opt fragmente eligibile finalizate sau trei rezultate sub prag.
- Avans `+2` dacă `pitchF1 >= 96` și `rhythmAcc >= 90`.
- Avans `+1` dacă `pitchF1 >= 85` și `rhythmAcc >= 80`.
- Prima promovare la un profil este provizorie: programăm un al doilea fragment nou la același profil, nu aplicăm încă avansul. A doua promovare consecutivă confirmă profilul și aplică avansul `+1` sau `+2`, folosind treapta mai conservatoare dintre cele două rezultate. Fiecare fragment consumă una dintre cele opt probe.
- Altfel un strike și scădere cu un nivel, limitată la minimul familiei; perechea de confirmare curentă se închide. După o nereușită, o nouă confirmare cere din nou două promovări consecutive la același profil.
- La limita superioară nu generăm avans peste profilurile disponibile; păstrăm cel mai înalt profil confirmat și încheiem cu motivul `ceilingReached`. Dacă bugetul se termină după o primă promovare, ea rămâne provizorie.
- O întrerupere tehnică nu este strike. Nu există reluarea aceluiași fragment pentru îmbunătățirea rezultatului.

Valorile sunt ipoteze configurabile. Se păstrează `assessmentVersion` și profilurile exacte. Nu comparăm automat două sesiuni după schimbarea pragurilor sau generatorului.

### 10.2. Definiția rezultatului

Pentru prima versiune experimentală:
- `confirmedLevel`: cel mai înalt profil confirmat prin perechea de promovări consecutive definită mai sus, în aceeași sesiune;
- `provisionalLevel`: cel mai înalt profil cu o promovare;
- `testedRange`, număr de încercări și motivul opririi;
- fără suficiente promovări, afișăm „date insuficiente”, nu un nivel numeric inventat;
- recomandarea următorului exercițiu este separată de rezultatul confirmat.

La început nu agregăm RH, LH și ambele mâini într-un singur scor global. Nu deducem o scară liniară din profiluri care schimbă simultan mai multe cerințe.

### 10.3. Simulări și verificare umană

Testăm sesiuni sintetice: toate corecte, toate greșite, rezultate alternative, limite de nivel, oprire la a opta probă, a treia nereușită și abandon. Cazul „toate corecte” verifică explicit că a doua probă confirmă primul profil și că avansul respectă perechile; nu acceptăm o sesiune perfectă fără niciun nivel confirmat. Aceste simulări verifică algoritmul, nu validitatea pedagogică.

Un pilot cu utilizatori și review de profesor verifică dacă fragmentele considerate mai grele chiar cresc cerințele și dacă recomandările sunt utile. Nu promitem o dată sau un scor de eficiență fără aceste date.

---

## 11. Interfață, localizare și accesibilitate

- În MVP, rezultatul explică separat „note”, „atacuri în timp”, „note suplimentare” și „încercare eligibilă/practică”.
- Informația nu se transmite numai prin culoare: text și simboluri pentru corect, apropiat, ratat, suplimentar.
- Anunțurile accesibile nu citesc fiecare frame sau fiecare schimbare a cursorului.
- Controalele Start, Stop și trecerea la practică rămân accesibile la 320 px și în landscape scund.
- `prefers-reduced-motion` reduce animațiile; look-ahead, când va exista, poate fi oprit.
- Redimensionarea și schimbarea limbii nu pierd recorderul și nu regenerează piesa.
- Nu adăugăm un nou dicționar RO/EN paralel dacă între timp ramura de localizare a introdus o infrastructură comună. La integrare se inspectează baza actuală și se utilizează limbile/frameworkul existent.
- Lipsa MIDI nu împiedică practica pe claviatura virtuală sau tastatura computerului; nu pretindem însă măsurarea aceleiași dificultăți motorii ca pe un pian fizic.
- Look-ahead este opt-in în V3, nu se activează implicit pentru începători și nu ascunde instrucțiunile necesare utilizării aplicației.

---

## 12. Implementare task-by-task, cu TDD

### 12.1. Pregătire fără atingerea muncii locale

În momentul redactării, copia principală de pe Desktop este pe `feat/multilingual-note-notation`, cu modificări necomise. Nu face checkout, reset, clean sau stash automat în acel director.

După aprobarea implementării, actualizează referințele și creează un worktree separat, verificând mai întâi că destinația și numele ramurii nu există:

```bash
git -C C:/Users/mariu/Desktop/etude fetch origin
git -C C:/Users/mariu/Desktop/etude worktree add -b feature/sight-reading-v2 C:/Users/mariu/Desktop/etude-sight-reading origin/main
```

Aceste comenzi sunt propuse, nu au fost executate pentru redactarea planului. Dacă `main` a avansat, inspectează diferențele și actualizează această bază înainte de implementare.

În noul worktree:

```bash
npm ci
npx playwright install chromium
PW_CHANNEL= npm test -- --workers=4
```

Comenzile folosesc Git Bash pe Windows. `PW_CHANNEL=` selectează browserul Playwright conform configurației inspectate. Dacă portul 8787 este ocupat, identifică serverul; nu testa accidental alt checkout și nu termina un proces necunoscut. În raport înregistrează exact fișierul servit, commitul, browserul și rezultatul.

### 12.2. Ciclu obligatoriu pentru fiecare comportament

1. Scrie **un** test care exprimă următorul comportament, nu toate testele tuturor etapelor.
2. Rulează testul țintit; verifică FAIL din motivul corect, nu pentru browser absent sau eroare de sintaxă.
3. Implementează minimul necesar.
4. Rulează din nou testul; cere PASS.
5. Rulează testele conexe, apoi regresia relevantă.
6. Refactorizează numai cu testele verzi.
7. Commit local mic, cu fișiere explicite; fără push sau merge automat.

Numele testelor noi încep cu `[srt:<categorie>]`, pentru a evita un filtru care nu selectează nimic. În CLI folosește prefixul fără paranteze pătrate: `--grep 'srt:score'`, de exemplu.

### 12.3. Sarcini MVP, în ordinea dependențelor

Fiecare rând este un livrabil; subcazurile se implementează pe rând prin ciclul de mai sus, nu ca un singur patch mare.

| ID | Fișiere de modificat/creat | Comportamente și criteriu de ieșire | Test țintit |
|---|---|---|---|
| M0 | `tests/fixtures.mjs` numai dacă este necesar; fără schimbări de produs | Baseline nou; pagina servită este cea corectă; erorile de mediu se separă de erorile aplicației. | Suita existentă |
| M1 | `etude.html`; creare `tests/sight-reading-model.spec.mjs` | Model de ticks, validator și adaptor. Teste pentru piesă goală, durate invalide, acord/pauză și compatibilitatea pieselor existente. | `srt:model` |
| M2 | `etude.html`; creare `tests/sight-reading-score.spec.mjs` | Asociere pentru o singură notă, apoi repetări și acorduri. Vectorii secțiunii 5, limite temporale și rezultate identice pentru ordinea notelor simultane. | `srt:score` |
| M3 | `etude.html`; creare `tests/sight-reading-recorder.spec.mjs` | Recorder input real, deduplicare, note-off, count-in, panic și lipsa capturii notelor generate de aplicație. | `srt:recorder` |
| M4 | `etude.html`; `tests/sight-reading-score.spec.mjs`; `tests/app.spec.mjs` | Integrarea evaluatorului în practica în tempo, rezultate noi separate de `sheet.best`. Regresie: keyboard-mashing nu mai produce perfect sau trei stele. | `srt:integration` |
| M5 | `etude.html`; creare `tests/sight-reading-generator.spec.mjs` | P1.a, apoi fiecare profil până la P2.c; seed determinist, invariante și grilă de seed-uri. | `srt:generator` |
| M6 | `etude.html`; creare `tests/sight-reading-ledger.spec.mjs` | Canonicalizare, fingerprint, stocare versionată, claim atomic, două taburi concurente, idempotentă și generație. Fallback la practică fără capabilități. | `srt:ledger` |
| M7 | `etude.html`; creare `tests/sight-reading-flow.spec.mjs` | Flux de stări, preview autorizat, configurație fixă, Listen/refresh/abort și finalizare salvată o singură dată. | `srt:flow` |
| M8 | `etude.html`; `tests/sight-reading-ledger.spec.mjs`; teste existente de backup | Export/import, backup vechi, reuniunea expunerilor, registru corupt, limită de stocare și rezultat nesalvat. | `srt:backup` |
| M9 | `etude.html`; fișierele de localizare existente la integrare; creare `tests/sight-reading-ui.spec.mjs` | Texte și controale accesibile, 320 px/landscape, schimbare de limbă și temă fără pierderea stării. | `srt:ui` |
| M10 | `tests/sight-reading-ui.spec.mjs`; `sw.js` numai dacă se schimbă resursele/cache-ul | Încărcare offline după vizită online, actualizare online, regresie completă, verificare manuală input și rollback. | `srt:offline` și suita completă |

Exemplu de rulare țintită, după crearea fișierului:

```bash
PW_CHANNEL= npx playwright test tests/sight-reading-score.spec.mjs --grep 'srt:score' --workers=1
```

Exemplu de test de contract pentru o funcție încă neimplementată:

```js
test('[srt:score] silence on a non-empty score is zero', async ({ app, page }) => {
  await app.open();
  const r = await page.evaluate(() => srtEvaluate(
    [{ id: 'n0', midi: 60, onMs: 0, offMs: 1000 }],
    [],
    { scoringVersion: 1 }
  ));
  expect(r.status).toBe('valid');
  expect(r.score).toBe(0);
  expect(r.meanOffsetMs).toBeNull();
});
```

În RED, testul poate arăta că funcția lipsește; în pașii următori fiecare caz trebuie să cadă pe comportamentul încă neimplementat. Folosește fixture-ul existent `test`/`expect` din `./fixtures.mjs`, care verifică și erorile necapturate. Testele pure pot rula în `page.evaluate`; nu introducem un al doilea runner doar pentru ele.

### 12.4. Sarcini ulterioare

- **V2.1:** `srtSlicePiece` și teste dedicate `tests/sight-reading-slicer.spec.mjs`.
- **V2.2:** progresie pe fragmente, fără pași pentru mâini inexistente.
- **V2.3:** două mâini, acorduri și atribuirea feedbackului; versiune nouă dacă se punctează duratele.
- **V3.1:** un profil avansat pe rând, inclusiv review de notație și digitație.
- **V3.2:** algoritmul adaptiv pur, apoi sesiuni simulate în `tests/sight-reading-adaptive.spec.mjs`.
- **V3.3:** UI pentru nivel estimat, apoi pilot și ajustarea parametrilor, fără rescrierea istoricului.
- **V3.4:** look-ahead opt-in, testat pentru accesibilitate și starea sesiunii.

---

## 13. Matricea de verificare și porțile de acceptare

### 13.1. Teste automate obligatorii

| Domeniu | Cazuri care nu trebuie omise |
|---|---|
| Scor | Perfect, tăcere, suplimentare, substituții, note lipsă, `near`, zero note, limitele ferestrelor, ordonare stabilă, rezultate finite |
| Polifonie | Acord în ordine diferită, atacuri apropiate, repetări ale aceleiași înălțimi, un atac care nu poate satisface două note |
| Recorder | Note-on/off, deduplicare surse, autoplay exclus, clapă ținută la deschiderea capturii versus atac la −100 ms, captură până la `T + 250 ms`, schimbare de sursă, suspendare |
| Generator | Toate profilurile MVP, ambele mâini separat, seed-uri definite, profil imposibil, renderer și evaluator pe același model |
| Prima vedere | Preview valid, afișare anterioară în practică, ascultare anterioară, expunere nesalvată, refresh, abandon, reluare, BPM diferit pe același conținut |
| Stocare | Două taburi cu claim simultan, finalizare dublă, reset între start și save, backup vechi, import peste buget, conflict de conținut pentru același ID, claim importat și quota |
| UI | Limbile bazei de integrare; light/dark; 320 px, 390 px, 1024 px, 1920 px și landscape scund |
| Accesibilitate | Tastatură, focus, texte în afara culorii, dialoguri și reduced motion |
| Offline | După vizită online pe aceeași origine; resursele necesare sunt disponibile sau lipsa audio este explicată |

### 13.2. Comenzi și interpretare

```bash
PW_CHANNEL= npx playwright test tests/sight-reading-*.spec.mjs --workers=1
PW_CHANNEL= npm test -- --workers=4
```

- Cerem zero erori neașteptate și raportăm separat testele sărite sau instabile.
- Dacă un filtru selectează zero teste, poarta nu este trecută.
- Nu „reparăm” teste prin mărirea arbitrară a timeout-ului sau eliminarea verificărilor.
- Testele de scoring folosesc timpi injectați, nu așteptări reale pentru fiecare notă. Testele de integrare verifică separat legătura cu ceasul real.
- Salvăm commitul, comanda, versiunea browserului și rezultatul; nu hardcodăm în document un număr de teste care va rămâne permanent adevărat.

### 13.3. Verificare manuală minimă înainte de lansare

- Pian MIDI: note repetate, acorduri, note-off și deconectare în timpul execuției.
- BLE MIDI, dacă există dispozitiv: latență și recuperare; dacă nu este disponibil, marcăm explicit „neverificat fizic”.
- Telefon Android și tastatură virtuală; testele desktop cu viewport mobil nu înlocuiesc un dispozitiv real.
- Refresh după preview, două taburi și vizită offline pe aceeași origine.
- O persoană poate explica din ecranul de rezultat de ce a pierdut puncte; nu vede doar un procent opac.

**Poarta MVP:** toate livrabilele M1–M10 sunt verificate, testele existente nu regresează, nu se pierd salvări și nicio funcție V3 nu este prezentată drept implementată sau validată.

---

## 14. Lansare, compatibilitate și revenire

- Implementarea se face într-o ramură și un worktree separat. Nu se amestecă cu localizarea în lucru fără review al bazei actuale.
- Modul nou rămâne ascuns sau marcat experimental până la trecerea porții MVP. Un flag local poate dezactiva UI-ul nou, fără a elimina datele registrului.
- Păstrăm în primele versiuni posibilitatea folosirii practicii vechi. Migrarea recordurilor vechi nu se face implicit.
- `sw.js` nu primește o modificare de versiune doar ritualic; verificăm dacă se schimbă strategia sau lista de resurse. Resursele noi, dacă există, au teste offline și de actualizare.
- Lansarea recomandată este un PR MVP separat de V2/V3. Un squash commit facilitează anularea schimbărilor de cod; merge-ul se face numai la cererea utilizatorului.
- Revert-ul codului nu este rollback al datelor. Versiunea veche trebuie să ignore cheia nouă; nu o ștergem la revenire.
- După o revenire și o relansare, registrul nou trebuie să fie încă citibil sau să existe migrare explicită. Testăm această compatibilitate, nu o presupunem.

---

## 15. Riscuri și decizii care necesită validare

| Risc | Mitigare / condiție de acceptare |
|---|---|
| Scorul poate părea sever pentru începători | Feedback separat pe note/tempo, practică disponibilă; ajustările sunt versionate. |
| Ferestrele temporale nu tratează echitabil toate inputurile | Salvăm sursa și configurația; verificăm dispozitive reale înainte de comparații. |
| Registrul separat crește complexitatea | O singură autoritate, protocol mic de operații, fără duplicare în `ptt-v3`. Dacă implementarea devine prea mare, livrăm întâi practica, nu o eligibilitate fals garantată. |
| Web Locks / stocarea lipsesc | Fallback explicit la practică; nu pretindem coordonare atomică. |
| Numărul de expuneri ajunge la limită | Oprire explicită a încercărilor noi, fără uitarea tacită a istoricului. Strategia de arhivare este ulterioară MVP. |
| Generator corect tehnic, dar muzical slab | Review al unui eșantion pentru fiecare profil; nu confundăm validarea sumelor cu muzicalitatea. |
| Fișierul HTML devine greu de întreținut | Blocuri cu responsabilități clare și funcții pure; extragerea în module rămâne o decizie separată. |
| Branch-ul de localizare modifică aceleași zone | Integrare pe baza actuală și teste pentru toate limbile ei; nu suprascriem dicționare sau starea unei sesiuni active. |
| Nivelul estimat este confundat cu un examen | Etichetă experimentală, rezultat provizoriu/confirmat și lipsa conversiei SASR. |

### Decizii propuse pentru aprobarea MVP

1. Evaluăm în MVP înălțimea și momentul atacului, nu articulația completă.
2. Livrăm P1–P2 și câte o singură mână; două mâini și nivelul estimat vin ulterior.
3. Acceptăm cheia separată de registru și fallback la practică atunci când coordonarea nu este disponibilă.
4. Păstrăm recordurile vechi; scorurile noi au versiune și prezentare separate.
5. Pragurile sunt inițiale și modificabile prin versiuni, nu declarate standarde pedagogice.

**Următorul pas după aprobare:** pregătirea worktree-ului și măsurarea baseline-ului M0, urmate de un singur comportament M1 în TDD. Nu implementăm automat toate etapele acestui document.

## Sources

[1] https://pianomarvel.com/en/article/the-ultimate-sight-reading-test
[2] https://completemusicreadingtrainer.com
[3] https://www.sightreadingfactory.com/focus/customization
