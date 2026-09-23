import { LOCALE } from '../config'
import { roundMoney, todayKey, yesterdayKey } from './calculations'
import type { Expense, Income } from '../types'

/** One line of the History feed — expenses and income share a single timeline. */
export type Entry =
  | { kind: 'expense'; id: string; date: string; createdAt: string; item: Expense }
  | { kind: 'income'; id: string; date: string; createdAt: string; item: Income }

export interface DayGroup {
  date: string
  entries: Entry[]
  spent: number
  earned: number
}

export function toEntries(expenses: Expense[], incomes: Income[]): Entry[] {
  const out: Entry[] = [
    ...expenses.map((e) => ({
      kind: 'expense' as const,
      id: e.id,
      date: e.expense_date,
      createdAt: e.created_at,
      item: e,
    })),
    ...incomes.map((i) => ({
      kind: 'income' as const,
      id: i.id,
      date: i.income_date,
      createdAt: i.created_at,
      item: i,
    })),
  ]
  // newest day first; within a day, the most recently logged first
  return out.sort((a, b) =>
    a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
  )
}

/** Consecutive entries of the same day, with that day's totals for the header. */
export function groupByDay(entries: Entry[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const entry of entries) {
    let group = groups[groups.length - 1]
    if (!group || group.date !== entry.date) {
      group = { date: entry.date, entries: [], spent: 0, earned: 0 }
      groups.push(group)
    }
    group.entries.push(entry)
    if (entry.kind === 'expense') group.spent = roundMoney(group.spent + entry.item.amount)
    else group.earned = roundMoney(group.earned + entry.item.amount)
  }
  return groups
}

export function totals(entries: Entry[]): { spent: number; earned: number } {
  let spent = 0
  let earned = 0
  for (const e of entries) {
    if (e.kind === 'expense') spent += e.item.amount
    else earned += e.item.amount
  }
  return { spent: roundMoney(spent), earned: roundMoney(earned) }
}

const weekdayFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const weekdayYearFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * Day header: "Today", "Yesterday", or "Mon, 22 Sep". The year only shows up
 * when it isn't this one — which happens in search results.
 */
export function dayHeading(dateKey: string): { title: string; subtitle: string | null } {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const sameYear = y === new Date().getFullYear()
  const long = (sameYear ? weekdayFormatter : weekdayYearFormatter).format(date)
  if (dateKey === todayKey()) return { title: 'Today', subtitle: long }
  if (dateKey === yesterdayKey()) return { title: 'Yesterday', subtitle: long }
  return { title: long, subtitle: null }
}

const loggedFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** "Logged 24 Sep, 18:02" — when the row was entered, as opposed to its date. */
export function formatLogged(createdAt: string): string {
  return loggedFormatter.format(new Date(createdAt))
}

/**
 * Makes free text safe to drop into a PostgREST `or=(…)` filter: the commas,
 * parentheses and quotes would break its syntax, and % / _ are LIKE wildcards.
 */
export function sanitizeSearch(query: string): string {
  return query.replace(/[%_,()"'\\*]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** "45", "45,50", "45.5" → 45.5; anything else → null. */
export function parseAmountQuery(query: string): number | null {
  const q = query.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(q)) return null
  return Number(q)
}
