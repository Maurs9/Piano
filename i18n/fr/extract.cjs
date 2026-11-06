'use strict';
// Extract original data without executing the application or accessing user data.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'etude.html'), 'utf8').replace(/\r\n/g, '\n');
function between(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw Error('Source boundary missing: ' + start + ' / ' + end);
  return html.slice(a, b);
}
let dict = between('const STRINGS={', '\nfunction t(k').replace('const STRINGS=', 'var STRINGS=');
for (const match of html.matchAll(/Object\.assign\(STRINGS\.(en|ro),\s*\{[\s\S]*?\n\}\);/g)) dict += '\n' + match[0];
const ctx = {};
vm.runInNewContext(dict, ctx, {timeout: 5000});
const lessonCode = between('const LESSONS=[', '/* ---------- LEARN v4:').replace('const LESSONS=', 'var LESSONS=');
vm.runInNewContext(lessonCode, ctx, {timeout: 5000});
const music = between('const INTERVALS=[', 'const SCALE_DEG=') + '\nthis.music={INTERVALS,COMPOUND,SONGS,SCALES,CHORDS,CHORD_FEEL,INV_NAMES};';
vm.runInNewContext(music, ctx, {timeout: 5000});
const units = between('const LEARN_UNITS=[', 'const LEARN_OLD_ORDER=').replace('const LEARN_UNITS=', 'var LEARN_UNITS=');
vm.runInNewContext(units, ctx, {timeout: 5000});
const source = {strings:ctx.STRINGS.en, lessons:ctx.LESSONS.map(({id,en})=>({id,...en})), music:ctx.music, units:ctx.LEARN_UNITS};
fs.writeFileSync(path.join(__dirname, 'source-inventory.json'), JSON.stringify(source, null, 2)+'\n');
console.log(JSON.stringify({strings:Object.keys(source.strings).length,lessons:source.lessons.length,scales:Object.keys(source.music.SCALES).length,chords:source.music.CHORDS.length,units:source.units.length}));
