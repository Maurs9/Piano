# Brazilian Portuguese — incomplete working data

**Do not enable or present this locale.** It is not a completed translation or a preview. The JSON contains only translated entries, not English fallbacks. It has not been reviewed by a Brazilian Portuguese music educator or native-language reviewer.

## Files and schema

- `originals.json`: a reproducible snapshot of the application-owned English and Romanian dictionaries, lesson objects, units, glossary, compound interval names, scale patterns and chord objects. `node i18n/pt-BR/extract.cjs` rebuilds it from the local `etude.html`; no user data or network is involved. It does **not** inventory every inline English/Romanian conditional, quiz, widget, accompaniment pattern, song reference or piece title.
- `data.json`: UTF-8 JSON with `locale`, `status`, `strings` (STRINGS key → text), `lessons` (lesson ID → `{title, body}`), `units` (unit ID → label), `intervals` (semitone count → name), `scales` (original scale identity → name), and `chords` (original chord symbol → name). Existing note identities, symbols and all attributes remain unchanged. `build-draft.cjs` reproduces the current data from the existing partial `i18n-extra.js` plus the additional hand-authored entries; it overwrites `data.json`, so first merge future edits back into the builder or retire the builder.
- `coverage.test.cjs`: validates placeholders and raw HTML tag/attribute sequences for supplied dictionary and lesson entries, checks unit and selected musical key sets, and deliberately fails the completion gate while entries are missing. Run `node --test i18n/pt-BR/coverage.test.cjs`.

## Proposed integration contract (not implemented)

After translation, independent linguistic/music review and complete additional-source inventory, load the JSON or an equivalent JS wrapper *before preference restoration*, map `strings` into `STRINGS['pt-BR']`, and map lesson IDs to `LESSONS[i]['pt-BR'] = {t: title, b: body}`. Route lesson, unit, interval, scale and chord display functions by locale while retaining stable IDs for calculation and playback. Other `lang === 'ro'` branches, glossary, quizzes, song names and accessible labels also require explicit locale support. Preserve note-notation preference independently. Prevent activation when coverage or review is incomplete. See `../../i18n-extra-notes.md` for restoration, rendering and offline caveats.

The current completion gate measures dictionary and lesson coverage only, plus the status flag. It does not prove complete localization or correct translation, even if those assertions eventually pass. Add independent exhaustive tests for the remaining dynamically rendered content, language switching, persistence, accessibility, offline caching, and notation before release.
