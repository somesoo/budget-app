/** Stored verbatim in the database — see PERSON_LABELS in config.ts for display names. */
export type Person = 'bubs' | 'meow'

export const PERSONS: Person[] = ['bubs', 'meow']

export interface Category {
  id: string
  name: string
  color: string
  /** The default limit — a month with its own plan (BudgetPlan.limits) overrides it. */
  monthly_limit: number
  sort_order: number
  /** Hidden from adding and planning; old expenses still show its name. */
  archived: boolean
  /** In the Home donut. Off for fixed costs like rent, which would swamp it. */
  show_in_chart: boolean
  /**
   * 'monthly' starts over every month and counts toward the month's budget.
   * 'project' (a trip) runs across months against budget_total and stays out
   * of the monthly numbers; it's paid for from savings.
   */
  kind: 'monthly' | 'project'
  /** A project's budget for the whole of it; null when it has none. */
  budget_total: number | null
  /** A project's dates, ISO YYYY-MM-DD; either may be open. */
  starts_on: string | null
  ends_on: string | null
  /** The savings goal a project is paid from. */
  goal_id: string | null
}

export interface Expense {
  id: string
  amount: number
  category_id: string
  person: Person
  note: string | null
  /** ISO date, YYYY-MM-DD, in local time — never shifted by timezone. */
  expense_date: string
  created_at: string
}

export interface Goal {
  id: string
  name: string
  /** 0 means open-ended, like an emergency fund that just grows. */
  target_amount: number
  /** Before savings accounts (migration 0007): what was saved. After: unused, see allocations. */
  current_amount: number
  target_date: string | null
  color: string
  sort_order: number
  archived: boolean
  note: string | null
}

export type AccountKind =
  | 'savings'
  | 'deposit'
  | 'investment'
  | 'retirement'
  /** Polish tax-free retirement accounts with a yearly contribution limit (migration 0010). */
  | 'ike'
  | 'ikze'
  | 'cash'
  | 'other'

/** Where savings are: a bank account, a deposit, cash. Its balance is the sum of its movements. */
export interface SavingsAccount {
  id: string
  name: string
  kind: AccountKind
  owner: Person | 'joint'
  /** Yearly, in percent; null when it earns nothing. */
  interest_rate: number | null
  color: string
  sort_order: number
  archived: boolean
  note: string | null
  created_at: string
}

export type MovementKind = 'deposit' | 'withdrawal' | 'interest' | 'adjustment' | 'transfer'

export interface SavingsMovement {
  id: string
  account_id: string
  kind: MovementKind
  /** Signed: money in is positive, money out negative. */
  amount: number
  /** ISO YYYY-MM-DD, local time. */
  movement_date: string
  person: Person | null
  note: string | null
  goal_id: string | null
  /** Shared by the two halves of a transfer between accounts. */
  transfer_id: string | null
  created_at: string
}

/** The part of an account's balance set aside for a goal. */
export interface Allocation {
  account_id: string
  goal_id: string
  amount: number
}

export type NewExpense = Omit<Expense, 'id' | 'created_at'>

export interface Income {
  id: string
  amount: number
  person: Person
  note: string | null
  /** ISO date, YYYY-MM-DD, local time. */
  income_date: string
  created_at: string
}

export type NewIncome = Omit<Income, 'id' | 'created_at'>

/** One recommendation as returned by /api/advice (Gemini, schema-constrained). */
export interface Recommendation {
  title: string
  detail: string
  /** Rough monthly effect in złoty, if the model could ground one in the data. */
  monthlyImpact: number | null
  /** What it's about; absent in advice stored before it was asked for. */
  area?: AdviceArea
}

export type AdviceArea = 'spending' | 'savings' | 'goals' | 'income' | 'other'

export interface Advice {
  id: string
  month: string
  content: { summary: string; recommendations: Recommendation[]; model: string }
  created_at: string
}

/** One month's plan. Months differ, so each can set its own numbers. */
export interface BudgetPlan {
  month: string
  /** Income the plan counts on. */
  income: number
  /** What the month means to put aside, in total (allocations included). */
  savings: number
  /** Category id → limit for this month. A missing id falls back to the category's default. */
  limits: Record<string, number>
  /** Where the savings go: goals and IKE/IKZE. What they don't cover is "other savings". */
  allocations: PlanAllocation[]
  /** The goal the previous month's unspent money goes to; null leaves it on the account. */
  carryover: PlanCarryover | null
  /** What's unusual about the month, in your own words. */
  note: string | null
  updated_at: string
}

/** Where the month before's unspent money goes. */
export interface PlanCarryover {
  goal_id: string
  /** Where the goal's money is kept; null when there's no account yet. */
  account_id: string | null
}

/**
 * Part of a month's savings with a destination. With a goal it's money for
 * that goal, kept on `account_id`; without one it's money onto the account
 * itself (a monthly IKE payment). `account_id` is null only for a goal when
 * there's no account to put it on yet.
 */
export interface PlanAllocation {
  account_id: string | null
  goal_id: string | null
  amount: number
}

/** A drafted plan as returned by /api/plan (Gemini, schema-constrained). */
export interface PlanSuggestion {
  summary: string
  savings: number | null
  categories: { id: string; amount: number; reason: string }[]
  tips: string[]
  model: string
}

/** A conversation in the Ask tab, shared by both phones. */
export interface ChatThread {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  thread_id: string
  role: 'user' | 'assistant'
  content: string
  /** Who asked; null for the assistant. */
  person: Person | null
  created_at: string
}
