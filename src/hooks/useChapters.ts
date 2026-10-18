import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { historyFloor, type Chapter } from '../lib/chapters'
import { todayKey } from '../lib/calculations'
import { supabase } from '../lib/supabaseClient'
import { isMissingTable } from './useSavings'
import { usePrefs } from './usePrefs'

export const chaptersKey = ['chapters'] as const

interface ChaptersData {
  chapters: Chapter[]
  /** False until migration 0021 has run. */
  available: boolean
}

export function useChapters() {
  return useQuery({
    queryKey: chaptersKey,
    queryFn: async (): Promise<ChaptersData> => {
      const { data, error } = await supabase
        .from('chapters')
        .select('id, name, starts_on')
        .order('starts_on')
      if (error) {
        if (isMissingTable(error)) return { chapters: [], available: false }
        throw error
      }
      const chapters = (data ?? []).map((r) => ({
        id: String(r.id),
        name: String(r.name),
        starts_on: String(r.starts_on),
      }))
      return { chapters, available: true }
    },
    staleTime: Infinity,
  })
}

export function useAddChapter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (chapter: { name: string; starts_on: string }) => {
      const { error } = await supabase.from('chapters').insert(chapter)
      if (error) throw error
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: chaptersKey }),
  })
}

export function useUpdateChapter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; starts_on?: string }) => {
      const { error } = await supabase.from('chapters').update(patch).eq('id', id)
      if (error) throw error
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: chaptersKey }),
  })
}

export function useDeleteChapter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chapters').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: chaptersKey }),
  })
}

/**
 * What a list of expenses or income is for, which decides how far back it
 * reaches: 'view' (what's shown) and 'plan' (what the planner and the typical
 * month learn from) stop at the current chapter unless this phone includes
 * past ones; 'all' always reaches back to the start (a chapter's own summary).
 */
export type HistoryScope = 'view' | 'plan' | 'all'

/** The first day a list for `scope` includes; null: no limit. */
export function useHistoryFloor(scope: HistoryScope): string | null {
  const { data } = useChapters()
  const prefs = usePrefs()
  if (scope === 'all' || !data) return null
  const includePast = scope === 'view' ? prefs.showPastChapters : prefs.pastChaptersInPlanner
  return historyFloor(data.chapters, todayKey(), includePast)
}
