import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Person, RecurringCost } from '../types'
import { todayKey } from '../lib/calculations'
import { autoDue, type PaidDue } from '../lib/recurring'
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
    // absent until migration 0022
    auto_log: r.auto_log === true,
    created_at: String(r.created_at),
  }
}

/** Every subscription and regular bill, cancelled ones included. */
export function useRecurringCosts(enabled = true) {
  return useQuery({
    queryKey: recurringKey,
    enabled,
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

/* ---------- paying them ---------- */

export interface PaidDues {
  /** False before migration 0022: nothing can be marked paid yet. */
  available: boolean
  paid: PaidDue[]
}

/**
 * Which due dates have been logged as expenses. Under 'expenses' so that any
 * change to an expense (this phone or another) refreshes it.
 */
export function usePaidDues(enabled = true) {
  return useQuery({
    queryKey: ['expenses', 'recurring-paid'],
    enabled,
    queryFn: async (): Promise<PaidDues> => {
      const { data, error } = await supabase
        .from('expenses')
        .select('recurring_id, recurring_due')
        .not('recurring_id', 'is', null)
      if (error) {
        // the columns aren't there before migration 0022
        if (error.code === '42703' || /recurring_/.test(error.message)) return { available: false, paid: [] }
        throw error
      }
      return {
        available: true,
        paid: (data ?? []).map((r) => ({
          recurring_id: String(r.recurring_id),
          recurring_due: String(r.recurring_due),
        })),
      }
    },
  })
}

/**
 * Logs a due date of a regular cost as an expense in its category. A due date
 * already logged (from another phone, say) is left as it is.
 */
export function usePayRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { cost: RecurringCost; due: string; date: string; person: Person }) => {
      if (!v.cost.category_id) throw new Error('no category')
      const { error } = await supabase.from('expenses').upsert(
        {
          amount: v.cost.amount,
          category_id: v.cost.category_id,
          person: v.cost.owner ?? v.person,
          note: v.cost.name,
          expense_date: v.date,
          recurring_id: v.cost.id,
          recurring_due: v.due,
        },
        { onConflict: 'recurring_id,recurring_due', ignoreDuplicates: true },
      )
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

/**
 * Costs set to log themselves: on opening the app, whatever has come due this
 * month and isn't logged yet is. Mounted once, for the whole app.
 */
export function useAutoLogRecurring(person: Person | null) {
  // nothing to read before signing in
  const { data: costs } = useRecurringCosts(!!person)
  const { data: paid } = usePaidDues(!!person)
  const pay = usePayRecurring()
  const tried = useRef(new Set<string>())

  useEffect(() => {
    if (!person || !costs?.available || !paid?.available) return
    const today = todayKey()
    for (const cost of costs.costs) {
      const due = autoDue(cost, today, paid.paid)
      const key = `${cost.id}:${due}`
      if (!due || tried.current.has(key)) continue
      tried.current.add(key)
      pay.mutate({ cost, due, date: due, person })
    }
  }, [costs, paid, person, pay])
}
