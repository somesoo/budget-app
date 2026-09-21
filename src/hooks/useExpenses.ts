import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { monthKeyOfDate, monthRange, type MonthKey } from '../lib/calculations'
import type { Expense, NewExpense } from '../types'

export const expensesKey = (month: MonthKey) => ['expenses', month] as const

function normalize(row: Record<string, unknown>): Expense {
  return {
    id: String(row.id),
    amount: Number(row.amount),
    category_id: String(row.category_id),
    person: row.person as Expense['person'],
    note: (row.note as string | null) ?? null,
    expense_date: String(row.expense_date),
    created_at: String(row.created_at),
  }
}

export function useExpenses(month: MonthKey) {
  return useQuery({
    queryKey: expensesKey(month),
    queryFn: async (): Promise<Expense[]> => {
      const { from, to } = monthRange(month)
      const { data, error } = await supabase
        .from('expenses')
        .select('id, amount, category_id, person, note, expense_date, created_at')
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map(normalize)
    },
  })
}

export function useAddExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (expense: NewExpense): Promise<Expense> => {
      const { data, error } = await supabase
        .from('expenses')
        .insert(expense)
        .select('id, amount, category_id, person, note, expense_date, created_at')
        .single()
      if (error) throw error
      return normalize(data)
    },
    onMutate: async (expense) => {
      const key = expensesKey(monthKeyOfDate(expense.expense_date))
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Expense[]>(key)
      const optimistic: Expense = {
        ...expense,
        id: `optimistic-${crypto.randomUUID()}`,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<Expense[]>(key, (old) => [optimistic, ...(old ?? [])])
      return { key, previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous)
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: expensesKey(monthKeyOfDate(vars.expense_date)) })
    },
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Pick<Expense, 'id'> & Partial<NewExpense>) => {
      const { error } = await supabase.from('expenses').update(patch).eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['expenses'] })
      const snapshots = qc.getQueriesData<Expense[]>({ queryKey: ['expenses'] })
      for (const [key, list] of snapshots) {
        qc.setQueryData<Expense[]>(key, (list ?? []).filter((e) => e.id !== id))
      }
      return { snapshots }
    },
    onError: (_err, _id, ctx) => {
      for (const [key, list] of ctx?.snapshots ?? []) qc.setQueryData(key, list)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}
