import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { parseAmountQuery, sanitizeSearch } from '../lib/history'
import { incomeMonth, monthRange, shiftMonth } from '../lib/calculations'
import type { Income, NewIncome } from '../types'
import { t } from '../i18n'

// '*': for_month and one_off arrive with migrations 0013 and 0014
const COLUMNS = '*'

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
    // absent until migration 0014: everything is pay
    one_off: row.one_off === true,
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

/**
 * Columns a database without the later migrations doesn't have: saving goes
 * ahead without them while they're at their default, and says which
 * migration to run when one was really set.
 */
const OPTIONAL_COLUMNS = [
  {
    column: 'for_month',
    isSet: (i: Partial<NewIncome>) => !!i.for_month,
    needs: () =>
      t('errors.migration', { file: '0013_money_health.sql', what: t('errors.featureForMonth') }),
  },
  {
    column: 'one_off',
    isSet: (i: Partial<NewIncome>) => i.one_off === true,
    needs: () =>
      t('errors.migration', { file: '0014_one_off_income.sql', what: t('errors.featureOneOff') }),
  },
] as const

/** Runs `write`, leaving out optional columns the database doesn't know yet. */
async function withOptionalColumns<T extends Partial<NewIncome>>(
  row: T,
  write: (row: T) => PromiseLike<{ error: { message?: string } | null }>,
): Promise<void> {
  let current = row
  for (;;) {
    const { error } = await write(current)
    if (!error) return
    const missing = OPTIONAL_COLUMNS.find(
      (c) => c.column in current && (error.message ?? '').includes(c.column),
    )
    if (!missing) throw error
    if (missing.isSet(current)) throw new Error(missing.needs())
    const rest = { ...current }
    delete rest[missing.column]
    current = rest
  }
}

export function useAddIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (income: NewIncome) =>
      withOptionalColumns(income, (row) => supabase.from('incomes').insert(row)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['incomes'] })
    },
  })
}

export function useUpdateIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: Pick<Income, 'id'> & Partial<NewIncome>) =>
      withOptionalColumns(patch, (row) => supabase.from('incomes').update(row).eq('id', id)),
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
    mutationFn: (income: Income) =>
      withOptionalColumns(income, (row) => supabase.from('incomes').insert(row)),
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
