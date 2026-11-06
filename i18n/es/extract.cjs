'use strict';
// Extract public application sources only; this script never reads or sends user data.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'etude.html'), 'utf8');
const start = html.indexOf('const STRINGS={');
const end = html.indexOf('\nfunction t(k', start);
if (start < 0 || end < start) throw new Error('Cannot locate STRINGS');
let script = html.slice(start, end).replace('const STRINGS=', 'var STRINGS=');
for (const match of html.matchAll(/Object\.assign\(STRINGS\.(en|ro),\s*\{[\s\S]*?\n\}\);/g)) script += '\n' + match[0];
const ctx = {};
vm.runInNewContext(script, ctx);
function extractArray(name) {
  const begin = html.indexOf(`const ${name}=[`);
  const finish = html.indexOf('\n];', begin);
  if (begin < 0 || finish < begin) throw new Error(`Cannot locate ${name}`);
  const sandbox = {};
  vm.runInNewContext(html.slice(begin, finish + 3).replace(`const ${name}=`, `var ${name}=`), sandbox);
  return sandbox[name];
}
const initialLessons = extractArray('LESSONS');
const pushStart = html.indexOf('LESSONS.push(', html.indexOf('const LESSONS=['));
const pushEnd = html.indexOf('\n);', pushStart);
if (pushStart < 0 || pushEnd < pushStart) throw new Error('Cannot locate additional lessons');
const lessonContext = {LESSONS: initialLessons};
vm.runInNewContext(html.slice(pushStart, pushEnd + 3), lessonContext);
const lessons = lessonContext.LESSONS.map(({id, en, ro}) => ({id, en, ro}));
const units = extractArray('LEARN_UNITS');
const glossary = extractArray('GLOSS');
const inventory = {strings: {en: ctx.STRINGS.en, ro: ctx.STRINGS.ro}, lessons, units, glossary};
if (require.main === module) process.stdout.write(JSON.stringify(inventory, null, 2) + '\n');
module.exports = inventory;
