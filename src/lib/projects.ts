import type { Category, Expense } from '../types'
import { roundMoney, todayKey } from './calculations'

/*
 * Trips and other projects: categories that don't start over each month.
 * Their spending counts against the project's own budget and stays out of
 * every monthly number (limits, warnings, forecasts, the donut), because
 * it's paid for from savings.
 */

export const isProject = (c: Pick<Category, 'kind'>) => c.kind === 'project'

/** The expenses that belong to the monthly budget: everything not in a project. */
export function monthlyOnly<T extends { category_id: string }>(
  expenses: T[],
  categories: Category[],
): T[] {
  const projectIds = new Set(categories.filter(isProject).map((c) => c.id))
  return projectIds.size === 0 ? expenses : expenses.filter((e) => !projectIds.has(e.category_id))
}

export type ProjectPhase = 'upcoming' | 'running' | 'finished' | 'open'

export interface ProjectSummary {
  project: Category
  spent: number
  /** null without a budget. */
  budget: number | null
  /** Budget minus spent (negative when over); null without a budget. */
  left: number | null
  phase: ProjectPhase
  /** Whole days until it starts (upcoming) or until it ends, today included (running). */
  days: number | null
  /** What's left per remaining day while it runs; null otherwise. */
  perDayLeft: number | null
}

const DAY = 86_400_000
const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY)
}

export function projectSummary(
  project: Category,
  expenses: Expense[],
  today = todayKey(),
): ProjectSummary {
  const spent = roundMoney(
    expenses.filter((e) => e.category_id === project.id).reduce((a, e) => a + e.amount, 0),
  )
  const budget = project.budget_total ?? null
  const left = budget === null ? null : roundMoney(budget - spent)
  const t = dayNumber(today)
  const start = project.starts_on ? dayNumber(project.starts_on) : null
  const end = project.ends_on ? dayNumber(project.ends_on) : null

  let phase: ProjectPhase = 'open'
  let days: number | null = null
  if (start !== null && t < start) {
    phase = 'upcoming'
    days = start - t
  } else if (end !== null && t > end) {
    phase = 'finished'
  } else if (end !== null) {
    phase = 'running'
    days = end - t + 1
  }

  return {
    project,
    spent,
    budget,
    left,
    phase,
    days,
    perDayLeft:
      phase === 'running' && left !== null && days ? roundMoney(Math.max(left, 0) / days) : null,
  }
}
