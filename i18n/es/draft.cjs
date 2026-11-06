'use strict';
// This is a deliberately incomplete working draft; do not register as a locale.
// Existing core translations are copied by build-draft.cjs from i18n-extra.js.
module.exports = {
  lessons: {
    keys: {t:'El teclado y los nombres de las notas', b:`
<p>La música utiliza solo <b>12 notas diferentes</b>. Después de la duodécima, el patrón vuelve a empezar: la misma nota, más aguda. Esa distancia es una <b>octava</b>, y el piano no es más que el mismo patrón de 12 teclas repetido una y otra vez.</p>
<p>Las teclas blancas se llaman <b>C D E F G A B</b> (Do Re Mi Fa Sol La Si). Las teclas negras están entre ellas y toman prestados sus nombres: la tecla negra por encima de C es <b>C♯</b> («do sostenido»); la misma tecla vista desde D es <b>D♭</b> («re bemol»). Una tecla, dos nombres: eso se llama escritura <i>enarmónica</i>.</p>
<div class="demo-row"><button class="demo" data-demo="n:60">Do central</button><button class="demo" data-demo="n:61">C♯ / D♭</button><button class="demo" data-demo="iv:60:12">Una octava: de do a do</button></div>
<h4>Semitonos y tonos</h4>
<p>La distancia entre una tecla cualquiera y su vecina más cercana (negra o blanca) es un <b>semitono</b>, la distancia más pequeña que utilizamos. Dos semitonos forman un <b>tono</b>. Observa que entre <b>E–F</b> y <b>B–C</b> no hay ninguna tecla negra: son semitonos naturales y dan forma a cada escala.</p>
<div class="demo-row"><button class="demo" data-demo="iv:64:1">Semitono: mi→fa</button><button class="demo" data-demo="iv:60:2">Tono: do→re</button></div>
<p class="learn-note">Para encontrar cualquier do, busca el grupo de dos teclas negras: do es la tecla blanca que está justo a su izquierda. El do central (C4) es el que está más cerca del centro del piano.</p>`},
    iv: {t:'Los intervalos'},
    sc: {t:'Escalas y tonalidades'},
    ch: {t:'Los acordes'},
    cof: {t:'El círculo de quintas'},
    pr: {t:'Progresiones y números romanos'},
    rh: {t:'Ritmo y compás'},
    notation: {t:'La lectura de partituras'},
    dyn: {t:'Dinámica y articulación'},
    modes: {t:'Los modos'},
    how: {t:'Cómo aprenderlo todo'},
    symbols: {t:'Indicaciones de navegación: repeticiones, codas, pedal y ornamentos'},
    rh2: {t:'Silencios, ligaduras, tresillos y síncopas'},
    iv2: {t:'Calidades, inversiones e intervalos compuestos'},
    minor: {t:'Escalas menores y grados de la escala'},
    ch7: {t:'Acordes de séptima, acordes de color y acordes con bajo alternativo'},
    cad: {t:'Cadencias: puntuación musical'},
    minorh: {t:'La armonía en tonalidades menores'},
    nct: {t:'Notas ajenas al acorde'},
    secdom: {t:'Dominantes secundarias, modulación y conducción de voces'},
    form: {t:'Forma: motivos, frases y secciones'},
    accomp: {t:'Patrones de acompañamiento y partituras de melodía con cifrado'}
  },
  musicalLabels: {
    intervalBySemitones: {'1':'Segunda menor','2':'Segunda mayor','3':'Tercera menor','4':'Tercera mayor','5':'Cuarta justa','6':'Tritono','7':'Quinta justa','8':'Sexta menor','9':'Sexta mayor','10':'Séptima menor','11':'Séptima mayor','12':'Octava','13':'Novena menor','14':'Novena mayor','15':'Décima menor','16':'Décima mayor','17':'Undécima justa','18':'Undécima aumentada','19':'Duodécima justa','20':'Decimotercera menor','21':'Decimotercera mayor','22':'Decimocuarta menor','23':'Decimocuarta mayor','24':'Dos octavas'},
    scaleByEnglishName: {'Major (Ionian)':'Mayor (jónico)','Dorian':'Dórico','Phrygian':'Frigio','Lydian':'Lidio','Mixolydian':'Mixolidio','Aeolian (Natural minor)':'Eólico (menor natural)','Locrian':'Locrio','Harmonic minor':'Menor armónica','Melodic minor':'Menor melódica','Harmonic major':'Mayor armónica','Major pentatonic':'Pentatónica mayor','Minor pentatonic':'Pentatónica menor','Blues':'Blues','Whole tone':'De tonos enteros','Diminished (W-H)':'Disminuida (tono–semitono)','Diminished (H-W)':'Disminuida (semitono–tono)','Phrygian dominant':'Frigio dominante','Hungarian minor':'Menor húngara','Chromatic':'Cromática'},
    chordBySymbol: {'maj':'Mayor','m':'Menor','dim':'Disminuido','aug':'Aumentado','sus2':'Suspendido de segunda','sus4':'Suspendido de cuarta','maj7':'Séptima mayor','7':'Séptima de dominante','m7':'Séptima menor','mMaj7':'Menor con séptima mayor','m7♭5':'Semidisminuido','dim7':'Séptima disminuida','7♯5':'Séptima de dominante con quinta aumentada','7♭5':'Séptima de dominante con quinta disminuida','6':'Sexta mayor','m6':'Sexta menor','add9':'Novena añadida','9':'Novena de dominante','maj9':'Novena mayor','m9':'Novena menor','11':'Undécima','13':'Decimotercera','7♭9':'Séptima de dominante con novena menor','7♯9':'Séptima de dominante con novena aumentada','maj7♯11':'Séptima mayor con undécima aumentada'},
    categoryById: {interval:'Intervalos',chord:'Acordes',scale:'Escalas',prog:'Progresiones'},
    inversionByIndex: ['estado fundamental','primera inversión','segunda inversión','tercera inversión','cuarta inversión','quinta inversión']
  }
};
