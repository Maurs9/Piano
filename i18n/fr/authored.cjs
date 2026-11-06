'use strict';
// Hand-authored additions. Absent entries are untranslated, not English fallbacks.
module.exports = {
  strings: {
    lu_unit:'Unité %a sur %b', lu_locked:'Verrouillée', lu_locked_t:'Cette unité est verrouillée',
    lu_locked_d:'Terminez « %a » (ou réussissez une leçon de cette unité) pour la déverrouiller. Vous pouvez aussi l’ouvrir dès maintenant si vous connaissez déjà les bases.',
    lu_unlock:'Déverrouiller quand même', lu_goto:'Aller à %a', lu_practise:'Exercice de lecture : %a', lu_practise_aria:'Ouvrir l’exercice de lecture de notes correspondant',
    lu_done_n:'%a/%b', lu_pick:'Chapitre', lu_gloss:'Glossaire', lu_due:'À réviser',
    lu_sum:'Aide-mémoire', lu_quiz:'Vérifiez vos acquis', lu_quiz_d:'%a questions : %b bonnes réponses sont nécessaires pour terminer le chapitre.',
    lu_q_start:'Commencer le test', lu_q_retry:'Réessayer', lu_q_n:'Question %a sur %b', lu_q_play:'Jouez sur le clavier (à l’écran, avec le clavier de l’ordinateur ou en MIDI).',
    lu_q_hear:'Écouter', lu_q_show:'Afficher la réponse', lu_q_next:'Question suivante', lu_q_finish:'Voir le résultat', lu_beat_say:'Compter en %a', lu_q_ok:'Correct !', lu_q_no:'Pas tout à fait : la réponse est %a.',
    lu_q_wrongnote:'%a n’en fait pas partie : recommencez.', lu_q_got:'%a notes sur %b', lu_q_pass:'Réussi : %a. Chapitre terminé !',
    lu_q_fail:'%a : il vous faut %b bonnes réponses pour réussir. Revoyez le chapitre et réessayez.', lu_q_review:'Révision terminée : %a. Prochaine révision dans %b jours.',
    lu_q_score:'Meilleur score : %a %', lu_mark_manual:'Marquer comme terminé sans passer le test', lu_complete:'Terminé', lu_complete_rev:'Terminé · prochaine révision dans %a jours',
    lu_due_now:'Révision à faire : repassez le test pour rafraîchir vos acquis.',
    lu_an_btn:'Voir dans Partition et analyse', lu_play_ex:'Écouter l’extrait', lu_stop:'Arrêter', lu_staff_hint:'Touchez une note pour l’entendre.',
    lu_note_aria:'%a, temps %b : jouer', lu_now:'%a',
    lw_scale:'Constructeur de gammes', lw_root:'Tonique', lw_steps:'Intervalles', lw_w:'T (ton)', lw_h:'S (demi-ton)', lw_wh:'T+S (3 demi-tons)',
    lw_undo:'Annuler', lw_clear:'Effacer', lw_presets:'Modèles', lw_play:'Jouer', lw_total:'%a demi-tons sur 12', lw_name:'Il s’agit de : %a',
    lw_name_none:'Pas encore de nom standard : continuez.', lw_over:'Cet intervalle dépasse l’octave.', lw_complete:'Octave atteinte !',
    lw_chord:'Constructeur d’accords', lw_quality:'Qualité', lw_inv:'Renversement', lw_bass:'Basse (après la barre oblique)', lw_inv0:'État fondamental', lw_inv1:'1er renversement',
    lw_inv2:'2e renversement', lw_inv3:'3e renversement', lw_none:'—', lw_formula:'Formule', lw_notes:'Notes', lw_symbol:'Chiffrage',
    lw_cof:'Cycle des quintes', lw_cof_d:'Choisissez une tonalité pour voir son armure et sa relative mineure.', lw_rel:'Relative mineure : %a', lw_sig:'%a',
    lw_sig0:'Ni dièse ni bémol', lw_sig_s:'%a dièse(s) : %b', lw_sig_f:'%a bémol(s) : %b',
    lw_metro:'Métronome', lw_tempo:'Tempo', lw_meter:'Mesure', lw_start:'Démarrer', lw_stop:'Arrêter', lw_bpm:'%a BPM',
    lw_blues:'Blues en do sur 12 mesures', lg_title:'Glossaire', lg_search:'Rechercher un terme', lg_ph:'par ex. cadence, legato, accord parfait…', lg_n:'%a termes',
    lg_none:'Aucun terme ne correspond à « %a ».', lg_open:'Ouvrir le chapitre', lg_close:'Retour aux chapitres',
    plan_lrev:'Réviser un chapitre', plan_lrev_d:'Révision : %a (lu il y a %b jours)', plan_lrev_more:' · +%a autres', plan_lrev_done:'Révision faite aujourd’hui : bravo.'
  },
  lessons: {
    keys:{t:'Le clavier et le nom des notes',b:`
<p>La musique utilise seulement <b>12 notes différentes</b>. Après la douzième, le cycle recommence : c’est la même note, plus aiguë. Cette distance est une <b>octave</b>, et le piano répète simplement le même motif de 12 touches.</p>
<p>Les touches blanches s’appellent <b>C D E F G A B</b> (do ré mi fa sol la si). Les touches noires se trouvent entre elles et leur empruntent leur nom : la touche noire au-dessus de C est <b>C♯</b> (« do dièse ») ; vue depuis D, cette même touche est <b>D♭</b> (« ré bémol »). Une touche, deux noms : on parle d’écriture <i>enharmonique</i>.</p>
<div class="demo-row"><button class="demo" data-demo="n:60">Do central</button><button class="demo" data-demo="n:61">C♯ / D♭</button><button class="demo" data-demo="iv:60:12">Une octave : de do à do</button></div>
<h4>Demi-tons et tons</h4>
<p>La distance entre une touche et sa voisine la plus proche (noire ou blanche) est un <b>demi-ton</b> : c’est le plus petit intervalle utilisé ici. Deux demi-tons forment un <b>ton</b>. Remarquez qu’il n’y a pas de touche noire entre <b>E–F</b> et <b>B–C</b> : ce sont des demi-tons naturels, qui donnent à chaque gamme sa forme.</p>
<div class="demo-row"><button class="demo" data-demo="iv:64:1">Demi-ton : mi→fa</button><button class="demo" data-demo="iv:60:2">Ton : do→ré</button></div>
<p class="learn-note">Pour trouver un do, cherchez le groupe de deux touches noires : do est la touche blanche immédiatement à leur gauche. Le do central (C4) se trouve près du milieu du piano.</p>`},
    iv:{t:'Les intervalles',b:`
<p>Un <b>intervalle</b> est la distance entre deux notes, comptée en demi-tons. Toute mélodie et tout accord sont construits à partir d’intervalles : apprendre à les entendre permet de retrouver les chansons à l’oreille.</p>
<p>Chaque intervalle a un nombre (seconde, tierce, quinte…) et une qualité (majeur, mineur, juste). Jouez-les tous à partir de do :</p>
<div class="demo-row"><button class="demo" data-demo="iv:60:1">m2 · 1</button><button class="demo" data-demo="iv:60:2">M2 · 2</button><button class="demo" data-demo="iv:60:3">m3 · 3</button><button class="demo" data-demo="iv:60:4">M3 · 4</button><button class="demo" data-demo="iv:60:5">P4 · 5</button><button class="demo" data-demo="iv:60:6">Triton · 6</button><button class="demo" data-demo="iv:60:7">P5 · 7</button><button class="demo" data-demo="iv:60:8">m6 · 8</button><button class="demo" data-demo="iv:60:9">M6 · 9</button><button class="demo" data-demo="iv:60:10">m7 · 10</button><button class="demo" data-demo="iv:60:11">M7 · 11</button><button class="demo" data-demo="iv:60:12">Octave · 12</button></div>
<div data-staff="iv1"></div>
<h4>Consonance et dissonance</h4>
<p>Les octaves, quintes, quartes, tierces et sixtes produisent une impression de <b>stabilité</b> (consonance). Les secondes, septièmes et le triton créent une <b>tension</b> (dissonance) et appellent un mouvement. La musique respire en passant de l’une à l’autre.</p>
<p class="learn-note">Pour mémoriser rapidement les intervalles, associez chacun à une chanson connue : le début de « My Bonnie » forme une sixte majeure. Parcourez le <a href="#" data-go="songs">recueil de chansons par intervalle</a>, puis <a href="#" data-go="practice" data-cat="interval">exercez-vous à les reconnaître à l’oreille</a>.</p>`},
    sc:{t:'Gammes et tonalités',b:`
<p>Une <b>gamme</b> est une succession de tons (T) et de demi-tons (S). C’est le motif qui compte : en le commençant sur une autre note, on conserve la même couleur, mais plus aiguë ou plus grave. La <b>gamme majeure</b> est celle de « do ré mi » :</p>
<p><span class="fm">T · T · S · T · T · T · S</span></p>
<div class="demo-row"><button class="demo" data-demo="sc:60:Major (Ionian)">Do majeur</button><button class="demo" data-demo="sc:67:Major (Ionian)">Sol majeur : même structure</button></div>
<p>La gamme <b>mineure naturelle</b> dispose les mêmes intervalles autrement, pour une couleur plus sombre : <span class="fm">T · S · T · T · S · T · T</span>. Chaque gamme majeure possède une gamme mineure utilisant exactement les mêmes notes et commençant sur son sixième degré : <b>la mineur</b> est la <i>relative mineure</i> de do majeur.</p>
<div class="demo-row"><button class="demo" data-demo="sc:57:Aeolian (Natural minor)">La mineur</button><button class="demo" data-demo="sc:60:Major pentatonic">Pentatonique majeure de do</button><button class="demo" data-demo="sc:60:Blues">Blues en do</button></div>
<div data-widget="scale"></div>
<h4>Qu’est-ce qu’une tonalité ?</h4>
<p>Dire qu’une chanson est « en do majeur » signifie que la gamme de do majeur lui sert de point d’appui : ses notes semblent naturelles et la note do donne une impression de <b>retour au point de départ</b>. Les dièses ou bémols nécessaires à cette gamme sont inscrits une fois au début de la portée : c’est l’<b>armure</b>.</p>
<p class="learn-note">Les gammes pentatoniques omettent les deux degrés les plus « piquants » (4 et 7) : ces cinq notes sonnent bien dans presque n’importe quel ordre, d’où leur présence partout, de la musique traditionnelle aux solos de rock. <a href="#" data-go="practice" data-cat="scale">Exercer les gammes →</a></p>`}
  },
  music:{
    intervals:{1:'Seconde mineure',2:'Seconde majeure',3:'Tierce mineure',4:'Tierce majeure',5:'Quarte juste',6:'Triton',7:'Quinte juste',8:'Sixte mineure',9:'Sixte majeure',10:'Septième mineure',11:'Septième majeure',12:'Octave',13:'Neuvième mineure',14:'Neuvième majeure',15:'Dixième mineure',16:'Dixième majeure',17:'Onzième juste',18:'Onzième augmentée',19:'Douzième juste',20:'Treizième mineure',21:'Treizième majeure',22:'Quatorzième mineure',23:'Quatorzième majeure',24:'Deux octaves'},
    scales:{'Major (Ionian)':'Majeure (ionien)','Dorian':'Dorien','Phrygian':'Phrygien','Lydian':'Lydien','Mixolydian':'Mixolydien','Aeolian (Natural minor)':'Éolien (mineure naturelle)','Locrian':'Locrien','Harmonic minor':'Mineure harmonique','Melodic minor':'Mineure mélodique','Harmonic major':'Majeure harmonique','Major pentatonic':'Pentatonique majeure','Minor pentatonic':'Pentatonique mineure','Blues':'Blues','Whole tone':'Par tons','Diminished (W-H)':'Diminuée (ton–demi-ton)','Diminished (H-W)':'Diminuée (demi-ton–ton)','Phrygian dominant':'Phrygien dominant','Hungarian minor':'Mineure hongroise','Chromatic':'Chromatique'},
    chords:{'13':'Treizième','11':'Onzième (sans tierce)','maj9':'Neuvième majeure','9':'Neuvième de dominante','m9':'Neuvième mineure','7♭9':'Septième de dominante avec neuvième bémol','7♯9':'Septième de dominante avec neuvième dièse','maj7♯11':'Septième majeure avec onzième dièse','maj7':'Septième majeure','7':'Septième de dominante','m7':'Septième mineure','mMaj7':'Mineur avec septième majeure','m7♭5':'Septième demi-diminuée','dim7':'Septième diminuée','7♯5':'Septième avec quinte augmentée','7♭5':'Septième de dominante avec quinte bémol','6':'Sixte majeure','m6':'Sixte mineure','add9':'Neuvième ajoutée','maj':'Majeur','m':'Mineur','dim':'Diminué','aug':'Augmenté','sus2':'Seconde suspendue','sus4':'Quarte suspendue'},
    categories:{interval:'Intervalles',chord:'Accords',scale:'Gammes',prog:'Progressions'},
    inversions:['état fondamental','1er renversement','2e renversement','3e renversement','4e renversement','5e renversement'],
    feelings:{maj:'lumineux, résolu',m:'plus sombre, mélancolique',dim:'tendu, instable',aug:'onirique',sus2:'ouvert, aérien',sus4:'suspendu',maj7:'riche, jazzy','7':'bluesy, appelle une résolution',m7:'doux, velouté','m7♭5':'sombre, cinématographique',dim7:'très tendu',mMaj7:'noir','6':'doux, rétro',m6:'nostalgique','9':'funky',maj9:'rêveur',m9:'plein d’âme'}
  },
  units:{fund:'Fondamentaux',read:'Lecture',rhythm:'Rythme',ivs:'Intervalles',scales:'Gammes et tonalités',chords:'Accords',harmony:'Harmonie',form:'Forme et style'}
};
