import { useMemo, useSyncExternalStore } from 'react'
import { ALERT_RANK, alertSubject, budgetAlerts, type BudgetAlert } from '../lib/alerts'
import { currentMonthKey } from '../lib/calculations'
import { useMonthCategories } from './useBudgets'
import { useMonthlyExpenses } from './useExpenses'
import { usePrefs } from './usePrefs'
import { useDeviceUser } from './useDeviceUser'

/*
 * Dismissed warnings live in this browser only: a per-device convenience,
 * like the chosen person. If storage is unavailable (private mode), nothing
 * is remembered and warnings simply come back on reload.
 */
const STORAGE_KEY = 'budget-app.dismissed-alerts'

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

let dismissed = read()
const listeners = new Set<() => void>()

function dismissAlert(alert: BudgetAlert) {
  const month = alert.id.slice(0, 7)
  // only this month's are worth keeping
  dismissed = [...dismissed.filter((id) => id.startsWith(month)), alert.id]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed))
  } catch {
    // remembered for this session only
  }
  for (const l of listeners) l()
}

/** Brings every dismissed warning back (Settings). */
export function resetDismissedAlerts() {
  dismissed = []
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing stored to remove
  }
  for (const l of listeners) l()
}

/** How many warnings this device has dismissed this month. */
export function useDismissedCount() {
  return useSyncExternalStore(
    subscribe,
    () => dismissed.length,
    () => dismissed.length,
  )
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/**
 * Hidden when this warning, or a more serious one about the same thing, was
 * dismissed. A category going from 80% to over its limit warns again.
 */
function isDismissed(alert: BudgetAlert, ids: string[]): boolean {
  const subject = alertSubject(alert)
  return ids.some((id) => {
    if (alertSubject({ id }) !== subject) return false
    const kind = id.slice(id.lastIndexOf(':') + 1) as BudgetAlert['kind']
    return (ALERT_RANK[kind] ?? 0) >= ALERT_RANK[alert.kind]
  })
}

/**
 * The running month's warnings, measured against its plan where it has one.
 * Realtime keeps the expenses fresh, so a purchase on the other phone shows
 * up here too. `all` includes dismissed ones, for flags that state the facts.
 */
export function useBudgetAlerts() {
  const month = currentMonthKey()
  const { data: categories } = useMonthCategories(month)
  const { data: expenses } = useMonthlyExpenses(month)
  const prefs = usePrefs()
  const { person: me } = useDeviceUser()
  const ids = useSyncExternalStore(
    subscribe,
    () => dismissed,
    () => dismissed,
  )

  const all = useMemo(
    () =>
      categories && expenses
        ? budgetAlerts({
            month,
            expenses,
            categories,
            nearRatio: prefs.nearRatio,
            pace: prefs.paceWarnings,
            me,
          })
        : [],
    [month, categories, expenses, prefs.nearRatio, prefs.paceWarnings, me],
  )
  const visible = useMemo(() => all.filter((a) => !isDismissed(a, ids)), [all, ids])

  return { alerts: visible, all, dismiss: dismissAlert }
}
