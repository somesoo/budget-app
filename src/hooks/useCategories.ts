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
        // '*' rather than a column list: `archived` arrives with migration 0005,
        // and the app must keep working on a database that hasn't run it yet
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []).map((c) => ({
        id: String(c.id),
        name: String(c.name),
        color: String(c.color),
        monthly_limit: Number(c.monthly_limit),
        sort_order: Number(c.sort_order),
        archived: Boolean(c.archived),
      }))
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

export function useAddCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (category: Pick<Category, 'name' | 'color' | 'monthly_limit'>) => {
      const existing = qc.getQueryData<Category[]>(categoriesKey) ?? []
      const sort_order = existing.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1
      const { error } = await supabase.from('categories').insert({ ...category, sort_order })
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: categoriesKey })
    },
  })
}
