import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Goal } from '../types'

export const goalsKey = ['goals'] as const

function normalizeGoal(row: Record<string, unknown>): Goal {
  return {
    id: String(row.id),
    name: String(row.name),
    target_amount: Number(row.target_amount),
    current_amount: Number(row.current_amount),
    // absent until migration 0007
    target_date: (row.target_date as string | null) ?? null,
    color: (row.color as string | undefined) ?? '#3987e5',
    sort_order: Number(row.sort_order ?? 0),
    archived: Boolean(row.archived),
    note: (row.note as string | null) ?? null,
    // absent until migration 0013
    is_emergency: row.is_emergency === true,
    is_bills_fund: row.is_bills_fund === true,
  }
}

/** Every savings goal, archived ones included, in their order. */
export function useGoals() {
  return useQuery({
    queryKey: goalsKey,
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase
        .from('goals')
        // '*': target_date and friends arrive with migration 0007
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? [])
        .map(normalizeGoal)
        .sort((a, b) => a.sort_order - b.sort_order)
    },
  })
}

/**
 * The first open goal. For the places that still speak of "the goal"
 * (forecast, planner), until they learn about several.
 */
export function useGoal() {
  const goals = useGoals()
  return { ...goals, data: goals.data?.find((g) => !g.archived) ?? null }
}

/**
 * Pay into (or take out of) the goal the old way, before savings accounts.
 * The addition happens in the database via `add_to_goal`, so two phones
 * contributing at the same time cannot overwrite each other.
 */
export function useAddToGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ goalId, delta }: { goalId: string; delta: number }) => {
      const { error } = await supabase.rpc('add_to_goal', {
        goal_id: goalId,
        delta,
      })
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: goalsKey })
    },
  })
}

export type GoalInput = Pick<Goal, 'name' | 'target_amount'> &
  Partial<Omit<Goal, 'id' | 'name' | 'target_amount'>> & { id?: string }

/** Creates a goal, or updates the one with `id`. Fields left out stay as they are. */
export function useUpsertGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: GoalInput): Promise<string> => {
      if (id) {
        const { error } = await supabase.from('goals').update(fields).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('goals').insert(fields).select('id').single()
        if (error) throw error
        id = String(data.id)
      }
      // there's one emergency fund: marking this one unmarks the rest
      if (fields.is_emergency) {
        const { error } = await supabase
          .from('goals')
          .update({ is_emergency: false })
          .neq('id', id)
          .eq('is_emergency', true)
        if (error) throw error
      }
      // and one bills fund
      if (fields.is_bills_fund) {
        const { error } = await supabase
          .from('goals')
          .update({ is_bills_fund: false })
          .neq('id', id)
          .eq('is_bills_fund', true)
        if (error) throw error
      }
      return id
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: goalsKey })
    },
  })
}
