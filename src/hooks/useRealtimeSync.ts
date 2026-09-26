import { useEffect, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { categoriesKey } from './useCategories'
import { goalsKey } from './useGoal'
import { savingsKey } from './useSavings'

export type SyncStatus = 'connecting' | 'live' | 'offline'

/* Tiny store so the connection status is readable from any component. */
let status: SyncStatus = isSupabaseConfigured ? 'connecting' : 'offline'
const listeners = new Set<() => void>()

function setStatus(next: SyncStatus) {
  if (status === next) return
  status = next
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useRealtimeStatus(): SyncStatus {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => status,
  )
}

/**
 * One subscription for the whole app (mounted in App): every database change —
 * including one made on the other phone — invalidates the matching TanStack
 * Query cache, so tiles, calendar and summary refresh on their own.
 */
export function useRealtimeSync(): SyncStatus {
  const qc = useQueryClient()

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const channel = supabase
      .channel('budget-app-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        void qc.invalidateQueries({ queryKey: ['expenses'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        void qc.invalidateQueries({ queryKey: categoriesKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, () => {
        void qc.invalidateQueries({ queryKey: goalsKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incomes' }, () => {
        void qc.invalidateQueries({ queryKey: ['incomes'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advice' }, () => {
        void qc.invalidateQueries({ queryKey: ['advice'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => {
        void qc.invalidateQueries({ queryKey: ['budgets'] })
      })
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') setStatus('live')
        else if (state === 'CLOSED' || state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          setStatus('offline')
        }
      })

    // Savings (migration 0007) on a channel of its own: before the migration
    // has been run these tables don't exist, and the rejection mustn't take
    // the expense sync above down with it.
    const savings = supabase
      .channel('budget-app-savings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_accounts' }, () => {
        void qc.invalidateQueries({ queryKey: savingsKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_movements' }, () => {
        void qc.invalidateQueries({ queryKey: savingsKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goal_allocations' }, () => {
        void qc.invalidateQueries({ queryKey: savingsKey })
      })
      .subscribe()

    // coming back after the phone was asleep — pull in anything we missed
    const onVisible = () => {
      if (document.visibilityState === 'visible') void qc.invalidateQueries()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
      void supabase.removeChannel(savings)
    }
  }, [qc])

  return useRealtimeStatus()
}
