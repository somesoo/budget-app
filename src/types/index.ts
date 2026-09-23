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
  target_amount: number
  current_amount: number
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
}

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
  /** What the month means to put aside. */
  savings: number
  /** Category id → limit for this month. A missing id falls back to the category's default. */
  limits: Record<string, number>
  /** What's unusual about the month, in your own words. */
  note: string | null
  updated_at: string
}

/** A drafted plan as returned by /api/plan (Gemini, schema-constrained). */
export interface PlanSuggestion {
  summary: string
  savings: number | null
  categories: { id: string; amount: number; reason: string }[]
  tips: string[]
  model: string
}
