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
        // '*' rather than a column list: `archived` and `show_in_chart` arrive with
        // migrations 0005 and 0006,
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
        // absent until migration 0006, and absent means shown
        show_in_chart: c.show_in_chart !== false,
        // absent until migration 0007: every category is a monthly one
        kind: c.kind === 'project' ? 'project' : 'monthly',
        budget_total: c.budget_total == null ? null : Number(c.budget_total),
        starts_on: c.starts_on ?? null,
        ends_on: c.ends_on ?? null,
        goal_id: c.goal_id ?? null,
        // absent until migration 0013: shared
        owner: typeof c.owner === 'string' && c.owner ? c.owner : null,
      }))
    },
    staleTime: 60_000,
  })
}

/** Trips and other projects: categories that don't start over each month. */
export function useProjects() {
  const categories = useCategories()
  return { ...categories, data: categories.data?.filter((c) => c.kind === 'project') }
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
    mutationFn: async (
      category: Pick<Category, 'name' | 'color' | 'monthly_limit'> &
        Partial<
          Pick<Category, 'kind' | 'budget_total' | 'starts_on' | 'ends_on' | 'goal_id' | 'owner'>
        >,
    ) => {
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

/** How many expenses a category has, all time: deleting it needs them moved first. */
export function useCategoryExpenseCount(id: string | undefined) {
  return useQuery({
    queryKey: ['expenses', 'count', id],
    enabled: !!id,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id!)
      if (error) throw error
      return count ?? 0
    },
  })
}

/**
 * Deletes a category for good. Its expenses (the database won't let them lose
 * their category) move to `moveTo` first; without one it must have none.
 */
export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, moveTo }: { id: string; moveTo?: string }) => {
      if (moveTo) {
        const { error } = await supabase
          .from('expenses')
          .update({ category_id: moveTo })
          .eq('category_id', id)
        if (error) throw error
      }
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: categoriesKey })
      void qc.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}
