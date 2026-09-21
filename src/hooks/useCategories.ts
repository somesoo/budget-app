import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Category } from '../types'

export const categoriesKey = ['categories'] as const

export function useCategories() {
  return useQuery({
    queryKey: categoriesKey,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, color, monthly_limit, sort_order')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []).map((c) => ({ ...c, monthly_limit: Number(c.monthly_limit) }))
    },
    staleTime: 60_000,
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Pick<Category, 'id'> & Partial<Category>) => {
      const { error } = await supabase.from('categories').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: categoriesKey })
      const previous = qc.getQueryData<Category[]>(categoriesKey)
      qc.setQueryData<Category[]>(categoriesKey, (old) =>
        (old ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(categoriesKey, ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: categoriesKey })
    },
  })
}
