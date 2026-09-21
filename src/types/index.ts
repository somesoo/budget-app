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
