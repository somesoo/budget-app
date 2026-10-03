import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Debt, DebtBalance } from '../types'
import { todayKey } from '../lib/calculations'
import { isMissingTable } from './useSavings'

export const debtsKey = ['debts'] as const

export interface DebtsData {
  /** False before migration 0019 on an install from before 1.0.0. */
  available: boolean
  debts: Debt[]
  balances: DebtBalance[]
}

function normalizeDebt(r: Record<string, unknown>): Debt {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: r.kind as Debt['kind'],
    owner: r.owner as Debt['owner'],
    interest_rate: r.interest_rate == null ? null : Number(r.interest_rate),
    monthly_payment: Number(r.monthly_payment),
    color: String(r.color),
    sort_order: Number(r.sort_order),
    archived: Boolean(r.archived),
    note: (r.note as string | null) ?? null,
    created_at: String(r.created_at),
  }
}

function normalizeBalance(r: Record<string, unknown>): DebtBalance {
  return {
    id: String(r.id),
    debt_id: String(r.debt_id),
    balance_date: String(r.balance_date),
    balance: Number(r.balance),
    note: (r.note as string | null) ?? null,
    created_at: String(r.created_at),
  }
}

/** Every debt and every balance logged for them: short lists, and net worth needs them all. */
export function useDebts() {
  return useQuery({
    queryKey: debtsKey,
    queryFn: async (): Promise<DebtsData> => {
      const debts = await supabase.from('debts').select('*').order('sort_order')
      if (debts.error) {
        if (isMissingTable(debts.error)) return { available: false, debts: [], balances: [] }
        throw debts.error
      }
      const balances = await supabase
        .from('debt_balances')
        .select('*')
        .order('balance_date', { ascending: false })
      if (balances.error) throw balances.error
      return {
        available: true,
        debts: (debts.data ?? []).map(normalizeDebt),
        balances: (balances.data ?? []).map(normalizeBalance),
      }
    },
  })
}

export type DebtInput = Pick<
  Debt,
  'name' | 'kind' | 'owner' | 'interest_rate' | 'monthly_payment' | 'color'
> &
  Partial<Pick<Debt, 'archived' | 'note'>> & { id?: string }

/** Creates a debt (with what's owed today, when given) or updates one. Resolves to its id. */
export function useSaveDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, owed, ...fields }: DebtInput & { owed?: number }) => {
      if (id) {
        const { error } = await supabase.from('debts').update(fields).eq('id', id)
        if (error) throw error
        return id
      }
      const existing = qc.getQueryData<DebtsData>(debtsKey)?.debts ?? []
      const sort_order = existing.reduce((m, d) => Math.max(m, d.sort_order), 0) + 1
      const { data, error } = await supabase
        .from('debts')
        .insert({ ...fields, sort_order })
        .select('id')
        .single()
      if (error) throw error
      const newId = String(data.id)
      if (owed !== undefined && owed > 0) {
        const added = await supabase
          .from('debt_balances')
          .insert({ debt_id: newId, balance: owed, balance_date: todayKey() })
        if (added.error) throw added.error
      }
      return newId
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: debtsKey })
    },
  })
}

/** Deletes a debt and its history for good. */
export function useDeleteDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('debts').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: debtsKey })
    },
  })
}

/** Logs what a debt stands at: after an instalment, an overpayment, or from the bank. */
export function useAddDebtBalance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { debt: string; balance: number; date?: string; note?: string | null }) => {
      const { error } = await supabase.from('debt_balances').insert({
        debt_id: v.debt,
        balance: v.balance,
        balance_date: v.date ?? todayKey(),
        note: v.note ?? null,
      })
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: debtsKey })
    },
  })
}

export function useDeleteDebtBalance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('debt_balances').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: debtsKey })
    },
  })
}
