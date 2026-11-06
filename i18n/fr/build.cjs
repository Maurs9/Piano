'use strict';
// Build a self-contained data file; absent keys must never be treated as translated.
const fs = require('node:fs');
const path = require('node:path');
const base = require('../../i18n-extra.js').fr;
const authored = require('./authored.cjs');
const data = {
  schemaVersion: 1,
  locale: 'fr',
  status: 'incomplete-do-not-integrate',
  strings: {...base, ...authored.strings},
  lessons: authored.lessons,
  music: authored.music,
  units: authored.units
};
fs.writeFileSync(path.join(__dirname, 'fr.json'), JSON.stringify(data, null, 2) + '\n');
console.log(`Wrote ${Object.keys(data.strings).length} dictionary entries and ${Object.keys(data.lessons).length} complete lessons.`);
