import { useSyncExternalStore } from 'react'
import { MESSAGES, type Messages } from '../locales'

/*
 * Translations. Every piece of text the app shows comes from
 * src/locales/<language>/<namespace>.json (see src/locales/README.md), looked
 * up with t('namespace.key'). The language is a setting of this device, like
 * the chosen person; changing it re-renders the whole app (main.tsx keys the
 * app on it), so t() can be a plain function usable outside React too.
 */

export const LANGUAGES = {
  en: { name: 'English', locale: 'en-GB' },
  pl: { name: 'Polski', locale: 'pl-PL' },
} as const

export type Language = keyof typeof LANGUAGES

const STORAGE_KEY = 'budget-app.language'

const isLanguage = (v: unknown): v is Language =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(LANGUAGES, v)

function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(stored)) return stored
  } catch {
    // no storage (private mode, tests): fall through to the browser's language
  }
  const preferred = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
  for (const tag of preferred) {
    const base = tag?.toLowerCase().split('-')[0]
    if (isLanguage(base)) return base
  }
  return 'en'
}

let current: Language = initialLanguage()
const listeners = new Set<() => void>()

function applyToDocument() {
  if (typeof document !== 'undefined') document.documentElement.lang = current
}
applyToDocument()

export function getLanguage(): Language {
  return current
}

/** BCP 47 tag for Intl: dates, numbers and plural rules. */
export function locale(): string {
  return LANGUAGES[current].locale
}

export function setLanguage(language: Language) {
  if (language === current) return
  current = language
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // remembered for this session only
  }
  applyToDocument()
  for (const l of listeners) l()
}

export function useLanguage(): Language {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
    () => current,
  )
}

/* ---------- lookup ---------- */

/** A leaf of a locale file: one text, or its plural forms, plus a note for translators. */
type Leaf = { context: string }

/** 'settings.people.title' and so on: every key in the English files. */
type KeysOf<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Leaf ? `${P}${K}` : KeysOf<T[K], `${P}${K}.`>
}[keyof T & string]

export type MessageKey = KeysOf<Messages>

export type Params = Record<string, string | number>

type Entry = { message?: string; context: string } & Partial<Record<Intl.LDMLPluralRule, string>>

function find(language: Language, key: string): Entry | undefined {
  let node: unknown = MESSAGES[language]
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node && typeof node === 'object' && 'context' in node ? (node as Entry) : undefined
}

const pluralRules = new Map<Language, Intl.PluralRules>()
function pluralCategory(language: Language, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(language)
  if (!rules) pluralRules.set(language, (rules = new Intl.PluralRules(LANGUAGES[language].locale)))
  return rules.select(count)
}

/** The text of one language, or undefined while it's untranslated (an empty string). */
function pick(language: Language, key: string, count: number | undefined): string | undefined {
  const entry = find(language, key)
  if (!entry) return undefined
  if (entry.message !== undefined) return entry.message || undefined
  const form = count === undefined ? 'other' : pluralCategory(language, count)
  return entry[form] || entry.other || undefined
}

/** The raw text for a key, before {placeholders} are filled in. */
export function template(key: MessageKey, count?: number): string {
  return pick(current, key, count) ?? pick('en', key, count) ?? key
}

/**
 * The text for a key in the current language, falling back to English.
 * `{name}` placeholders are filled from `params`; a key with plural forms
 * picks one by `params.count`.
 */
export function t(key: MessageKey, params?: Params): string {
  const count = typeof params?.count === 'number' ? params.count : undefined
  const text = template(key, count)
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}

/* ---------- Intl, cached per language ---------- */

const dateFormats = new Map<string, Intl.DateTimeFormat>()
const numberFormats = new Map<string, Intl.NumberFormat>()

/** A DateTimeFormat for the current language; the same options reuse one instance. */
export function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const id = `${locale()}|${JSON.stringify(options)}`
  let f = dateFormats.get(id)
  if (!f) dateFormats.set(id, (f = new Intl.DateTimeFormat(locale(), options)))
  return f
}

export function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const id = `${locale()}|${JSON.stringify(options)}`
  let f = numberFormats.get(id)
  if (!f) numberFormats.set(id, (f = new Intl.NumberFormat(locale(), options)))
  return f
}

/** "and"-joined list in the current language: "Ala, Ola and Ela". */
export function formatList(items: string[]): string {
  return new Intl.ListFormat(locale(), { type: 'conjunction' }).format(items)
}
