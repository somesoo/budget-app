import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import {
  LEGACY_PEOPLE,
  MAX_PEOPLE,
  PERSON_COLORS,
  peopleStore,
  personIdFor,
  setPeople,
  type PersonInfo,
} from '../lib/people'
import { supabase } from '../lib/supabaseClient'
import type { Person } from '../types'
import { categoriesKey } from './useCategories'
import { isMissingTable, savingsKey } from './useSavings'

export const peopleKey = ['people'] as const

interface PeopleData {
  people: PersonInfo[]
  /** False before migration 0015: the two of you, fixed, and nothing to edit. */
  available: boolean
}

async function fetchPeople(): Promise<PeopleData> {
  const { data, error } = await supabase.from('people').select('*').order('sort_order')
  if (error) {
    if (isMissingTable(error)) return { people: LEGACY_PEOPLE, available: false }
    throw error
  }
  const people = (data ?? []).map((r, i) => ({
    id: String(r.id),
    name: String(r.name),
    color: typeof r.color === 'string' ? r.color : PERSON_COLORS[i % PERSON_COLORS.length],
    sort_order: Number(r.sort_order ?? i),
  }))
  return { people, available: true }
}

/**
 * The people in the budget, loaded once and shared through `lib/people` so
 * any code can name them. `needsSetup` on a fresh install, before anyone has
 * been named.
 */
export function usePeople(enabled = true) {
  const query = useQuery({
    queryKey: peopleKey,
    // before signing in the table reads as empty, which would look like a fresh install
    enabled,
    queryFn: async () => {
      const data = await fetchPeople()
      setPeople(data.people)
      return data
    },
    staleTime: Infinity,
  })
  const people = useSyncExternalStore(peopleStore.subscribe, peopleStore.get, peopleStore.get)
  const available = query.data?.available ?? false
  return {
    people,
    available,
    isLoading: query.isLoading,
    error: query.error,
    needsSetup: available && query.data!.people.length === 0,
  }
}

/** Setting up, renaming, adding and removing people. */
export function usePeopleActions() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: peopleKey })

  /** First run: everyone at once, in the order they were typed. */
  const setup = useMutation({
    mutationFn: async (names: string[]): Promise<PersonInfo[]> => {
      const rows: PersonInfo[] = []
      for (const [i, raw] of names.slice(0, MAX_PEOPLE).entries()) {
        const name = raw.trim()
        rows.push({
          id: personIdFor(name, rows.map((r) => r.id)),
          name,
          color: PERSON_COLORS[i],
          sort_order: i,
        })
      }
      const { error } = await supabase.from('people').insert(rows)
      if (error) throw error
      setPeople(rows)
      return rows
    },
    onSuccess: done,
  })

  const add = useMutation({
    mutationFn: async ({ name, people }: { name: string; people: PersonInfo[] }) => {
      if (people.length >= MAX_PEOPLE) throw new Error(`Up to ${MAX_PEOPLE} people.`)
      const used = new Set(people.map((p) => p.color))
      const row: PersonInfo = {
        id: personIdFor(name.trim(), people.map((p) => p.id)),
        name: name.trim(),
        color: PERSON_COLORS.find((c) => !used.has(c)) ?? PERSON_COLORS[people.length],
        sort_order: Math.max(-1, ...people.map((p) => p.sort_order)) + 1,
      }
      const { error } = await supabase.from('people').insert(row)
      if (error) throw error
    },
    onSuccess: done,
  })

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: Person; name: string }) => {
      const { error } = await supabase.from('people').update({ name: name.trim() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: done,
  })

  /**
   * Only someone with nothing logged: their expenses and income would lose
   * whose they were. Their allowances become shared categories and their
   * accounts joint ones.
   */
  const remove = useMutation({
    mutationFn: async (id: Person) => {
      for (const table of ['expenses', 'incomes'] as const) {
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('person', id)
        if (error) throw error
        if ((count ?? 0) > 0)
          throw new Error('They have entries logged, so they stay. Rename them instead.')
      }
      const cleared = await supabase.from('categories').update({ owner: null }).eq('owner', id)
      if (cleared.error && !/owner/.test(cleared.error.message)) throw cleared.error
      const joint = await supabase.from('savings_accounts').update({ owner: 'joint' }).eq('owner', id)
      if (joint.error && !isMissingTable(joint.error)) throw joint.error
      const { error } = await supabase.from('people').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void done()
      void qc.invalidateQueries({ queryKey: categoriesKey })
      void qc.invalidateQueries({ queryKey: savingsKey })
    },
  })

  return { setup, add, rename, remove }
}
