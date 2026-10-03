import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { RecurringCost } from '../types'
import { todayKey } from '../lib/calculations'
import { isMissingTable } from './useSavings'

export const recurringKey = ['recurring'] as const

export interface RecurringData {
  /** False before migration 0019 on an install from before 1.0.0. */
  available: boolean
  costs: RecurringCost[]
}

function normalize(r: Record<string, unknown>): RecurringCost {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: r.kind as RecurringCost['kind'],
    amount: Number(r.amount),
    every_months: Number(r.every_months) as RecurringCost['every_months'],
    due_on: String(r.due_on),
    category_id: (r.category_id as string | null) ?? null,
    owner: (r.owner as string | null) ?? null,
    archived: Boolean(r.archived),
    reviewed_on: (r.reviewed_on as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    created_at: String(r.created_at),
  }
}

/** Every subscription and regular bill, cancelled ones included. */
export function useRecurringCosts() {
  return useQuery({
    queryKey: recurringKey,
    queryFn: async (): Promise<RecurringData> => {
      const { data, error } = await supabase.from('recurring_costs').select('*').order('name')
      if (error) {
        if (isMissingTable(error)) return { available: false, costs: [] }
        throw error
      }
      return { available: true, costs: (data ?? []).map(normalize) }
    },
  })
}

export type RecurringInput = Pick<
  RecurringCost,
  'name' | 'kind' | 'amount' | 'every_months' | 'due_on' | 'category_id' | 'owner'
> &
  Partial<Pick<RecurringCost, 'archived' | 'note' | 'reviewed_on'>> & { id?: string }

export function useSaveRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: RecurringInput) => {
      const { error } = id
        ? await supabase.from('recurring_costs').update(fields).eq('id', id)
        : await supabase.from('recurring_costs').insert(fields)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: recurringKey })
    },
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_costs').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: recurringKey })
    },
  })
}

/** The review: the ones kept are marked checked today, the rest cancelled. */
export function useReviewSubscriptions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { keep: string[]; cancel: string[] }) => {
      if (v.keep.length > 0) {
        const { error } = await supabase
          .from('recurring_costs')
          .update({ reviewed_on: todayKey() })
          .in('id', v.keep)
        if (error) throw error
      }
      if (v.cancel.length > 0) {
        const { error } = await supabase
          .from('recurring_costs')
          .update({ archived: true, reviewed_on: todayKey() })
          .in('id', v.cancel)
        if (error) throw error
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: recurringKey })
    },
  })
}
