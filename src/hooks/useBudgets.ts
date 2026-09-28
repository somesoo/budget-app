import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useCategories } from './useCategories'
import type { MonthKey } from '../lib/calculations'
import type {
  BudgetPlan,
  Category,
  PlanAllocation,
  PlanCarryover,
  PlanSuggestion,
} from '../types'
import type { PlanRequest } from '../lib/planning'

export const budgetKey = (month: MonthKey) => ['budgets', month] as const

function normalizeAllocations(raw: unknown): PlanAllocation[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((r) => {
    if (!r || typeof r !== 'object') return []
    const row = r as Record<string, unknown>
    const amount = Number(row.amount)
    const account_id = typeof row.account_id === 'string' ? row.account_id : null
    const goal_id = typeof row.goal_id === 'string' ? row.goal_id : null
    const loan_id = typeof row.loan_id === 'string' ? row.loan_id : null
    if (!Number.isFinite(amount) || amount <= 0 || (!account_id && !goal_id)) return []
    return [loan_id ? { account_id, goal_id, amount, loan_id } : { account_id, goal_id, amount }]
  })
}

/** A list of goals with shares; a plan saved before the split had one goal, taking it all. */
function normalizeCarryover(raw: unknown): PlanCarryover[] {
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : []
  return rows.flatMap((r) => {
    if (!r || typeof r !== 'object') return []
    const row = r as Record<string, unknown>
    if (typeof row.goal_id !== 'string') return []
    const share = Number(row.share)
    const fixed = row.fixed == null ? null : Number(row.fixed)
    return [
      {
        goal_id: row.goal_id,
        account_id: typeof row.account_id === 'string' ? row.account_id : null,
        share: Number.isFinite(share) && share >= 0 ? share : 100,
        fixed: fixed !== null && Number.isFinite(fixed) && fixed >= 0 ? fixed : null,
      },
    ]
  })
}

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
    // absent until migration 0010 has been run
    allocations: normalizeAllocations(row.allocations),
    carryover: normalizeCarryover(row.carryover),
    // absent until migration 0012 has been run
    carryover_keep: Math.max(Number(row.carryover_keep ?? 0) || 0, 0),
    note: (row.note as string | null) ?? null,
    updated_at: String(row.updated_at),
  }
}

/** The `allocations`/`carryover` columns aren't there: migration 0010 hasn't been run. */
const missingAllocations = (error: { message?: string }) =>
  /allocations|carryover/i.test(error.message ?? '')

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
        // '*' rather than a column list: `allocations` only exists after migration 0010
        .select('*')
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
      const row = { ...plan, updated_at: new Date().toISOString() }
      const { error } = await supabase.from('budgets').upsert(row, { onConflict: 'month' })
      if (!error) return
      // migration 0012 not run: the cushion can't be kept, everything else can
      if (/carryover_keep/i.test(error.message ?? '')) {
        if (plan.carryover_keep > 0) {
          throw new Error(
            'Keeping part of the leftover on the account needs migration 0012_carryover_keep.sql',
          )
        }
        const withoutKeep: Partial<typeof row> = { ...row }
        delete withoutKeep.carryover_keep
        const again = await supabase.from('budgets').upsert(withoutKeep, { onConflict: 'month' })
        if (!again.error) return
        throw again.error
      }
      if (!missingAllocations(error)) throw error
      // before migration 0010 a plan without a split still saves
      if (plan.allocations.length > 0 || plan.carryover.length > 0) {
        throw new Error(
          'Splitting savings between goals and IKE needs migration 0010_plan_allocations.sql',
        )
      }
      const rest: Partial<typeof row> = { ...row }
      delete rest.allocations
      delete rest.carryover
      delete rest.carryover_keep
      const retry = await supabase.from('budgets').upsert(rest, { onConflict: 'month' })
      if (retry.error) throw retry.error
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
 * on `archived` where only the active ones belong. Projects (trips) aren't:
 * they run across months, see useProjects.
 */
export function useMonthCategories(month: MonthKey) {
  const categories = useCategories()
  const budget = useBudget(month)
  const plan = budget.data ?? null
  // trips and other projects aren't part of any month (see lib/projects)
  const data: Category[] | undefined = categories.data
    ?.filter((c) => c.kind !== 'project')
    .map((c) => (plan && c.id in plan.limits ? { ...c, monthly_limit: plan.limits[c.id] } : c))
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
          'The AI server isn’t running here. It works on Vercel, or locally with `vercel dev`.',
        )
      }
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
      return body as PlanSuggestion
    },
  })
}
