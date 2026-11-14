/*
 * The month for other apps (api/v1): what the Budget tab's numbers come to,
 * and the checks an expense from outside has to pass. No I/O here, so every
 * rule is tested (_month.test.ts).
 *
 * Money is added in whole grosze: the database stores numeric(…, 2), and
 * sums of floats would drift.
 */

export interface CategoryRow {
  id: string
  name: string
  color: string
  monthly_limit: number | string
  sort_order: number
  archived: boolean
  kind: 'monthly' | 'project'
  owner: string | null
}

export interface ExpenseRow {
  id: string
  amount: number | string
  category_id: string
  person: string
  expense_date: string
  created_at: string
}

export interface BudgetRow {
  income: number | string
  savings: number | string
  limits: Record<string, number | string> | null
}

export type Level = 'ok' | 'near' | 'over'

/** Same line as the app's warnings (src/lib/alerts.ts). */
export const NEAR_RATIO = 0.8

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isMonth = (value: unknown): value is string =>
  typeof value === 'string' && MONTH.test(value)
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value)

/** A real calendar day, YYYY-MM-DD (2026-02-30 is not one). */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Today where the budget lives: the app writes local dates, never UTC ones. */
export function todayIn(zone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(now)
}

export function monthRange(month: string): { from: string; to: string; days: number } {
  const [y, m] = month.split('-').map(Number)
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(days).padStart(2, '0')}`, days }
}

const shiftDay = (day: string, delta: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10)

export const cents = (value: number | string | null | undefined) =>
  Math.round(Number(value ?? 0) * 100)
export const money = (c: number) => c / 100

export function level(spentCents: number, limitCents: number): Level {
  if (limitCents <= 0) return 'ok'
  if (spentCents > limitCents) return 'over'
  return spentCents / limitCents >= NEAR_RATIO ? 'near' : 'ok'
}

export interface CategoryStatus {
  id: string
  name: string
  color: string
  /** One person's allowance, or null when shared. */
  owner: string | null
  archived: boolean
  limit: number
  spent: number
  remaining: number
  level: Level
}

/**
 * Every monthly category against its limit this month: the month's own plan
 * where it has one for the category, else the category's default. Archived
 * categories appear only when something was spent in them.
 */
export function monthStatus(
  categories: CategoryRow[],
  expenses: ExpenseRow[],
  budget: BudgetRow | null,
): CategoryStatus[] {
  const spent = new Map<string, number>()
  for (const e of expenses) spent.set(e.category_id, (spent.get(e.category_id) ?? 0) + cents(e.amount))
  return categories
    .filter((c) => c.kind === 'monthly' && (!c.archived || spent.has(c.id)))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((c) => {
      const planned = budget?.limits?.[c.id]
      const limit = cents(planned ?? c.monthly_limit)
      const used = spent.get(c.id) ?? 0
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        owner: c.owner,
        archived: c.archived,
        limit: money(limit),
        spent: money(used),
        remaining: money(limit - used),
        level: level(used, limit),
      }
    })
}

export interface MonthSummary {
  month: string
  currency: 'PLN'
  today: string
  days_in_month: number
  /** Days still to come after today; 0 for a month that's over, all of them for one ahead. */
  days_left: number
  has_plan: boolean
  income: { received: number; planned: number | null }
  spending: { spent: number; limit: number; remaining: number; projects: number }
  savings_planned: number | null
  expenses: number
  categories: { over: number; near: number }
  last_expense: { date: string; amount: number; category: string } | null
}

export function monthSummary(args: {
  month: string
  today: string
  categories: CategoryRow[]
  expenses: ExpenseRow[]
  incomes: { amount: number | string }[]
  budget: BudgetRow | null
}): MonthSummary {
  const { month, today, categories, expenses, budget } = args
  const { from, to, days } = monthRange(month)
  const status = monthStatus(categories, expenses, budget)
  const kind = new Map(categories.map((c) => [c.id, c.kind]))
  const name = new Map(categories.map((c) => [c.id, c.name]))
  const sum = (rows: { amount: number | string }[]) => rows.reduce((a, r) => a + cents(r.amount), 0)
  const monthly = expenses.filter((e) => kind.get(e.category_id) !== 'project')
  const limit = status.filter((c) => !c.archived).reduce((a, c) => a + cents(c.limit), 0)
  const spent = sum(monthly)
  const last = [...monthly].sort(
    (a, b) => b.expense_date.localeCompare(a.expense_date) || b.created_at.localeCompare(a.created_at),
  )[0]
  return {
    month,
    currency: 'PLN',
    today,
    days_in_month: days,
    days_left: today < from ? days : today > to ? 0 : Number(to.slice(8)) - Number(today.slice(8)),
    has_plan: budget !== null,
    income: { received: money(sum(args.incomes)), planned: budget ? money(cents(budget.income)) : null },
    spending: {
      spent: money(spent),
      limit: money(limit),
      remaining: money(limit - spent),
      // a trip or another goal's spending: paid from savings, outside the month's limits
      projects: money(sum(expenses) - spent),
    },
    savings_planned: budget ? money(cents(budget.savings)) : null,
    expenses: monthly.length,
    categories: {
      over: status.filter((c) => c.level === 'over').length,
      near: status.filter((c) => c.level === 'near').length,
    },
    last_expense: last
      ? { date: last.expense_date, amount: money(cents(last.amount)), category: name.get(last.category_id) ?? '' }
      : null,
  }
}

export interface NewExpense {
  amount: number
  category_id: string
  person: string
  note: string | null
  expense_date: string
}

export const NOTE_MAX = 200
/** How far back an expense from another app may be dated; it can't be dated ahead. */
export const BACKDATE_DAYS = 31
const AMOUNT_MAX_CENTS = 99_999_999_99

/**
 * An expense sent by another app, checked against the budget as it is now.
 * Returns the row to insert, or a short machine-readable reason.
 */
export function checkExpense(
  body: unknown,
  ctx: { today: string; categories: CategoryRow[]; people: string[]; tokenPerson: string | null },
): { ok: true; expense: NewExpense } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error })
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('invalid_body')
  const input = body as Record<string, unknown>
  const allowed = ['amount', 'category_id', 'person', 'note', 'date']
  if (Object.keys(input).some((key) => !allowed.includes(key))) return fail('unknown_field')

  const amount = input.amount
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return fail('invalid_amount')
  const c = Math.round(amount * 100)
  if (c <= 0 || c > AMOUNT_MAX_CENTS || Math.abs(amount * 100 - c) > 1e-6) return fail('invalid_amount')

  if (!isUuid(input.category_id)) return fail('invalid_category')
  const category = ctx.categories.find((x) => x.id === input.category_id)
  // a project's spending moves money on a savings account: that stays in the app
  if (!category || category.archived || category.kind !== 'monthly') return fail('invalid_category')

  const person = input.person === undefined || input.person === null ? ctx.tokenPerson : input.person
  if (typeof person !== 'string' || !ctx.people.includes(person)) return fail('invalid_person')
  // a key made for one person adds only their expenses
  if (ctx.tokenPerson && person !== ctx.tokenPerson) return fail('person_not_allowed')
  // an allowance is its owner's to spend
  if (category.owner && category.owner !== person) return fail('person_not_allowed')

  let note: string | null = null
  if (input.note !== undefined && input.note !== null) {
    if (typeof input.note !== 'string') return fail('invalid_note')
    const trimmed = input.note.trim()
    if (trimmed.length > NOTE_MAX) return fail('invalid_note')
    note = trimmed || null
  }

  const date = input.date === undefined || input.date === null ? ctx.today : input.date
  if (!isDay(date) || date > ctx.today || date < shiftDay(ctx.today, -BACKDATE_DAYS)) {
    return fail('invalid_date')
  }
  return { ok: true, expense: { amount: money(c), category_id: category.id, person, note, expense_date: date } }
}

/** Whether a stored expense is the one this request describes (a repeat of the same key). */
export function sameExpense(
  stored: { amount: number | string; category_id: string; person: string; note: string | null; expense_date: string },
  wanted: NewExpense,
): boolean {
  return (
    cents(stored.amount) === cents(wanted.amount) &&
    stored.category_id === wanted.category_id &&
    stored.person === wanted.person &&
    (stored.note ?? null) === wanted.note &&
    stored.expense_date === wanted.expense_date
  )
}
