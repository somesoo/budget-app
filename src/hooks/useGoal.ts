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
