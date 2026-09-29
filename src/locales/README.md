# Translations

Every piece of text the app shows lives here, one folder per language and one
file per part of the app (`settings.json`, `savings.json`, …). English (`en/`)
is the source: new keys are added there first.

## A key

```json
"overTitle": {
  "message": "{name} is over its limit",
  "context": "Budget warning title (Budget tab, Add screen): a spending category went over its monthly limit. {name} is the category's name as the user typed it."
}
```

- `message` is the text. Translate only this.
- `context` says where the text appears and what its placeholders are. It's
  always in English and is copied from `en/` into every language by
  `npm run i18n`, so don't edit it outside `en/`.
- `{name}`, `{amount}`, … are filled in by the app. Keep every one of them;
  move them wherever the sentence needs them.
- `<b>…</b>`, `<code>…</code>`, `<link>…</link>`, `<kbd>…</kbd>` wrap part of
  the text in bold, code or a button. Keep the tags, around the matching words.
- Amounts arrive already formatted with the currency (`1,250 zł`), and months
  as names (`September`, or in Polish the nominative `wrzesień`): write the
  sentence so they fit without declension, e.g. `w miesiącu {month}`.

## Plurals

A text that depends on a number has plural forms instead of `message`:

```json
"entries": {
  "one": "{count} entry",
  "other": "{count} entries",
  "context": "…"
}
```

Each language gets the forms its grammar needs (Unicode CLDR plural rules):
English `one`/`other`, Polish `one` (1), `few` (2–4, 22–24…), `many` (5–21,
25…) and `other` (fractions, e.g. 1.5). `npm run i18n` adds the right ones.

## Adding a language

1. Add it to `LANGUAGES` in `src/i18n/index.ts` (its name in its own language
   and the locale for dates and numbers, e.g. `de: { name: 'Deutsch', locale: 'de-DE' }`).
2. Create the folder: `mkdir src/locales/de`.
3. `npm run i18n` creates every file with every key, empty messages and the
   English context. It also lists what's still untranslated.
4. Translate the `message` fields. An empty one falls back to English.
5. `npm test` checks that nothing is missing and every placeholder and tag
   is kept.

The AI features (recommendations, the plan draft) are asked to write in the
app's language too: add the language's English name to `LANGUAGE_NAMES` in
`api/_gemini.ts`.

## Adding or changing text in the code

```ts
import { t } from '../i18n'
t('settings.people.title')
t('history.entries', { count: entries.length })
```

With markup, `<Trans k="forecast.saved" values={{ amount }} tags={{ b: (s) => <strong>{s}</strong> }} />`
from `src/i18n/Trans.tsx`. Keys are type-checked against `en/`.

Add the key to the right `en/*.json` with a `context`, run `npm run i18n` (it
regenerates `src/locales/index.ts` and adds the key to the other languages),
then translate it there.
