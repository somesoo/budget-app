import { describe, expect, it } from 'vitest'
import { MESSAGES } from '../locales'
import { GUIDE, GUIDE_LABELS, startProgress } from './guide'

const lookup = (lang: keyof typeof MESSAGES, key: string): string | undefined => {
  let node: unknown = MESSAGES[lang]
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part]
  return (node as { message?: string } | undefined)?.message
}

describe('guide', () => {
  it('has a title, a when and a text for every section and step, in every language', () => {
    for (const lang of Object.keys(MESSAGES) as (keyof typeof MESSAGES)[]) {
      for (const s of GUIDE) {
        expect(lookup(lang, `guide.${s.id}.title`), `${lang} ${s.id}.title`).toBeTruthy()
        expect(lookup(lang, `guide.${s.id}.when`), `${lang} ${s.id}.when`).toBeTruthy()
        for (const step of s.steps) {
          expect(lookup(lang, `guide.${s.id}.${step.id}`), `${lang} ${s.id}.${step.id}`).toBeTruthy()
        }
      }
    }
  })

  it('names only buttons it has a label for, and every label exists', () => {
    const known = new Set([...Object.keys(GUIDE_LABELS), 'planMonth'])
    for (const s of GUIDE) {
      for (const step of s.steps) {
        const text = lookup('en', `guide.${s.id}.${step.id}`) ?? ''
        for (const [, name] of text.matchAll(/\{(\w+)\}/g)) {
          expect(known.has(name), `{${name}} in ${s.id}.${step.id}`).toBe(true)
        }
      }
    }
    for (const key of Object.values(GUIDE_LABELS)) expect(lookup('en', key), key).toBeTruthy()
  })

  it('counts only the checkable, required getting-started steps it knows about', () => {
    expect(startProgress({})).toEqual({ done: 0, total: 0 })
    expect(startProgress({ accounts: true, emergency: false, debts: false, ai: false })).toEqual({
      done: 1,
      total: 2,
    })
  })
})
