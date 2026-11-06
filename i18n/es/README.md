# Spanish translation — incomplete; do not integrate

This is a working draft, **not a complete locale**. Do not register it in the app or present it as a completed translation. It deliberately contains no fallback English for missing entries. The inherited 143 translations in `i18n-extra.js` and the new material require native-speaker and musical-terminology review.

## Machine-readable schema

`es.json` is UTF-8 JSON:

- `locale`: `"es"`.
- `status`: `"incomplete-do-not-integrate"`.
- `strings`: sparse map from exact `STRINGS.en` keys to Spanish text. Interpolation tokens are unchanged.
- `lessons`: sparse map keyed by lesson `id`; `t` is the translated title and `b` is its HTML body. Missing `b` means untranslated, not an empty body. HTML tag strings, attributes, and demo values must remain unchanged.
- `musicalLabels`: maps `intervalBySemitones`, `scaleByEnglishName`, `chordBySymbol`, `categoryById`, and the zero-based `inversionByIndex` array. These represent only some of the localized hard-coded musical content; they do not change pitch identities or notation preferences.

The current app cannot consume this schema without implementation work: its preference loading, STRINGS initialization, language switching and direct English/Romanian branches all need locale-aware changes. The schema does not yet cover the many other dynamic and bilingual sources, including unit content, quizzes and glossary entries, songs, accompaniment patterns and direct strings. See `../../i18n-extra-notes.md` for the wider architecture and integration risks. Do not rely on fallback to English as localization.

## Reproduce and validate

From the project root:

```sh
node i18n/es/extract.cjs > i18n/es/source-inventory.json
node i18n/es/build-draft.cjs
node --test i18n/es/completeness.test.cjs
```

The source inventory evaluates the application's dictionary initialization and all current `Object.assign` blocks, its initial `LESSONS` array plus its `LESSONS.push` block, `LEARN_UNITS`, and `GLOSS`. It is not an exhaustive inventory of all English/Romanian branches and direct text. It contains application source text only, not user data. No source or user data is transmitted by these scripts.

The first two tests are intentionally failing until every dictionary key and lesson field is translated. The other tests compare interpolation tokens and exact HTML tag strings for every supplied dictionary value and lesson field. These checks do not establish Spanish accuracy, meaning, complete UI coverage, or HTML DOM behavior; they also do not test untranslated material or all non-dictionary content. Full browser, accessibility, offline, locale-switching and native-speaker tests remain necessary before integration.
