import { describe, expect, it } from 'vitest'
import { MESSAGES } from '../locales'
import { LANGUAGES, setLanguage, t, template, type MessageKey } from '.'
import { formatAmount } from '../lib/calculations'

/*
 * Every language against English, the source: same keys, the same
 * placeholders and tags in every text, the plural forms the language needs,
 * and a context for the translator on every key.
 */

type Leaf = { context: string; message?: string } & Record<string, string>
const isLeaf = (node: unknown): node is Leaf =>
  !!node && typeof node === 'object' && 'context' in node

function leaves(node: unknown, path = ''): [string, Leaf][] {
  if (isLeaf(node)) return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, path ? `${path}.${k}` : k),
  )
}

const texts = (leaf: Leaf) =>
  Object.entries(leaf)
    .filter(([k]) => k !== 'context')
    .map(([, v]) => v)

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
const tags = (text: string) => [...text.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort()
const unique = (xs: string[]) => [...new Set(xs)].sort()

const english = new Map(leaves(MESSAGES.en))

describe('English source', () => {
  it('gives every key a context and a text', () => {
    for (const [key, leaf] of english) {
      expect(leaf.context.trim(), key).not.toBe('')
      for (const text of texts(leaf)) expect(text.trim(), key).not.toBe('')
    }
  })

  it('writes plural keys with one and other', () => {
    for (const [key, leaf] of english) {
      if ('message' in leaf) continue
      expect(Object.keys(leaf).sort(), key).toEqual(['context', 'one', 'other'])
    }
  })
})

for (const language of Object.keys(LANGUAGES).filter((l) => l !== 'en')) {
  describe(`${language} translation`, () => {
    const translated = new Map(leaves(MESSAGES[language]))
    const forms = new Intl.PluralRules(language).resolvedOptions().pluralCategories

    it('has exactly the English keys (run `npm run i18n` to sync)', () => {
      expect([...translated.keys()].sort()).toEqual([...english.keys()].sort())
    })

    it('keeps the placeholders and tags of each text', () => {
      for (const [key, source] of english) {
        const leaf = translated.get(key)
        if (!leaf) continue
        const want = unique(texts(source).flatMap(placeholders)).filter((p) => p !== 'count')
        const wantTags = unique(texts(source).flatMap(tags))
        for (const text of texts(leaf).filter(Boolean)) {
          // a plural form may leave the number out ("ostatni miesiąc"); everything else stays
          expect(unique(placeholders(text)).filter((p) => p !== 'count'), `${language}: ${key}`).toEqual(want)
          expect(unique(tags(text)), `${language}: ${key}`).toEqual(wantTags)
        }
      }
    })

    it('has the plural forms the language needs', () => {
      for (const [key, source] of english) {
        if ('message' in source) continue
        const leaf = translated.get(key)
        if (!leaf) continue
        for (const form of forms) expect(leaf[form], `${language}: ${key} (${form})`).toBeDefined()
      }
    })
  })
}

describe('t()', () => {
  it('fills placeholders and picks the plural form', () => {
    expect(t('alerts.crossedNear', { name: 'Fun', percent: 83 })).toBe('Fun is now at 83% of its limit')
    expect(t('history.entries', { count: 1 })).toBe('1 entry')
    expect(t('history.entries', { count: 5 })).toBe('5 entries')
  })

  it('follows the language, with Polish plurals and number formats', () => {
    setLanguage('pl')
    try {
      expect(t('history.entries', { count: 1 })).toBe('1 wpis')
      expect(t('history.entries', { count: 22 })).toBe('22 wpisy')
      expect(t('history.entries', { count: 25 })).toBe('25 wpisów')
      expect(formatAmount(1234.5)).toBe('1234,5')
    } finally {
      setLanguage('en')
    }
  })

  it('shows the key rather than nothing for an unknown one', () => {
    expect(template('nope.missing' as MessageKey)).toBe('nope.missing')
  })
})
