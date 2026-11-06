# French localization work in progress — not releasable

Do **not** load or offer this locale. No English fallback is included in the data or counted as translated. The application is not integrated, and most application content remains untranslated. Translations have not had native-speaker or subject-matter review.

## Data schema

`fr.json` is standalone UTF-8 JSON with:

- `schemaVersion`, `locale`, `status`: metadata; `status` is `incomplete-do-not-integrate`.
- `strings`: dictionary key → French text; missing keys are untranslated.
- `lessons`: lesson ID → `{t,b}`, translated title and HTML body. HTML tags and attributes are preserved exactly; note-name display text is translated without changing demo payloads.
- `music.intervals`: semitone count → label; `scales`: original English scale ID → label; `chords`: chord symbol → label; `categories`: category ID → label; `inversions`: index → label; `feelings`: chord symbol → description. These are display labels only, not pitch or notation data.
- `units`: Learn unit ID → French label.

The data is intentionally not wired into the app. Eventually, after **all** data and dynamic branches are translated and reviewed, integrations must load it before preference restoration, supply `STRINGS.fr` without silently masking missing translations, map lesson IDs and dynamic musical label functions to these fields, and independently localize all remaining bilingual arrays and hard-coded strings. Switching language must not alter the note-notation preference. Update offline caching and test fresh/offline installs, switching, persistence, active views, accessibility, and mobile layout. See `../../i18n-extra-notes.md` for wider architecture.

## Reproducible verification

Run `node i18n/fr/extract.cjs` to extract original STRINGS, 22 lesson bodies, units and selected musical structures from the current local source, then `node i18n/fr/build.cjs` and `node --test i18n/fr/fr.test.cjs`. The build copies the existing 143 French entries from `i18n-extra.js` and overlays the separately authored additions. `source-inventory.json` is extracted source content, **not** translated data. `FULL_COVERAGE=1 node --test i18n/fr/fr.test.cjs` is a release gate and is expected to fail until all dictionary keys and lessons have translations. Even when that gate passes, it is insufficient for release: quizzes, glossary, song references, piece titles, other arrays and direct English/Romanian branches must also be inventoried, translated, adapted and tested.

The tests compare placeholders and raw HTML tag/attribute tokens of translated entries against the extracted originals. They do not establish linguistic accuracy, completeness beyond the inventoried sections, semantic equivalence, or preservation of text that should not be translated. Original source and translations were not sent to a network service.
