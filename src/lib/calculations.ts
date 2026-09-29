import { CURRENCY_SUFFIX, LOCALE } from '../config'
import type { Category, Expense, Person } from '../types'
import { zeroByPerson } from './people'

/* ---------- dates ---------- */

/** `YYYY-MM` — the month key used by queries and filters. */
export type MonthKey = string

const pad = (n: number) => String(n).padStart(2, '0')

/** Local date as YYYY-MM-DD (unlike toISOString, which shifts by timezone). */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toDateKey(d)
}

export function toMonthKey(date: Date): MonthKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export function currentMonthKey(): MonthKey {
  return toMonthKey(new Date())
}

export function monthKeyOfDate(dateKey: string): MonthKey {
  return dateKey.slice(0, 7)
}

/**
 * The month a paycheck pays for: the one it was marked for (pay on the 28th
 * for the month after), else the one it arrived in.
 */
export function incomeMonth(i: { income_date: string; for_month?: string | null }): MonthKey {
  return i.for_month ?? monthKeyOfDate(i.income_date)
}

/** First and last day of the month as YYYY-MM-DD, both inclusive. */
export function monthRange(month: MonthKey): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${pad(last)}` }
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number)
  return toMonthKey(new Date(y, m - 1 + delta, 1))
}

const monthFormatter = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' })
const dayFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** "September 2026" */
export function formatMonth(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number)
  return monthFormatter.format(new Date(y, m - 1, 1))
}

const monthShortFormatter = new Intl.DateTimeFormat(LOCALE, { month: 'short' })
const monthNameFormatter = new Intl.DateTimeFormat(LOCALE, { month: 'long' })

/** "Sep" — axis labels. */
export function formatMonthShort(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number)
  return monthShortFormatter.format(new Date(y, m - 1, 1))
}

/** "September" — in sentences, where the year is obvious. */
export function formatMonthName(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number)
  return monthNameFormatter.format(new Date(y, m - 1, 1))
}

/** "5 September 2026" */
export function formatDayLong(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return dayFormatter.format(new Date(y, m - 1, d))
}

const shortDayFormatter = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' })

/** "5 Sep" — for tight spaces like the date chip. */
export function formatDayShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return shortDayFormatter.format(new Date(y, m - 1, d))
}

/**
 * Day cells for the month, starting on Monday; `null` marks the padding before
 * the first and after the last day.
 */
export function monthGrid(month: MonthKey): (string | null)[] {
  const [y, m] = month.split('-').map(Number)
  const dayCount = new Date(y, m, 0).getDate()
  // getDay(): 0 = Sunday → we want 0 = Monday
  const leading = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const cells: (string | null)[] = Array(leading).fill(null)
  for (let d = 1; d <= dayCount; d++) cells.push(`${month}-${pad(d)}`)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/* ---------- amounts ---------- */

const amountFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
const preciseFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Compact, for tiles and lists: "1,569" */
export function formatAmount(amount: number): string {
  return amountFormatter.format(amount)
}

/** With currency: "1,569.00 zł" */
export function formatMoney(amount: number): string {
  return `${preciseFormatter.format(amount)} ${CURRENCY_SUFFIX}`
}

/** "7,550 zł" for a round amount, "482.50 zł" otherwise — totals in tight spaces. */
export function formatMoneyCompact(amount: number): string {
  return Number.isInteger(amount) ? `${amountFormatter.format(amount)} ${CURRENCY_SUFFIX}` : formatMoney(amount)
}

/**
 * Whole złoty: "7,136 zł". For estimates — projections, averages — where the
 * grosze would claim a precision the number doesn't have.
 */
export function formatMoneyWhole(amount: number): string {
  return `${amountFormatter.format(Math.round(amount))} ${CURRENCY_SUFFIX}`
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

/* ---------- aggregates ---------- */

export function sumExpenses(expenses: Expense[]): number {
  return roundMoney(expenses.reduce((acc, e) => acc + e.amount, 0))
}

export function sumByCategory(expenses: Expense[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of expenses) out[e.category_id] = roundMoney((out[e.category_id] ?? 0) + e.amount)
  return out
}

export function sumByDay(expenses: Expense[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of expenses) out[e.expense_date] = roundMoney((out[e.expense_date] ?? 0) + e.amount)
  return out
}

export function sumByPerson(expenses: Expense[]): Record<Person, number> {
  const out = zeroByPerson()
  for (const e of expenses) out[e.person] = roundMoney((out[e.person] ?? 0) + e.amount)
  return out
}

/* ---------- visual indicators ---------- */

/** Share of the monthly limit used: 0 = nothing, 1 = at the limit, >1 = over. */
export function limitRatio(spent: number, monthlyLimit: number): number {
  if (!monthlyLimit || monthlyLimit <= 0) return 0
  return spent / monthlyLimit
}

/** Tile fill height in percent, capped at 100. */
export function fillPercent(spent: number, monthlyLimit: number): number {
  return Math.min(limitRatio(spent, monthlyLimit), 1) * 100
}

export function isOverLimit(spent: number, monthlyLimit: number): boolean {
  return monthlyLimit > 0 && spent > monthlyLimit
}

/**
 * Heat of a single day relative to the month's daily average.
 * 0 = nothing spent, 1 = twice the average or more.
 */
export function heatIntensity(dayTotal: number, monthTotal: number, days: number): number {
  if (dayTotal <= 0) return 0
  const avg = monthTotal / Math.max(days, 1)
  if (avg <= 0) return 1
  return Math.min(dayTotal / (avg * 2), 1)
}

/* ---------- colors ---------- */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const DARK_TEXT = '#10151f'
const LIGHT_TEXT = '#ffffff'

/** WCAG relative luminance. */
function relativeLuminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

/** Dark or white text — whichever contrasts better against the given background. */
export function readableTextColor(hex: string): string {
  const bg = relativeLuminance(hex)
  const onDark = contrastRatio(bg, relativeLuminance(DARK_TEXT))
  const onLight = contrastRatio(bg, relativeLuminance(LIGHT_TEXT))
  return onDark >= onLight ? DARK_TEXT : LIGHT_TEXT
}

export function categoryById(categories: Category[]): Record<string, Category> {
  return Object.fromEntries(categories.map((c) => [c.id, c]))
}

/* ---------- text ---------- */

/**
 * AI-written text without em or en dashes, which the app's copy doesn't use.
 * The prompts ask for none, but older answers are stored and models slip:
 * a dash between words becomes a comma, between numbers a hyphen.
 */
export function plainDashes(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2')
    .replace(/\s*[–—]\s*/g, ', ')
}
