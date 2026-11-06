'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const source = require('./originals.json');
const data = require('./data.json');
const keys = x => Object.keys(x);
const tokens = s => (s.match(/%[sab]/g) || []).sort();
const tags = s => s.match(/<\/?[A-Za-z][^>]*>/g) || [];

test('draft dictionary contains known, nonempty strings with original placeholders and markup', () => {
  for (const [key, value] of Object.entries(data.strings)) {
    assert.ok(Object.hasOwn(source.strings.en, key), `unknown key ${key}`);
    assert.equal(typeof value, 'string', key);
    assert.ok(value.trim(), key);
    assert.deepEqual(tokens(value), tokens(source.strings.en[key]), `placeholders: ${key}`);
    assert.deepEqual(tags(value), tags(source.strings.en[key]), `HTML tags/attributes: ${key}`);
  }
});
test('translated lessons preserve every source HTML tag and attribute', () => {
  const byId = Object.fromEntries(source.lessons.map(x => [x.id,x]));
  for (const [id, value] of Object.entries(data.lessons)) {
    assert.ok(byId[id], `unknown lesson ${id}`);
    assert.ok(value.title.trim() && value.body.trim(), id);
    assert.deepEqual(tokens(value.body), tokens(byId[id].en.b), `placeholders: ${id}`);
    assert.deepEqual(tags(value.body), tags(byId[id].en.b), `HTML tags/attributes: ${id}`);
  }
});
test('unit, interval and scale IDs match source', () => {
  assert.deepEqual(keys(data.units).sort(), source.units.map(u => u.id).sort());
  assert.deepEqual(keys(data.intervals).sort(), keys(source.compound).sort());
  assert.deepEqual(keys(data.scales).sort(), keys(source.scales).sort());
  assert.deepEqual(keys(data.chords).sort(), source.chords.map(c=>c.symbol).sort());
});

test('complete locale gate: no fallback, no incomplete status', () => {
  const missingStrings = keys(source.strings.en).filter(k => !Object.hasOwn(data.strings,k));
  const missingLessons = source.lessons.filter(l => !Object.hasOwn(data.lessons,l.id)).map(l=>l.id);
  assert.deepEqual({missingStrings:missingStrings.length,missingLessons:missingLessons.length,status:data.status},
    {missingStrings:0,missingLessons:0,status:'complete'});
});
