import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Income, NewIncome } from '../types'

const COLUMNS = 'id, amount, person, note, income_date, created_at'

function normalize(row: Record<string, unknown>): Income {
  return {
    id: String(row.id),
    amount: Number(row.amount),
    person: row.person as Income['person'],
    note: (row.note as string | null) ?? null,
    income_date: String(row.income_date),
    created_at: String(row.created_at),
  }
}

/** Income between two dates, inclusive — a handful of rows a month, so no paging. */
export function useIncomesBetween(from: string, to: string) {
  return useQuery({
    queryKey: ['incomes', from, to],
    queryFn: async (): Promise<Income[]> => {
      const { data, error } = await supabase
        .from('incomes')
        .select(COLUMNS)
        .gte('income_date', from)
        .lte('income_date', to)
        .order('income_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map(normalize)
    },
    placeholderData: (previous) => previous,
  })
}

/** The most recent paycheck per person — lets "same as last time" be one tap. */
export function useLastIncomes() {
  return useQuery({
    queryKey: ['incomes', 'last'],
    queryFn: async (): Promise<Income[]> => {
      const { data, error } = await supabase
        .from('incomes')
        .select(COLUMNS)
        .order('income_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []).map(normalize)
    },
  })
}

export function useAddIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (income: NewIncome) => {
      const { error } = await supabase.from('incomes').insert(income)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['incomes'] })
    },
  })
}

export function useUpdateIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Pick<Income, 'id'> & Partial<NewIncome>) => {
      const { error } = await supabase.from('incomes').update(patch).eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['incomes'] })
    },
  })
}

export function useDeleteIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('incomes').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['incomes'] })
    },
  })
}
