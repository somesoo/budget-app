import { useSyncExternalStore } from 'react'
import { QUICK_AMOUNTS } from '../config'
import { NEAR_RATIO } from '../lib/alerts'
import { STAGES, isOn, type FeatureChoice, type FeatureId, type Stage } from '../lib/features'

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
  /** Widgets switched off above the Add tiles (ids from ADD_WIDGETS). */
  hiddenWidgets: string[]
  /** How much of the app this phone shows (lib/features). */
  stage: Stage
  /** Features switched on or off by hand, whatever the stage. */
  featureOverrides: FeatureChoice['overrides']
  /** Until when the next stage isn't suggested again (ISO date); null: not put off. */
  nextStageSnoozedUntil: string | null
  /** Show what was logged in chapters before the current one (lib/chapters). */
  showPastChapters: boolean
  /** Let the planner and the typical month learn from past chapters. */
  pastChaptersInPlanner: boolean
}

export const DEFAULT_PREFS: Prefs = {
  quickAmounts: QUICK_AMOUNTS,
  nearRatio: NEAR_RATIO,
  paceWarnings: true,
  hiddenWidgets: [],
  // a phone that already uses the app keeps all of it; a new one starts at 1 (see read)
  stage: 4,
  featureOverrides: {},
  nextStageSnoozedUntil: null,
  showPastChapters: true,
  // a past chapter is usually a different household: plan from this one
  pastChaptersInPlanner: false,
}

const STORAGE_KEY = 'budget-app.prefs'

function read(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // a phone that's never saved a preference is new to the app: start simple
    if (!raw) return { ...DEFAULT_PREFS, stage: 1 }
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
      hiddenWidgets:
        Array.isArray(p.hiddenWidgets) && p.hiddenWidgets.every((w) => typeof w === 'string')
          ? p.hiddenWidgets
          : DEFAULT_PREFS.hiddenWidgets,
      stage: STAGES.includes(p.stage as Stage) ? (p.stage as Stage) : DEFAULT_PREFS.stage,
      featureOverrides:
        p.featureOverrides && typeof p.featureOverrides === 'object'
          ? Object.fromEntries(
              Object.entries(p.featureOverrides).filter(([, v]) => typeof v === 'boolean'),
            )
          : {},
      nextStageSnoozedUntil:
        typeof p.nextStageSnoozedUntil === 'string' ? p.nextStageSnoozedUntil : null,
      showPastChapters:
        typeof p.showPastChapters === 'boolean' ? p.showPastChapters : DEFAULT_PREFS.showPastChapters,
      pastChaptersInPlanner:
        typeof p.pastChaptersInPlanner === 'boolean'
          ? p.pastChaptersInPlanner
          : DEFAULT_PREFS.pastChaptersInPlanner,
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

/** Whether this phone shows a feature (see lib/features). */
export function useFeature(feature: FeatureId): boolean {
  const p = usePrefs()
  return isOn({ stage: p.stage, overrides: p.featureOverrides }, feature)
}

/** The same, for code that checks several. */
export function useFeatures(): (feature: FeatureId) => boolean {
  const p = usePrefs()
  return (feature) => isOn({ stage: p.stage, overrides: p.featureOverrides }, feature)
}
