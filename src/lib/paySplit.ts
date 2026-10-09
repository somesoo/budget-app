import type {
  AccountKind,
  Category,
  Expense,
  Income,
  SavingsAccount,
  SavingsMovement,
  SpendingGroup,
} from '../types'
import { categoryById, incomeMonth, monthKeyOfDate, roundMoney, type MonthKey } from './calculations'

/* Where the month's pay went: spending by general group, what went into
   savings and into investments, and what's left (or short). */

/** In the order they're drawn: the chart palette's validated order follows it. */
export const SPENDING_GROUPS: readonly SpendingGroup[] = ['daily', 'bills', 'debts', 'fun', 'other']

export type PayPart = SpendingGroup | 'savings' | 'investments'
export const PAY_PARTS: readonly PayPart[] = [...SPENDING_GROUPS, 'savings', 'investments']

/** Accounts whose deposits count as investing rather than saving. */
const INVESTMENT_KINDS: readonly AccountKind[] = [
  'investment',
  'retirement',
  'ike',
  'ikze',
  'ppk',
  'bonds',
]

// Polish and English; a guess, so a category's sheet can always say otherwise
const GUESSES: [SpendingGroup, RegExp][] = [
  ['debts', /kredyt|\brat[aey]?\b|pożycz|hipote|leasing|dług|loan|mortgage|instal|debt/i],
  [
    'bills',
    /czynsz|rachun|opłat|prąd|gaz\b|wod[ay]|internet|telefon|abonament|subskryp|ubezpiecz|media\b|rent\b|bill|utilit|insurance|subscri|phone/i,
  ],
  [
    'fun',
    /rozrywk|restaura|knajp|kino|hobby|podróż|wakacj|przyjemn|wyjśc|impre|fun\b|entertain|dining|eating out|going out|travel|holiday/i,
  ],
  [
    'daily',
    /jedzen|spożyw|zakup|transport|paliw|benzyn|dom\b|chemi|kosmet|apte|food|grocer|fuel|petrol|household|pharmac|everyday/i,
  ],
]

/**
 * A category's group: picked in its sheet, or else guessed. Rent and the
 * like (left out of the chart, or with a regular cost booked to them) are
 * bills; names do the rest; what can't be told is "other".
 */
export function groupOf(category: Category, billCategoryIds: ReadonlySet<string>): SpendingGroup {
  if (category.spending_group) return category.spending_group
  return guessGroup(category, billCategoryIds)
}

export function guessGroup(category: Category, billCategoryIds: ReadonlySet<string>): SpendingGroup {
  const byName = GUESSES.find(([, re]) => re.test(category.name))?.[0]
  if (byName === 'debts') return 'debts'
  if (billCategoryIds.has(category.id) || !category.show_in_chart) return 'bills'
  return byName ?? 'other'
}

export interface PaySplitPart {
  id: PayPart
  amount: number
  /** Spending groups: their categories, biggest first. */
  categories: { category: Category; amount: number }[]
}

export interface PaySplit {
  /** Logged for the month, one-offs included: what actually came in. */
  income: number
  /** Only the parts with something in them, in PAY_PARTS order. */
  parts: PaySplitPart[]
  /** Taken out of savings and investments beyond what went in; it paid for some of the month. */
  fromSavings: number
  /** Income minus everything that went somewhere: below zero when it ran short. */
  left: number
  /** Some category's group is a guess. */
  guessed: boolean
}

export function paySplit(args: {
  month: MonthKey
  incomes: Income[]
  /** Monthly spending: trips are paid from savings, not from pay. */
  expenses: Expense[]
  categories: Category[]
  movements: SavingsMovement[]
  accounts: SavingsAccount[]
  /** Categories a regular cost is booked to. */
  billCategoryIds: ReadonlySet<string>
}): PaySplit {
  const { month, incomes, expenses, categories, movements, accounts, billCategoryIds } = args
  const byId = categoryById(categories)

  const income = roundMoney(
    incomes.filter((i) => incomeMonth(i) === month).reduce((s, i) => s + i.amount, 0),
  )

  const groups = new Map<SpendingGroup, Map<string, number>>()
  let guessed = false
  for (const e of expenses) {
    if (monthKeyOfDate(e.expense_date) !== month) continue
    const category = byId[e.category_id]
    if (!category) continue
    if (!category.spending_group) guessed = true
    const group = groupOf(category, billCategoryIds)
    const inGroup = groups.get(group) ?? new Map<string, number>()
    inGroup.set(category.id, (inGroup.get(category.id) ?? 0) + e.amount)
    groups.set(group, inGroup)
  }

  // put in minus taken out, as the month's saving is counted everywhere else
  const kindOf = new Map(accounts.map((a) => [a.id, a.kind]))
  let saved = 0
  let invested = 0
  for (const m of movements) {
    if (m.kind !== 'deposit' && m.kind !== 'withdrawal') continue
    if (monthKeyOfDate(m.movement_date) !== month) continue
    const kind = kindOf.get(m.account_id)
    if (kind && INVESTMENT_KINDS.includes(kind)) invested += m.amount
    else saved += m.amount
  }

  const parts: PaySplitPart[] = []
  for (const id of SPENDING_GROUPS) {
    const inGroup = groups.get(id)
    if (!inGroup) continue
    const rows = [...inGroup]
      .map(([cid, amount]) => ({ category: byId[cid], amount: roundMoney(amount) }))
      .sort((a, b) => b.amount - a.amount)
    const amount = roundMoney(rows.reduce((s, r) => s + r.amount, 0))
    if (amount > 0) parts.push({ id, amount, categories: rows })
  }
  if (saved > 0) parts.push({ id: 'savings', amount: roundMoney(saved), categories: [] })
  if (invested > 0) parts.push({ id: 'investments', amount: roundMoney(invested), categories: [] })

  const fromSavings = roundMoney(Math.max(-saved, 0) + Math.max(-invested, 0))
  const out = parts.reduce((s, p) => s + p.amount, 0)

  return {
    income,
    parts,
    fromSavings,
    left: roundMoney(income + fromSavings - out),
    guessed,
  }
}
