import { peopleKey } from './usePeople'
import { useEffect, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { categoriesKey } from './useCategories'
import { goalsKey } from './useGoal'
import { chatKey } from './useChat'
import { savingsKey } from './useSavings'
import { debtsKey } from './useDebts'
import { recurringKey } from './useRecurring'
import { chaptersKey } from './useChapters'

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

    // Savings and Ask (migrations 0007, 0008) on a channel of their own: until
    // those migrations have been run these tables don't exist, and the rejection mustn't take
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
      // who's in the budget (migration 0015): a rename shows on every phone
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, () => {
        void qc.invalidateQueries({ queryKey: peopleKey })
      })
      // borrowing from yourselves (migration 0011)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_loans' }, () => {
        void qc.invalidateQueries({ queryKey: savingsKey })
      })
      // the Ask tab's conversations (migration 0008)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_threads' }, () => {
        void qc.invalidateQueries({ queryKey: chatKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_messages' }, () => {
        void qc.invalidateQueries({ queryKey: chatKey })
      })
      .subscribe()

    // debts and regular costs (migration 0019), apart for the same reason
    const wealth = supabase
      .channel('budget-app-wealth')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debts' }, () => {
        void qc.invalidateQueries({ queryKey: debtsKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debt_balances' }, () => {
        void qc.invalidateQueries({ queryKey: debtsKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_costs' }, () => {
        void qc.invalidateQueries({ queryKey: recurringKey })
      })
      .subscribe()

    // chapters (migration 0021), apart for the same reason
    const chapters = supabase
      .channel('budget-app-chapters')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters' }, () => {
        void qc.invalidateQueries({ queryKey: chaptersKey })
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
      void supabase.removeChannel(wealth)
      void supabase.removeChannel(chapters)
    }
  }, [qc])

  return useRealtimeStatus()
}
