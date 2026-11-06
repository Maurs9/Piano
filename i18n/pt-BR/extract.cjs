'use strict';
// Extract only static, application-owned declarations; never read browser storage.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'etude.html'), 'utf8');
function between(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Cannot locate ${start} … ${end}`);
  return html.slice(a, b);
}
function evaluate(src, names) {
  return vm.runInNewContext(`${src}\n;JSON.stringify({${names.join(',')}})`, {}, {timeout: 3000});
}
let strings = between('const STRINGS={', '\nfunction t(k');
for (const m of html.matchAll(/Object\.assign\(STRINGS\.(en|ro),\s*\{[\s\S]*?\n\}\);/g)) strings += '\n' + m[0];
const dictionaries = JSON.parse(evaluate(strings, ['STRINGS'])).STRINGS;
const lessons = JSON.parse(evaluate(between('const LESSONS=[', '\n/* ---------- LEARN v4:'), ['LESSONS'])).LESSONS;
const units = JSON.parse(evaluate(between('const LEARN_UNITS=[', 'const LEARN_OLD_ORDER='), ['LEARN_UNITS'])).LEARN_UNITS;
const gloss = JSON.parse(evaluate(between('const GLOSS=[', '\nfunction lgHTML'), ['GLOSS'])).GLOSS;
const compound = JSON.parse(evaluate(between('const COMPOUND={', '\nconst SONGS='), ['COMPOUND'])).COMPOUND;
const scales = JSON.parse(evaluate(between('const SCALES={', '\nconst CHORDS='), ['SCALES'])).SCALES;
const chords = JSON.parse(evaluate(between('const CHORDS=[', '\nCHORDS.forEach'), ['CHORDS'])).CHORDS;
const out = {source: 'etude.html', strings: dictionaries, lessons, units, glossary: gloss, compound, scales, chords};
fs.writeFileSync(path.join(__dirname, 'originals.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({enStrings:Object.keys(dictionaries.en).length,roStrings:Object.keys(dictionaries.ro).length,lessons:lessons.length,units:units.length,glossary:gloss.length}));
