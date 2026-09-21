import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Goal } from '../types'

export const goalKey = ['goal'] as const

/** V1: a single shared savings goal — we take the first row in the table. */
export function useGoal() {
  return useQuery({
    queryKey: goalKey,
    queryFn: async (): Promise<Goal | null> => {
      const { data, error } = await supabase
        .from('goals')
        .select('id, name, target_amount, current_amount')
        .order('created_at', { ascending: true })
        .limit(1)
      if (error) throw error
      const row = data?.[0]
      if (!row) return null
      return {
        ...row,
        target_amount: Number(row.target_amount),
        current_amount: Number(row.current_amount),
      }
    },
  })
}

/**
 * Pay into (or take out of) the goal. The addition happens in the database via
 * `add_to_goal`, so two phones contributing at the same time cannot overwrite
 * each other. A negative delta withdraws; the function clamps at zero.
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
    onMutate: async ({ delta }) => {
      await qc.cancelQueries({ queryKey: goalKey })
      const previous = qc.getQueryData<Goal | null>(goalKey)
      qc.setQueryData<Goal | null>(goalKey, (old) =>
        old ? { ...old, current_amount: Math.max(old.current_amount + delta, 0) } : old,
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(goalKey, ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: goalKey })
    },
  })
}

export function useUpsertGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (goal: Omit<Goal, 'id'> & { id?: string }) => {
      if (goal.id) {
        const { error } = await supabase
          .from('goals')
          .update({
            name: goal.name,
            target_amount: goal.target_amount,
            current_amount: goal.current_amount,
          })
          .eq('id', goal.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('goals').insert({
          name: goal.name,
          target_amount: goal.target_amount,
          current_amount: goal.current_amount,
        })
        if (error) throw error
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: goalKey })
    },
  })
}
