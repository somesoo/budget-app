import { useSyncExternalStore } from 'react'
import { QUICK_AMOUNTS } from '../config'
import { NEAR_RATIO } from '../lib/alerts'

/*
 * Preferences of this device, like the chosen person: kept in the browser,
 * not the database, so each phone can have its own. If storage is
 * unavailable (private mode), the defaults apply and changes last the session.
 */

export interface Prefs {
  /** The four one-tap amounts on the Add screen. */
  quickAmounts: number[]
  /** Share of a limit at which a category warns it's close. */
  nearRatio: number
  /** Warn when the pace would take a category over by the month's end. */
  paceWarnings: boolean
}

export const DEFAULT_PREFS: Prefs = {
  quickAmounts: QUICK_AMOUNTS,
  nearRatio: NEAR_RATIO,
  paceWarnings: true,
}

const STORAGE_KEY = 'budget-app.prefs'

function read(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const p = JSON.parse(raw) as Partial<Prefs>
    const amounts =
      Array.isArray(p.quickAmounts) &&
      p.quickAmounts.length === 4 &&
      p.quickAmounts.every((n) => typeof n === 'number' && n > 0)
        ? p.quickAmounts
        : DEFAULT_PREFS.quickAmounts
    return {
      quickAmounts: amounts,
      nearRatio:
        typeof p.nearRatio === 'number' && p.nearRatio > 0 && p.nearRatio < 1
          ? p.nearRatio
          : DEFAULT_PREFS.nearRatio,
      paceWarnings:
        typeof p.paceWarnings === 'boolean' ? p.paceWarnings : DEFAULT_PREFS.paceWarnings,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

let prefs = read()
const listeners = new Set<() => void>()

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // remembered for this session only
  }
  for (const l of listeners) l()
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => prefs,
    () => prefs,
  )
}
