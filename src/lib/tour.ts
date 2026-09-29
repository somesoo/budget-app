/*
 * The guided tour: every screen of the app, one thing at a time. Each step
 * opens its screen and points at one element, found by a CSS selector (a
 * `data-tour` attribute where the element has nothing better to go by). A
 * step whose element isn't on screen (no data yet, a laptop layout) still
 * shows, as a card in the middle.
 */

export interface TourStep {
  id: string
  /** The screen it's about; opened before the step shows. */
  route: string
  /** What to point at; none for a step about the whole screen. */
  target?: string
  title: string
  body: string
  /** A smaller line under the body: where to find more, or a habit worth having. */
  tip?: string
}

const tour = (name: string) => `[data-tour="${name}"]`
const card = (title: string) => `section[aria-label="${title}"]`

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/',
    title: 'Welcome',
    body: 'A budget for you, or for up to four people: what you spend, what you plan, and what you save, shared between your phones in real time. This tour shows every screen in about two minutes.',
    tip: 'Skip it any time. It’s in Settings → Help whenever you want it again.',
  },

  /* ---------- Add ---------- */
  {
    id: 'safe',
    route: '/',
    target: tour('safe'),
    title: 'What you can still spend',
    body: 'This month’s income, minus what the plan puts into savings, minus what’s been spent and the bills still to pay. The colour says how the everyday spending keeps pace with the month: green below it, grey about on it, red ahead of it.',
  },
  {
    id: 'tiles',
    route: '/',
    target: tour('tiles'),
    title: 'Log an expense in two taps',
    body: 'Tap a category, type the amount, save. Each tile shows what’s left of its limit and turns red once it’s over. Swipe for more categories.',
    tip: 'The Goals tile at the end is for spending saved-up money, like a holiday: it comes out of the goal, not the month.',
  },
  {
    id: 'widgets',
    route: '/',
    target: tour('widgets'),
    title: 'The month at a glance',
    body: 'Swipe through where the money went, the pace against the plan, warnings, the forecast, who spent what and your goals.',
    tip: 'Pick which ones show in Settings → Widgets on Add.',
  },
  {
    id: 'income',
    route: '/',
    target: tour('income'),
    title: 'Log income',
    body: 'Each paycheck goes here, for the month it pays for (a salary on the 28th can count for next month). Mark one-off money, like a bonus or a refund, so it doesn’t skew the usual pay.',
    tip: 'Right after a paycheck, the app shows what the plan sends to your goals and IKE, so it’s put aside before it gets spent.',
  },
  {
    id: 'ask',
    route: '/',
    target: tour('ask'),
    title: 'Ask about your money',
    body: 'A chat that knows your budget, spending and savings: “can we afford a new sofa?”, “where did we overspend?”. Most screens have this button, with a question about that screen ready to send.',
  },

  /* ---------- History ---------- */
  {
    id: 'nav-history',
    route: '/history',
    target: tour('nav-history'),
    title: 'History',
    body: 'Everything anyone logged, day by day, with the month’s totals.',
  },
  {
    id: 'history-search',
    route: '/history',
    target: tour('history-tools'),
    title: 'Find, filter, fix',
    body: 'Search every month by title, category or amount. Filter by who, what or kind and sort by size; the calendar shows which days cost the most. Tap any entry to change or delete it.',
  },

  /* ---------- Budget ---------- */
  {
    id: 'nav-budget',
    route: '/budget',
    target: tour('budget-month'),
    title: 'The month against the plan',
    body: 'Spent so far out of what was planned, what’s left per day, income and what’s left over. Use the month switcher at the top to look back or plan ahead.',
  },
  {
    id: 'plan',
    route: '/budget',
    target: tour('plan'),
    title: 'Plan a month',
    body: 'Set the expected income, what goes to savings, and a limit for each category, suggested from your history (with an AI draft if you like). Send part of each paycheck straight to goals and IKE, and choose which goals get whatever’s left at the month’s end.',
    tip: 'Plan next month in the last days of this one: it’s ready when the paycheck lands.',
  },
  {
    id: 'health',
    route: '/budget',
    target: tour('health'),
    title: 'How healthy it is',
    body: 'Three numbers worth watching: how much of the income you save, how much goes on rent and bills, and how many months the emergency fund would last.',
  },
  {
    id: 'budget-categories',
    route: '/budget',
    target: tour('budget-categories'),
    title: 'Every category',
    body: 'Each one against its limit, with warnings when it’s close or heading over. Tap one for its history, a forecast and how it compares with the rest.',
  },

  /* ---------- Savings ---------- */
  {
    id: 'nav-savings',
    route: '/savings',
    target: tour('savings-totals'),
    title: 'Savings',
    body: 'All you’ve saved, what went aside this month against the plan, and money no goal is waiting for yet.',
  },
  {
    id: 'savings-assistant',
    route: '/savings',
    target: tour('savings-assistant'),
    title: 'Not sure how? Ask it',
    body: 'Save more, borrow from your savings and pay it back in instalments, move money between accounts, set a balance straight or close an account: each one walks you through what to do in the bank, too.',
  },
  {
    id: 'savings-goals',
    route: '/savings',
    target: tour('savings-goals'),
    title: 'Goals and accounts',
    body: 'A goal is what the money is for (a holiday, an emergency fund, a new car), with a target and a date; an account is where it sits (savings, deposit, cash, IKE, IKZE). IKE and IKZE show the year’s limit and your gain.',
    tip: 'Mark one goal as the emergency fund: leftover money fills it first while it’s short.',
  },

  /* ---------- Insights ---------- */
  {
    id: 'nav-insights',
    route: '/insights',
    target: tour('insights-advice'),
    title: 'Insights',
    body: 'Advice for the month, then charts: the pace against the plan, month by month, which categories changed, who spent what, and which weekdays cost the most.',
  },

  /* ---------- Settings ---------- */
  {
    id: 'settings-device',
    route: '/settings',
    target: card('People'),
    title: 'People and this phone',
    body: 'Each phone belongs to one person: it’s who new expenses are logged for. Change it here if you swap phones, and rename or add people above it.',
  },
  {
    id: 'settings-categories',
    route: '/settings',
    target: card('Categories'),
    title: 'Categories and allowances',
    body: 'Add, rename, recolour and reorder categories and set their usual limit. Make one a person’s allowance: only their phone shows what’s in it; everyone else just hears if it goes over.',
  },
  {
    id: 'settings-more',
    route: '/settings',
    target: card('Warnings'),
    title: 'Make it yours',
    body: 'Quick amounts on the keypad, which widgets show, when warnings start, and your data as a spreadsheet: all here.',
  },
  {
    id: 'done',
    route: '/',
    title: 'That’s it',
    body: 'Start by logging today’s expenses, then plan the month on the Budget tab. The tour is always in Settings → Help.',
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
