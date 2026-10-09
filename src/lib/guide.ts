/*
 * The guide (Settings → Help → Guide): how to use the app day to day,
 * ordered by when you do things rather than by screen. Each step can take
 * you to its screen and point at the element it's about (the same
 * data-tour attributes the tour uses). The texts are in
 * src/locales/<language>/guide.json; `{name}` placeholders in them are
 * buttons and tabs, filled with the app's own labels so the instructions
 * always match what's on screen.
 */

import type { MessageKey } from '../i18n'
import { featureOfPlace, type FeatureId } from './features'

/** `{name}` in the texts → the label it stands for (planMonth is filled in by the page). */
export const GUIDE_LABELS: Record<string, MessageKey> = {
  add: 'nav.add',
  history: 'nav.history',
  budget: 'nav.budget',
  savings: 'nav.savings',
  insights: 'nav.insights',
  settings: 'nav.settings',
  askAi: 'ask.link',
  addIncome: 'home.addIncome',
  yest: 'date.yesterdayShort',
  goals: 'add.goals',
  saveExpense: 'entry.saveExpense',
  saveIncome: 'entry.saveIncome',
  paysFor: 'entry.paysFor',
  oneOff: 'entry.oneOff',
  paycheck: 'paycheck.title',
  fillTypical: 'planner.fillTypical',
  aiDraft: 'planner.draft',
  categories: 'settings.categories.title',
  newCat: 'settings.categories.new',
  whose: 'categorySheet.whose',
  inChart: 'categorySheet.inChart',
  newAccount: 'account.new',
  balanceToday: 'account.balanceToday',
  newGoal: 'goalSheet.new',
  emergency: 'goalSheet.emergency',
  billsFund: 'goalSheet.billsFund',
  newDebt: 'debts.new',
  owedToday: 'debts.owedToday',
  update: 'debts.updateShort',
  instalment: 'debts.modeInstalment',
  bank: 'debts.modeBalance',
  regular: 'regular.title',
  reviewNow: 'regular.reviewNow',
  aiCard: 'settings.ai.title',
  updateBalance: 'savingsPage.updateBalance',
  assistant: 'assistant.title',
  borrow: 'borrow.title',
  health: 'health.title',
  netWorth: 'netWorth.title',
  fire: 'fire.title',
  debtPlan: 'debts.planTitle',
  help: 'settings.help.title',
  tour: 'settings.help.tour',
}

export type GuideSectionId =
  | 'start'
  | 'daily'
  | 'payday'
  | 'month'
  | 'weekly'
  | 'quarterly'
  | 'numbers'
  | 'tips'

/** Getting-started steps the app can tell are done from what's in the database. */
export type GuideCheck =
  | 'accounts'
  | 'emergency'
  | 'debts'
  | 'regular'
  | 'billsFund'
  | 'income'
  | 'plan'
  | 'ai'

export interface GuideStep {
  /** Its text is guide.<section>.<id>. */
  id: string
  /** The screen "Show me" opens. */
  route?: string
  /** The data-tour element it points at there. */
  target?: string
  check?: GuideCheck
  /** Fine to skip (no debts, no AI). */
  optional?: boolean
}

export interface GuideSection {
  id: GuideSectionId
  steps: GuideStep[]
}

export const GUIDE: GuideSection[] = [
  {
    id: 'start',
    steps: [
      { id: 'categories', route: '/settings', target: 'settings-categories' },
      { id: 'accounts', route: '/savings', target: 'savings-accounts', check: 'accounts' },
      { id: 'emergency', route: '/savings', target: 'savings-goals', check: 'emergency' },
      { id: 'debts', route: '/savings', target: 'savings-debts', check: 'debts', optional: true },
      { id: 'regular', route: '/budget', target: 'regular-costs', check: 'regular' },
      { id: 'billsFund', route: '/savings', target: 'savings-goals', check: 'billsFund' },
      { id: 'income', route: '/', target: 'income', check: 'income' },
      { id: 'plan', route: '/budget', target: 'plan', check: 'plan' },
      { id: 'ai', route: '/settings', target: 'settings-ai', check: 'ai', optional: true },
      { id: 'phones' },
    ],
  },
  {
    id: 'daily',
    steps: [
      { id: 'expense', route: '/', target: 'tiles' },
      { id: 'yesterday' },
      { id: 'goal', route: '/', target: 'tiles' },
      { id: 'fix', route: '/history', target: 'history-tools' },
      { id: 'borrowed' },
    ],
  },
  {
    id: 'payday',
    steps: [
      { id: 'log', route: '/', target: 'income' },
      { id: 'oneOff' },
      { id: 'paycheck', route: '/budget', target: 'paycheck' },
    ],
  },
  {
    id: 'month',
    steps: [
      { id: 'review', route: '/budget', target: 'month-review' },
      { id: 'plan', route: '/budget', target: 'plan' },
      { id: 'zero' },
      { id: 'savings' },
      { id: 'ai' },
    ],
  },
  {
    id: 'weekly',
    steps: [
      { id: 'safe', route: '/', target: 'safe' },
      { id: 'warnings', route: '/budget', target: 'budget-categories' },
      { id: 'debt', route: '/savings', target: 'savings-debts' },
      { id: 'ask', route: '/', target: 'ask' },
    ],
  },
  {
    id: 'quarterly',
    steps: [
      { id: 'subscriptions', route: '/budget', target: 'regular-costs' },
      { id: 'balances', route: '/savings', target: 'savings-accounts' },
      { id: 'debtBank', route: '/savings', target: 'savings-debts' },
      { id: 'bigPicture', route: '/savings', target: 'net-worth' },
    ],
  },
  {
    id: 'numbers',
    steps: [
      { id: 'health', route: '/budget', target: 'health' },
      { id: 'netWorth', route: '/savings', target: 'net-worth' },
      { id: 'debtPlan', route: '/savings', target: 'debt-plan' },
      { id: 'fire', route: '/insights', target: 'fire' },
    ],
  },
  {
    id: 'tips',
    steps: [
      { id: 'allowance', route: '/settings', target: 'settings-categories' },
      { id: 'fixed', route: '/settings', target: 'settings-categories' },
      { id: 'borrow', route: '/savings', target: 'savings-assistant' },
      { id: 'together' },
      { id: 'tour', route: '/settings', target: 'settings-help' },
    ],
  },
]

/** Steps of the getting-started list the app can check, and how many of those are done. */
export function startProgress(
  done: Partial<Record<GuideCheck, boolean>>,
  guide: GuideSection[] = GUIDE,
): {
  done: number
  total: number
} {
  const checked = guide[0].steps.filter((s) => s.check && !s.optional && done[s.check] !== undefined)
  return {
    done: checked.filter((s) => done[s.check!]).length,
    total: checked.length,
  }
}

/** The guide for what this phone shows: steps about hidden features left out, empty sections too. */
export function visibleGuide(shows: (feature: FeatureId) => boolean): GuideSection[] {
  return GUIDE.map((section) => ({
    ...section,
    steps: section.steps.filter((step) => {
      const feature = featureOfPlace(step)
      return !feature || shows(feature)
    }),
  })).filter((section) => section.steps.length > 0)
}
