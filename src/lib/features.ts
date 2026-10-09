/*
 * How much of the app this phone shows. The app does a lot, and all of it at
 * once is a wall; so it opens in stages, each one a habit that makes sense
 * once the one before it does:
 *
 *   1. Track:  log what you spend and earn, see where it goes
 *   2. Plan:   a plan for the month, limits, where the month is heading
 *   3. Save:   pay yourself first, goals, an emergency fund
 *   4. All:    debts, regular bills, deeper charts, AI, independence
 *
 * Each feature belongs to a stage, and any of them can be switched on or off
 * in Settings regardless. It's this phone's choice (usePrefs), so each person
 * learns at their own pace; nothing is deleted, only not shown.
 */

export type Stage = 1 | 2 | 3 | 4
export const STAGES: readonly Stage[] = [1, 2, 3, 4]

export type FeatureId =
  /** Budget tab: the month's plan, limits, warnings, what's left a day. */
  | 'budget'
  /** Insights tab: the forecast, where the money and the pay went. */
  | 'insights'
  /** Savings tab: accounts and goals, the Goals tile, saving more. */
  | 'savings'
  /** From the paycheck: the plan's savings paid in line by line. */
  | 'paycheck'
  /** The health card: savings rate, fixed costs, emergency fund, age of money. */
  | 'health'
  /** Subscriptions and bills that come back, and their review. */
  | 'regular'
  /** Debts, the way out of them, net worth. */
  | 'debts'
  /** Month by month, change by category, pace, who spent what, weekdays. */
  | 'charts'
  /** Financial independence. */
  | 'fire'
  /** Ask, AI recommendations, AI plan drafts. */
  | 'ai'

/** In the order Settings lists them. */
export const FEATURES: readonly { id: FeatureId; stage: Stage }[] = [
  { id: 'budget', stage: 2 },
  { id: 'insights', stage: 2 },
  { id: 'savings', stage: 3 },
  { id: 'paycheck', stage: 3 },
  { id: 'health', stage: 3 },
  { id: 'regular', stage: 4 },
  { id: 'debts', stage: 4 },
  { id: 'charts', stage: 4 },
  { id: 'fire', stage: 4 },
  { id: 'ai', stage: 4 },
]

const STAGE_OF = Object.fromEntries(FEATURES.map((f) => [f.id, f.stage])) as Record<
  FeatureId,
  Stage
>

export interface FeatureChoice {
  stage: Stage
  /** Switched on or off by hand, whatever the stage says. */
  overrides: Partial<Record<FeatureId, boolean>>
}

export function isOn(choice: FeatureChoice, feature: FeatureId): boolean {
  return choice.overrides[feature] ?? choice.stage >= STAGE_OF[feature]
}

/** What a stage adds, for its card in Settings and its lesson. */
export function featuresOf(stage: Stage): FeatureId[] {
  return FEATURES.filter((f) => f.stage === stage).map((f) => f.id)
}

/**
 * The feature a place in the app belongs to: a guide or tour step, by what it
 * points at and which screen it opens. Null: always there (adding, history,
 * settings).
 */
export function featureOfPlace(place: {
  id?: string
  route?: string
  target?: string
}): FeatureId | null {
  const target = place.target?.replace(/^\[data-tour="(.*)"\]$/, '$1') ?? place.id ?? ''
  const byTarget: Record<string, FeatureId> = {
    'regular-costs': 'regular',
    'savings-debts': 'debts',
    'debt-plan': 'debts',
    'net-worth': 'debts',
    health: 'health',
    fire: 'fire',
    ask: 'ai',
    'settings-ai': 'ai',
    paycheck: 'paycheck',
  }
  if (byTarget[target]) return byTarget[target]
  if (place.id === 'ai') return 'ai'
  const byRoute: Record<string, FeatureId> = {
    '/budget': 'budget',
    '/savings': 'savings',
    '/insights': 'insights',
    '/ask': 'ai',
  }
  return place.route ? (byRoute[place.route] ?? null) : null
}

/* ---------- when to suggest the next stage ---------- */

export interface Progress {
  /** Days since the first expense was logged. */
  daysLogging: number
  expenses: number
  /** A paycheck logged this month or the last. */
  hasIncome: boolean
  /** The running month has a plan. */
  hasPlan: boolean
  /** Any savings account. */
  hasSavings: boolean
  /** Complete months with expenses in them. */
  monthsLogged: number
}

/**
 * Whether the habit of the current stage has taken, so the next one is worth
 * suggesting. Two weeks of logging before planning (a plan needs to know what
 * a month costs), a plan before saving from it, a month or two of both before
 * the rest.
 */
export function readyForNext(stage: Stage, p: Progress): boolean {
  switch (stage) {
    case 1:
      return p.daysLogging >= 14 && p.expenses >= 20
    case 2:
      return p.hasPlan && p.hasIncome
    case 3:
      return p.hasSavings && p.monthsLogged >= 2
    case 4:
      return false
  }
}
