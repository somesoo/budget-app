import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Allocation, SavingsAccount, SavingsMovement } from '../types'
import { currentMonthKey, roundMoney } from '../lib/calculations'
import { accountSummaries, goalSummaries, savedInMonth, totalNeededPerMonth } from '../lib/savings'
import { useBudget } from './useBudgets'
import { goalsKey, useGoals } from './useGoal'

export const savingsKey = ['savings'] as const

export interface SavingsData {
  /** False until migration 0007 has been run: the tables aren't there yet. */
  available: boolean
  accounts: SavingsAccount[]
  movements: SavingsMovement[]
  allocations: Allocation[]
}

const PAGE_SIZE = 1000

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /does not exist|schema cache/i.test(error.message ?? '')
  )
}

function normalizeAccount(r: Record<string, unknown>): SavingsAccount {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: r.kind as SavingsAccount['kind'],
    owner: r.owner as SavingsAccount['owner'],
    interest_rate: r.interest_rate == null ? null : Number(r.interest_rate),
    color: String(r.color),
    sort_order: Number(r.sort_order),
    archived: Boolean(r.archived),
    note: (r.note as string | null) ?? null,
    created_at: String(r.created_at),
  }
}

function normalizeMovement(r: Record<string, unknown>): SavingsMovement {
  return {
    id: String(r.id),
    account_id: String(r.account_id),
    kind: r.kind as SavingsMovement['kind'],
    amount: Number(r.amount),
    movement_date: String(r.movement_date),
    person: (r.person as SavingsMovement['person']) ?? null,
    note: (r.note as string | null) ?? null,
    goal_id: (r.goal_id as string | null) ?? null,
    transfer_id: (r.transfer_id as string | null) ?? null,
    created_at: String(r.created_at),
  }
}

/**
 * Accounts, every movement on them and the goal allocations, in one go: the
 * lists are small, and every savings screen needs all three to add up.
 */
export function useSavings() {
  return useQuery({
    queryKey: [...savingsKey, 'data'],
    queryFn: async (): Promise<SavingsData> => {
      const accounts = await supabase.from('savings_accounts').select('*').order('sort_order')
      if (accounts.error) {
        if (isMissingTable(accounts.error)) {
          return { available: false, accounts: [], movements: [], allocations: [] }
        }
        throw accounts.error
      }

      const movements: SavingsMovement[] = []
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('savings_movements')
          .select('*')
          .order('movement_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)
        if (error) throw error
        movements.push(...(data ?? []).map(normalizeMovement))
        if (!data || data.length < PAGE_SIZE) break
      }

      const allocations = await supabase
        .from('goal_allocations')
        .select('account_id, goal_id, amount')
      if (allocations.error) throw allocations.error

      return {
        available: true,
        accounts: (accounts.data ?? []).map(normalizeAccount),
        movements,
        allocations: (allocations.data ?? []).map((a) => ({
          account_id: String(a.account_id),
          goal_id: String(a.goal_id),
          amount: Number(a.amount),
        })),
      }
    },
  })
}

/* ---------- moving money: the database functions from migration 0007 ---------- */

interface Common {
  date?: string
  person?: string | null
  note?: string | null
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(name, args)
  // the functions explain themselves ("Only 512 is unassigned…"), so pass that on
  if (error) throw new Error(error.message)
}

/**
 * Every way money moves, each one atomic in the database. Errors carry the
 * database's own explanation, fit to show as is.
 */
