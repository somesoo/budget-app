import { roundMoney, shiftMonth, monthKeyOfDate, type MonthKey } from './calculations'

/*
 * Chapters of the household's money: a move, moving in together, a new job.
 * Each starts on a day and runs until the next one starts; whatever was
 * logged before the first is the chapter before it. Once a new chapter
 * starts, the old one is history: each phone chooses whether to still show
 * it, and whether the planner may learn from it (a budget for two shouldn't
 * be planned from what one person spent alone).
 */

export interface Chapter {
  id: string
  name: string
  /** ISO date the chapter starts on. */
  starts_on: string
}

/** A stretch of time a chapter covers; the one before the first has no row of its own. */
export interface ChapterSpan {
  /** The chapter's row; null for the time before the first one. */
  id: string | null
  name: string | null
  /** First day, inclusive; null: from the beginning. */
  from: string | null
  /** Last day, inclusive; null: still running. */
  to: string | null
}

/** Id the chapter before the first one goes by in links. */
export const EARLIER_ID = 'earlier'

const byStart = (chapters: Chapter[]) =>
  [...chapters].sort((a, b) => a.starts_on.localeCompare(b.starts_on))

function dayBefore(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** The chapter `today` is in: the last one that has started. Null before any. */
export function currentChapter(chapters: Chapter[], today: string): Chapter | null {
  return byStart(chapters).filter((c) => c.starts_on <= today).at(-1) ?? null
}

/**
 * Every chapter as a span of days, newest first: each runs to the day before
 * the next one starts, and the time before the first is a span of its own.
 */
export function chapterSpans(chapters: Chapter[]): ChapterSpan[] {
  const sorted = byStart(chapters)
  if (sorted.length === 0) return []
  const spans: ChapterSpan[] = [
    { id: null, name: null, from: null, to: dayBefore(sorted[0].starts_on) },
    ...sorted.map((c, i) => ({
      id: c.id,
      name: c.name,
      from: c.starts_on,
      to: sorted[i + 1] ? dayBefore(sorted[i + 1].starts_on) : null,
    })),
  ]
  return spans.reverse()
}

/**
 * The first day the app looks at: the current chapter's start, unless past
 * chapters are included. Null: no limit.
 */
export function historyFloor(
  chapters: Chapter[],
  today: string,
  includePast: boolean,
): string | null {
  if (includePast) return null
  return currentChapter(chapters, today)?.starts_on ?? null
}

/* ---------- a chapter in numbers ---------- */

export interface ChapterMonth {
  month: MonthKey
  spent: number
  /**
   * Pay and other money in; null: no pay logged that month. A one-off alone
   * (something sold) doesn't make a month with income: that month's pay just
   * wasn't recorded, and counting it would read as a month spent in the red.
   */
  income: number | null
}

export interface ChapterSummary {
  months: ChapterMonth[]
  spent: number
  /** Over the months that have income logged. */
  income: number
  /** Months with pay logged — what saved and the savings rate are measured over. */
  incomeMonths: number
  /** Income less what was spent, over the months with income. */
  saved: number
  /** saved / income, 0–1; null with no income. */
  savingsRate: number | null
  averageSpent: number
  /** Over the months with income. */
  averageIncome: number | null
  biggestMonth: ChapterMonth | null
  expenseCount: number
  /** Per category, biggest first. */
  byCategory: { categoryId: string; total: number; share: number }[]
  /** Per year of the chapter (twelve months from its first), oldest first. */
  years: { label: string; from: MonthKey; to: MonthKey; spent: number; months: number }[]
  /** The biggest single expenses, biggest first. */
  biggest: { id: string; amount: number; date: string; note: string | null; categoryId: string }[]
}

const TOP_EXPENSES = 10

/**
 * What a chapter came to: spent and earned month by month, by category and
 * by year, and what was left. Months run from the first to the last logged;
 * one with nothing logged in between is a gap in the record and left out.
 */
export function summarizeChapter(args: {
  expenses: { id: string; amount: number; expense_date: string; note: string | null; category_id: string }[]
  incomes: { amount: number; income_date: string; for_month?: string | null; one_off?: boolean }[]
}): ChapterSummary {
  const { expenses, incomes } = args
  const spentBy = new Map<MonthKey, number>()
  for (const e of expenses) {
    const m = monthKeyOfDate(e.expense_date)
    spentBy.set(m, (spentBy.get(m) ?? 0) + e.amount)
  }
  const incomeBy = new Map<MonthKey, number>()
  const paid = new Set<MonthKey>()
  for (const i of incomes) {
    const m = i.for_month ?? monthKeyOfDate(i.income_date)
    incomeBy.set(m, (incomeBy.get(m) ?? 0) + i.amount)
    if (!i.one_off) paid.add(m)
  }

  const logged = [...new Set([...spentBy.keys(), ...incomeBy.keys()])].sort()
  const months: ChapterMonth[] = logged.map((month) => ({
    month,
    spent: roundMoney(spentBy.get(month) ?? 0),
    income: paid.has(month) ? roundMoney(incomeBy.get(month)!) : null,
  }))

  const spent = roundMoney(months.reduce((s, m) => s + m.spent, 0))
  const withIncome = months.filter((m) => m.income !== null)
  const income = roundMoney(withIncome.reduce((s, m) => s + m.income!, 0))
  const saved = roundMoney(withIncome.reduce((s, m) => s + m.income! - m.spent, 0))

  const byCat = new Map<string, number>()
  for (const e of expenses) byCat.set(e.category_id, (byCat.get(e.category_id) ?? 0) + e.amount)
  const byCategory = [...byCat.entries()]
    .map(([categoryId, total]) => ({
      categoryId,
      total: roundMoney(total),
      share: spent > 0 ? total / spent : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const years: ChapterSummary['years'] = []
  if (months.length > 0) {
    const first = months[0].month
    const last = months[months.length - 1].month
    for (let from = first; from <= last; from = shiftMonth(from, 12)) {
      const to = shiftMonth(from, 11)
      const inYear = months.filter((m) => m.month >= from && m.month <= to)
      years.push({
        label: `${from.slice(0, 4)}/${to.slice(2, 4)}`,
        from,
        to: to < last ? to : last,
        spent: roundMoney(inYear.reduce((s, m) => s + m.spent, 0)),
        months: inYear.length,
      })
    }
  }

  return {
    months,
    spent,
    income,
    incomeMonths: withIncome.length,
    saved,
    savingsRate: income > 0 ? saved / income : null,
    averageSpent: months.length ? roundMoney(spent / months.length) : 0,
    averageIncome: withIncome.length ? roundMoney(income / withIncome.length) : null,
    biggestMonth: months.reduce<ChapterMonth | null>(
      (top, m) => (top === null || m.spent > top.spent ? m : top),
      null,
    ),
    expenseCount: expenses.length,
    byCategory,
    years,
    biggest: [...expenses]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, TOP_EXPENSES)
      .map((e) => ({
        id: e.id,
        amount: e.amount,
        date: e.expense_date,
        note: e.note,
        categoryId: e.category_id,
      })),
  }
}
