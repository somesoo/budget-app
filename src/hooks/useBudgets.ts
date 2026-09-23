import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useCategories } from './useCategories'
import type { MonthKey } from '../lib/calculations'
import type { BudgetPlan, Category, PlanSuggestion } from '../types'
import type { PlanRequest } from '../lib/planning'

export const budgetKey = (month: MonthKey) => ['budgets', month] as const

function normalize(row: Record<string, unknown>): BudgetPlan {
  const limits: Record<string, number> = {}
  for (const [id, v] of Object.entries((row.limits as Record<string, unknown>) ?? {})) {
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0) limits[id] = n
  }
  return {
    month: String(row.month),
    income: Number(row.income),
    savings: Number(row.savings),
    limits,
    note: (row.note as string | null) ?? null,
    updated_at: String(row.updated_at),
  }
}

/**
 * The month's plan, or null when it has none. Also null when the `budgets`
 * table doesn't exist yet (migration 0005 not run) — the app then simply
 * behaves as before, on the categories' default limits.
 */
export function useBudget(month: MonthKey) {
  return useQuery({
    queryKey: budgetKey(month),
    queryFn: async (): Promise<BudgetPlan | null> => {
      const { data, error } = await supabase
        .from('budgets')
        .select('month, income, savings, limits, note, updated_at')
        .eq('month', month)
        .maybeSingle()
      if (error) {
        console.warn('Budget plans unavailable:', error.message)
        return null
      }
      return data ? normalize(data) : null
    },
  })
}

export function useSaveBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (plan: Omit<BudgetPlan, 'updated_at'>) => {
      const { error } = await supabase
        .from('budgets')
        .upsert({ ...plan, updated_at: new Date().toISOString() }, { onConflict: 'month' })
      if (error) throw error
    },
    onMutate: async (plan) => {
      await qc.cancelQueries({ queryKey: budgetKey(plan.month) })
      const optimistic: BudgetPlan = { ...plan, updated_at: new Date().toISOString() }
      qc.setQueryData<BudgetPlan | null>(budgetKey(plan.month), optimistic)
    },
    onSettled: (_data, _err, plan) => {
      void qc.invalidateQueries({ queryKey: budgetKey(plan.month) })
    },
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (month: MonthKey) => {
      const { error } = await supabase.from('budgets').delete().eq('month', month)
      if (error) throw error
    },
    onSettled: (_data, _err, month) => {
      void qc.invalidateQueries({ queryKey: budgetKey(month) })
    },
  })
}

/**
 * Categories as they apply to `month`: each `monthly_limit` replaced by the
 * month's plan where it sets one. Everything that reads limits — tiles, bars,
 * the pace line — takes these, so a planned month is measured against its plan.
 * Hidden categories are included (their past spending still counts); filter
 * on `archived` where only the active ones belong.
 */
export function useMonthCategories(month: MonthKey) {
  const categories = useCategories()
  const budget = useBudget(month)
  const plan = budget.data ?? null
  const data: Category[] | undefined = categories.data?.map((c) =>
    plan && c.id in plan.limits ? { ...c, monthly_limit: plan.limits[c.id] } : c,
  )
  return { ...categories, data, plan, planLoading: budget.isLoading }
}

export class PlanUnavailableError extends Error {}

/** Asks /api/plan for a drafted plan. Nothing is saved — the planner shows it for review. */
export function useSuggestPlan() {
  return useMutation({
    mutationFn: async (payload: PlanRequest): Promise<PlanSuggestion> => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (res.status === 404) {
        throw new PlanUnavailableError(
          'The AI server isn’t running here — it works on Vercel, or locally with `vercel dev`.',
        )
      }
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
      return body as PlanSuggestion
    },
  })
}
