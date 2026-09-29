/*
 * The guided tour: every screen of the app, one thing at a time. Each step
 * opens its screen and points at one element, found by a CSS selector (a
 * `data-tour` attribute where the element has nothing better to go by). A
 * step whose element isn't on screen (no data yet, a laptop layout) still
 * shows, as a card in the middle.
 */

import type { MessageKey } from '../i18n'

export interface TourStep {
  id: string
  /** The screen it's about; opened before the step shows. */
  route: string
  /** What to point at; none for a step about the whole screen. */
  target?: string
  /** Translation keys (src/locales/<language>/tour.json), looked up as the step shows. */
  title: MessageKey
  body: MessageKey
  /** A smaller line under the body: where to find more, or a habit worth having. */
  tip?: MessageKey
}

const tour = (name: string) => `[data-tour="${name}"]`

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/',
    title: 'tour.welcome.title',
    body: 'tour.welcome.body',
    tip: 'tour.welcome.tip',
  },

  /* ---------- Add ---------- */
  {
    id: 'safe',
    route: '/',
    target: tour('safe'),
    title: 'tour.safe.title',
    body: 'tour.safe.body',
  },
  {
    id: 'tiles',
    route: '/',
    target: tour('tiles'),
    title: 'tour.tiles.title',
    body: 'tour.tiles.body',
    tip: 'tour.tiles.tip',
  },
  {
    id: 'widgets',
    route: '/',
    target: tour('widgets'),
    title: 'tour.widgets.title',
    body: 'tour.widgets.body',
    tip: 'tour.widgets.tip',
  },
  {
    id: 'income',
    route: '/',
    target: tour('income'),
    title: 'tour.income.title',
    body: 'tour.income.body',
    tip: 'tour.income.tip',
  },
  {
    id: 'ask',
    route: '/',
    target: tour('ask'),
    title: 'tour.ask.title',
    body: 'tour.ask.body',
  },

  /* ---------- History ---------- */
  {
    id: 'nav-history',
    route: '/history',
    target: tour('nav-history'),
    title: 'tour.nav-history.title',
    body: 'tour.nav-history.body',
  },
  {
    id: 'history-search',
    route: '/history',
    target: tour('history-tools'),
    title: 'tour.history-search.title',
    body: 'tour.history-search.body',
  },

  /* ---------- Budget ---------- */
  {
    id: 'nav-budget',
    route: '/budget',
    target: tour('budget-month'),
    title: 'tour.nav-budget.title',
    body: 'tour.nav-budget.body',
  },
  {
    id: 'plan',
    route: '/budget',
    target: tour('plan'),
    title: 'tour.plan.title',
    body: 'tour.plan.body',
    tip: 'tour.plan.tip',
  },
  {
    id: 'health',
    route: '/budget',
    target: tour('health'),
    title: 'tour.health.title',
    body: 'tour.health.body',
  },
  {
    id: 'budget-categories',
    route: '/budget',
    target: tour('budget-categories'),
    title: 'tour.budget-categories.title',
    body: 'tour.budget-categories.body',
  },

  /* ---------- Savings ---------- */
  {
    id: 'nav-savings',
    route: '/savings',
    target: tour('savings-totals'),
    title: 'tour.nav-savings.title',
    body: 'tour.nav-savings.body',
  },
  {
    id: 'savings-assistant',
    route: '/savings',
    target: tour('savings-assistant'),
    title: 'tour.savings-assistant.title',
    body: 'tour.savings-assistant.body',
  },
  {
    id: 'savings-goals',
    route: '/savings',
    target: tour('savings-goals'),
    title: 'tour.savings-goals.title',
    body: 'tour.savings-goals.body',
    tip: 'tour.savings-goals.tip',
  },

  /* ---------- Insights ---------- */
  {
    id: 'nav-insights',
    route: '/insights',
    target: tour('insights-advice'),
    title: 'tour.nav-insights.title',
    body: 'tour.nav-insights.body',
  },

  /* ---------- Settings ---------- */
  {
    id: 'settings-device',
    route: '/settings',
    target: tour('settings-people'),
    title: 'tour.settings-device.title',
    body: 'tour.settings-device.body',
  },
  {
    id: 'settings-categories',
    route: '/settings',
    target: tour('settings-categories'),
    title: 'tour.settings-categories.title',
    body: 'tour.settings-categories.body',
  },
  {
    id: 'settings-more',
    route: '/settings',
    target: tour('settings-warnings'),
    title: 'tour.settings-more.title',
    body: 'tour.settings-more.body',
  },
  {
    id: 'done',
    route: '/',
    title: 'tour.done.title',
    body: 'tour.done.body',
  },
]

/* ---------- has this device seen it ---------- */

const SEEN_KEY = 'budget-app.tour-seen'

/** Seen (finished or skipped) on this device; storage unavailable counts as seen, so it never nags. */
export function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // nothing to remember it in
  }
}

/* ---------- running it ---------- */

export interface TourState {
  /** The step on screen; null when the tour isn't running. */
  step: number | null
  /** Where it was started from, to go back there at the end. */
  from: string
}

let state: TourState = { step: null, from: '/' }
const listeners = new Set<() => void>()

const set = (next: TourState) => {
  state = next
  for (const l of listeners) l()
}

export const tourStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  start: (from = '/') => set({ step: 0, from }),
  go: (step: number) => set({ ...state, step: Math.max(0, Math.min(step, TOUR_STEPS.length - 1)) }),
  /** Finished or skipped: remembered, so it doesn't start by itself again. */
  end: () => {
    markTourSeen()
    set({ ...state, step: null })
  },
}
