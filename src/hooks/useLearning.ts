import { useBudget } from './useBudgets'
import { useMonthlyExpensesBetween } from './useExpenses'
import { useIncomesBetween } from './useIncomes'
import { setPrefs, usePrefs } from './usePrefs'
import { useSavingsOverview } from './useSavings'
import { currentMonthKey, monthKeyOfDate, monthRange, shiftMonth, todayKey } from '../lib/calculations'
import { readyForNext, type Progress, type Stage } from '../lib/features'

/** Months looked back over for the habits: enough for "two complete months". */
const LOOK_BACK = 4
/** How long "Not yet" puts the next stage off. */
export const SNOOZE_DAYS = 14

/** What this phone's household has done so far, for when to suggest the next stage. */
export function useLearningProgress(): Progress | null {
  const month = currentMonthKey()
  const from = monthRange(shiftMonth(month, -(LOOK_BACK - 1))).from
  const { to } = monthRange(month)
  const { data: expenses } = useMonthlyExpensesBetween(from, to)
  const { data: incomes } = useIncomesBetween(monthRange(shiftMonth(month, -1)).from, to)
  const plan = useBudget(month)
  const savings = useSavingsOverview()
  if (!expenses || !incomes || plan.isLoading) return null

  const first = expenses.reduce<string | null>(
    (min, e) => (min === null || e.expense_date < min ? e.expense_date : min),
    null,
  )
  const days = first
    ? Math.floor((Date.parse(todayKey()) - Date.parse(first)) / 86_400_000) + 1
    : 0
  const complete = new Set(
    expenses.map((e) => monthKeyOfDate(e.expense_date)).filter((m) => m < month),
  )
  return {
    daysLogging: days,
    expenses: expenses.length,
    hasIncome: incomes.length > 0,
    hasPlan: !!plan.data,
    hasSavings: savings.accounts.length > 0,
    monthsLogged: complete.size,
  }
}

/** The stage worth suggesting now, or null: not ready, put off, or at the last one. */
export function useNextStage(): Stage | null {
  const prefs = usePrefs()
  const progress = useLearningProgress()
  if (prefs.stage >= 4 || !progress) return null
  if (prefs.nextStageSnoozedUntil && prefs.nextStageSnoozedUntil > todayKey()) return null
  return readyForNext(prefs.stage, progress) ? ((prefs.stage + 1) as Stage) : null
}

export function goToStage(stage: Stage) {
  // a new stage starts clean: what it shows, not switches from before
  setPrefs({ stage, featureOverrides: {}, nextStageSnoozedUntil: null })
}

export function snoozeNextStage() {
  const until = new Date(Date.parse(todayKey()) + SNOOZE_DAYS * 86_400_000)
  setPrefs({ nextStageSnoozedUntil: until.toISOString().slice(0, 10) })
}
