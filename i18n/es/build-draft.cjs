'use strict';
const fs = require('node:fs');
const path = require('node:path');
const existing = require('../../i18n-extra.js').es;
const draft = require('./draft.cjs');
const result = {
  locale: 'es',
  status: 'incomplete-do-not-integrate',
  strings: {...existing, ...require('./strings-batch1.cjs')},
  lessons: draft.lessons,
  musicalLabels: draft.musicalLabels
};
fs.writeFileSync(path.join(__dirname, 'es.json'), JSON.stringify(result, null, 2) + '\n');
