'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const source = require('./source-inventory.json');
const fr = require('./fr.json');
const tokens = s => (s.match(/%[sab]/g) || []).sort();
// Compare raw tag tokens, including every attribute and its value.
const tags = s => s.match(/<\/?[a-z][^>]*>/gi) || [];
const keyset = (a, b) => assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
test('translated dictionary keys are valid, nonempty and preserve placeholders and markup', () => {
  for (const [key, value] of Object.entries(fr.strings)) {
    assert.ok(Object.hasOwn(source.strings, key), `unknown key ${key}`);
    assert.equal(typeof value, 'string'); assert.ok(value.trim(), key);
    assert.deepEqual(tokens(value), tokens(source.strings[key]), `placeholders: ${key}`);
    assert.deepEqual(tags(value), tags(source.strings[key]), `markup: ${key}`);
  }
});
test('translated lesson bodies preserve every tag and attribute in order', () => {
  for (const [id, value] of Object.entries(fr.lessons)) {
    const original = source.lessons.find(item => item.id === id);
    assert.ok(original, `unknown lesson ${id}`);
    assert.ok(value.t.trim() && value.b.trim(), id);
    assert.deepEqual(tags(value.b), tags(original.b), `markup: ${id}`);
    assert.deepEqual(tokens(value.b), tokens(original.b), `placeholders: ${id}`);
  }
});
test('music and unit identifiers cover the extracted source', () => {
  keyset(fr.music.intervals, source.music.COMPOUND);
  keyset(fr.music.scales, source.music.SCALES);
  keyset(fr.music.chords, Object.fromEntries(source.music.CHORDS.map(c=>[c.symbol,1])));
  keyset(fr.music.feelings, source.music.CHORD_FEEL);
  assert.equal(fr.music.inversions.length, source.music.INV_NAMES.length);
  keyset(fr.units, Object.fromEntries(source.units.map(u=>[u.id,1])));
});
test('coverage is reported honestly', () => {
  assert.equal(fr.status, 'incomplete-do-not-integrate');
  console.log(`Coverage: dictionary ${Object.keys(fr.strings).length}/${Object.keys(source.strings).length}; lessons ${Object.keys(fr.lessons).length}/${source.lessons.length}; scales ${Object.keys(fr.music.scales).length}/${Object.keys(source.music.SCALES).length}; chord symbols ${Object.keys(fr.music.chords).length}/${source.music.CHORDS.length}; units ${Object.keys(fr.units).length}/${source.units.length}.`);
});
if (process.env.FULL_COVERAGE === '1') test('release gate: all dictionary and lesson entries exist', () => {
  keyset(fr.strings, source.strings);
  keyset(fr.lessons, Object.fromEntries(source.lessons.map(l=>[l.id,1])));
});
