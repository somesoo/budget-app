/** Stored verbatim in the database — see PERSON_LABELS in config.ts for display names. */
export type Person = 'bubs' | 'meow'

export const PERSONS: Person[] = ['bubs', 'meow']

export interface Category {
  id: string
  name: string
  color: string
  monthly_limit: number
  sort_order: number
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
