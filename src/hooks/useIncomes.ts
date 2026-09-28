import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { parseAmountQuery, sanitizeSearch } from '../lib/history'
import { incomeMonth, monthRange, shiftMonth } from '../lib/calculations'
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
    // absent until migration 0013
    for_month: typeof row.for_month === 'string' ? row.for_month : null,
    created_at: String(row.created_at),
  }
}

/**
 * Income for the months from `from` to `to` — a handful of rows a month, so
 * no paging. By default it's the months a paycheck pays for (see
 * incomeMonth), so pay that arrived on the 28th for the month after is
 * counted there; `byDate` lists what arrived between the dates instead, as
 * History does.
 */
export function useIncomesBetween(from: string, to: string, byDate = false) {
  return useQuery({
    queryKey: ['incomes', from, to, byDate ? 'date' : 'month'],
    queryFn: async (): Promise<Income[]> => {
      // a paycheck can pay for the month before or after the one it arrived in
      const [lo, hi] = byDate
        ? [from, to]
        : [
            monthRange(shiftMonth(from.slice(0, 7), -1)).from,
            monthRange(shiftMonth(to.slice(0, 7), 1)).to,
          ]
      const { data, error } = await supabase
        .from('incomes')
        // '*': for_month arrives with migration 0013
        .select('*')
        .gte('income_date', lo)
        .lte('income_date', hi)
        .order('income_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []).map(normalize)
      if (byDate) return rows
      return rows.filter((i) => {
        const m = incomeMonth(i)
        return m >= from.slice(0, 7) && m <= to.slice(0, 7)
      })
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
      if (!error) return
      // before migration 0013 there's no for_month: fine unless one was chosen
      if (/for_month/i.test(error.message ?? '')) {
        if (income.for_month) {
          throw new Error('Counting pay for another month needs migration 0013_money_health.sql')
        }
        const rest: Partial<NewIncome> = { ...income }
        delete rest.for_month
        const retry = await supabase.from('incomes').insert(rest)
        if (retry.error) throw retry.error
        return
      }
      throw error
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
