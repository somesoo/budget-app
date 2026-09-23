import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { parseAmountQuery, sanitizeSearch } from '../lib/history'
import type { Income, NewIncome } from '../types'

const COLUMNS = 'id, amount, person, note, income_date, created_at'

/** Whether a row dated `date` belongs in the cached list under `key` (a from/to window, or always). */
function keyCoversDate(key: QueryKey, date: string): boolean {
  const [, from, to] = key
  if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return date >= from && date <= String(to)
  }
  return true
}

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
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ['incomes'] })
      const snapshots = qc.getQueriesData<Income[]>({ queryKey: ['incomes'] })
      for (const [key, list] of snapshots) {
        if (!list) continue
        qc.setQueryData<Income[]>(
          key,
          list.flatMap((i) => {
            if (i.id !== id) return [i]
            const next = { ...i, ...patch }
            return keyCoversDate(key, next.income_date) ? [next] : []
          }),
        )
      }
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, list] of ctx?.snapshots ?? []) qc.setQueryData(key, list)
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
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['incomes'] })
      const snapshots = qc.getQueriesData<Income[]>({ queryKey: ['incomes'] })
      for (const [key, list] of snapshots) {
        if (list) qc.setQueryData<Income[]>(key, list.filter((i) => i.id !== id))
      }
      return { snapshots }
    },
    onError: (_err, _id, ctx) => {
      for (const [key, list] of ctx?.snapshots ?? []) qc.setQueryData(key, list)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['incomes'] })
    },
  })
}

/** Puts a just-deleted paycheck back, same id and timestamps — the "Undo" after a delete. */
export function useRestoreIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (income: Income) => {
      const { error } = await supabase.from('incomes').insert(income)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['incomes'] })
    },
  })
}

/** Income from any month by note, or by exact amount when the query is a number. */
export function useSearchIncomes(query: string) {
  const q = sanitizeSearch(query)
  const amount = parseAmountQuery(query)
  return useQuery({
    queryKey: ['incomes', 'search', q],
    enabled: q.length >= 2 || amount !== null,
    queryFn: async (): Promise<Income[]> => {
      const clauses = [`note.ilike."%${q}%"`]
      if (amount !== null) clauses.push(`amount.eq.${amount}`)
      const { data, error } = await supabase
        .from('incomes')
        .select(COLUMNS)
        .or(clauses.join(','))
        .order('income_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []).map(normalize)
    },
    placeholderData: (previous) => previous,
  })
}