export function useSavingsActions() {
  const qc = useQueryClient()
  const settle = {
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: savingsKey })
      void qc.invalidateQueries({ queryKey: goalsKey })
    },
  }
  const extra = (c: Common) => ({
    p_date: c.date,
    p_person: c.person ?? null,
    p_note: c.note?.trim() || null,
  })

  return {
    saveTo: useMutation({
      mutationFn: (
        v: Common & {
          account: string
          amount: number
          goal?: string | null
          kind?: 'deposit' | 'interest'
        },
      ) =>
        rpc('save_to', {
          p_account: v.account,
          p_amount: v.amount,
          p_goal: v.goal ?? null,
          p_kind: v.kind ?? 'deposit',
          ...extra(v),
        }),
      ...settle,
    }),
    takeFrom: useMutation({
      mutationFn: (v: Common & { account: string; amount: number; goal?: string | null }) =>
        rpc('take_from', {
          p_account: v.account,
          p_amount: v.amount,
          p_goal: v.goal ?? null,
          ...extra(v),
        }),
      ...settle,
    }),
    setBalance: useMutation({
      mutationFn: (v: Common & { account: string; balance: number }) =>
        rpc('set_balance', { p_account: v.account, p_balance: v.balance, ...extra(v) }),
      ...settle,
    }),
    allocate: useMutation({
      mutationFn: (v: { account: string; goal: string; delta: number }) =>
        rpc('allocate', { p_account: v.account, p_goal: v.goal, p_delta: v.delta }),
      ...settle,
    }),
    transfer: useMutation({
      mutationFn: (
        v: Common & { from: string; to: string; amount: number; goal?: string | null },
      ) =>
        rpc('transfer', {
          p_from: v.from,
          p_to: v.to,
          p_amount: v.amount,
          p_goal: v.goal ?? null,
          ...extra(v),
        }),
      ...settle,
    }),
    deleteMovement: useMutation({
      mutationFn: (id: string) => rpc('delete_movement', { p_id: id }),
      ...settle,
    }),
  }
}

export type AccountInput = Pick<
  SavingsAccount,
  'name' | 'kind' | 'owner' | 'interest_rate' | 'color'
> &
  Partial<Pick<SavingsAccount, 'archived' | 'note' | 'sort_order'>> & { id?: string }

/** Creates an account, or updates the one with `id`. */
export function useSaveAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: AccountInput) => {
      if (id) {
        const { error } = await supabase.from('savings_accounts').update(fields).eq('id', id)
        if (error) throw error
        return id
      }
      const existing = qc.getQueryData<SavingsData>([...savingsKey, 'data'])?.accounts ?? []
      const sort_order = existing.reduce((m, a) => Math.max(m, a.sort_order), 0) + 1
      const { data, error } = await supabase
        .from('savings_accounts')
        .insert({ ...fields, sort_order })
        .select('id')
        .single()
      if (error) throw error
      return String(data.id)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: savingsKey })
    },
  })
}

/**
 * Everything the savings screens show, added up: accounts with their balance
 * and unassigned money, goals with progress and status, this month's saving
 * against the plan. `available` is false until migration 0007 has been run.
 */
export function useSavingsOverview() {
  const savings = useSavings()
  const goals = useGoals()
  const month = currentMonthKey()
  const { data: plan } = useBudget(month)

  const data = savings.data
  const allGoals = goals.data ?? []
  const accounts = data ? accountSummaries(data.accounts, data.movements, data.allocations) : []
  const goalList = data
    ? goalSummaries({
        goals: allGoals,
        accounts: data.accounts,
        movements: data.movements,
        allocations: data.allocations,
        now: month,
      })
    : []
  const open = accounts.filter((a) => !a.account.archived)

  return {
    isLoading: savings.isLoading || goals.isLoading,
    error: savings.error ?? goals.error,
    available: data?.available ?? false,
    movements: data?.movements ?? [],
    accounts,
    goals: goalList,
    total: roundMoney(open.reduce((s, a) => s + a.balance, 0)),
    unassigned: roundMoney(open.reduce((s, a) => s + Math.max(a.unassigned, 0), 0)),
    savedThisMonth: data ? savedInMonth(data.movements, month) : 0,
    /** What this month's plan means to put aside; null without a plan. */
    plannedThisMonth: plan ? plan.savings : null,
    neededPerMonth: totalNeededPerMonth(goalList.filter((g) => !g.goal.archived)),
  }
}

export type SavingsOverview = ReturnType<typeof useSavingsOverview>

/**
 * "The goal" for the places that speak of one (the forecast, the planner):
 * the first open goal, with what's saved toward it. Once savings accounts
 * exist that comes from its allocations; before, from the old current_amount.
 */
export function usePrimaryGoal() {
  const overview = useSavingsOverview()
  const goals = useGoals()
  const first = goals.data?.find((g) => !g.archived) ?? null
  if (!first || !overview.available) return { data: first }
  const saved = overview.goals.find((g) => g.goal.id === first.id)?.saved ?? 0
  return { data: { ...first, current_amount: saved } }
}
