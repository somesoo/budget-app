import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ownCategories, ownExpenses } from '../lib/allowance'
import { buildChatContext, trimContext } from '../lib/chatContext'
import { currentMonthKey, shiftMonth, todayKey } from '../lib/calculations'
import { monthsEndingAt, windowRange } from '../lib/insights'
import { supabase } from '../lib/supabaseClient'
import type { ChatMessage, ChatThread, Person } from '../types'
import { useBudgetAlerts } from './useBudgetAlerts'
import { useBudget, useMonthCategories } from './useBudgets'
import { useDeviceUser } from './useDeviceUser'
import { useProjects } from './useCategories'
import { useExpensesBetween } from './useExpenses'
import { useIncomesBetween } from './useIncomes'
import { useSavingsOverview } from './useSavings'
import { t } from '../i18n'

export const chatKey = ['chat'] as const

/** Earlier turns sent along with a question: enough for the thread to make sense. */
const HISTORY_TURNS = 30

export class ChatUnavailableError extends Error {}

function missingTable(error: { code?: string; message?: string }) {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /does not exist|schema cache/i.test(error.message ?? '')
  )
}

/** Every thread, most recently active first. `available` is false until migration 0008 has been run. */
export function useThreads() {
  return useQuery({
    queryKey: [...chatKey, 'threads'],
    queryFn: async (): Promise<{ available: boolean; threads: ChatThread[] }> => {
      const { data, error } = await supabase
        .from('ai_threads')
        .select('id, title, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(100)
      if (error) {
        if (missingTable(error)) return { available: false, threads: [] }
        throw error
      }
      return { available: true, threads: (data ?? []) as ChatThread[] }
    },
  })
}

export function useMessages(threadId: string | null) {
  return useQuery({
    queryKey: [...chatKey, 'messages', threadId],
    enabled: !!threadId,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('id, thread_id, role, content, person, created_at')
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as ChatMessage[]
    },
  })
}

/**
 * Everything the AI gets to see, rebuilt from what the app already has
 * cached: this month and the plans, a year of expenses, income, savings.
 * `ready` once the data has loaded.
 */
export function useChatContext() {
  const month = currentMonthKey()
  const { from, to } = windowRange(monthsEndingAt(month, 12))
  const incomeRange = windowRange(monthsEndingAt(month, 3))
  const categories = useMonthCategories(month)
  const { data: projects = [] } = useProjects()
  const expenses = useExpensesBetween(from, to)
  const incomes = useIncomesBetween(incomeRange.from, incomeRange.to)
  const next = useBudget(shiftMonth(month, 1))
  const { all: alerts } = useBudgetAlerts()
  const savings = useSavingsOverview()
  const { person: me } = useDeviceUser()

  const ready = !!categories.data && !!expenses.data && !!incomes.data && !savings.isLoading
  const build = () =>
    trimContext(
      buildChatContext({
        month,
        today: todayKey(),
        // the month's categories, plus the projects it keeps apart
        // without the other one's allowance, which is theirs alone
        categories: ownCategories([...(categories.data ?? []), ...projects], me),
        expenses: ownExpenses(expenses.data ?? [], categories.data ?? [], me),
        incomes: incomes.data ?? [],
        planThisMonth: categories.plan,
        planNextMonth: next.data ?? null,
        alerts,
        savings: {
          available: savings.available,
          accounts: savings.accounts,
          goals: savings.goals,
          movements: savings.movements,
          savedThisMonth: savings.savedThisMonth,
        },
      }),
    )
  return { ready, build }
}

/**
 * Asks a question: saves it (starting a thread when there's none), sends the
 * thread and the data to /api/chat, saves the answer. Resolves to the thread id.
 */
export function useAsk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      threadId: string | null
      question: string
      person: Person
      context: Record<string, unknown>
    }): Promise<string> => {
      const question = args.question.trim()
      let threadId = args.threadId
      if (!threadId) {
        const { data, error } = await supabase
          .from('ai_threads')
          .insert({ title: question.slice(0, 80) })
          .select('id')
          .single()
        if (error) throw error
        threadId = String(data.id)
      }
      const asked = await supabase
        .from('ai_messages')
        .insert({ thread_id: threadId, role: 'user', content: question, person: args.person })
      if (asked.error) throw asked.error
      void qc.invalidateQueries({ queryKey: [...chatKey, 'messages', threadId] })

      const { data: history, error } = await supabase
        .from('ai_messages')
        .select('role, content')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_TURNS)
      if (error) throw error

      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error(t('errors.notSignedIn'))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ context: args.context, history: [...(history ?? [])].reverse() }),
      })
      if (res.status === 404) {
        throw new ChatUnavailableError(
          t('errors.aiUnavailable'),
        )
      }
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? t('errors.requestFailed', { status: res.status }))

      const answered = await supabase
        .from('ai_messages')
        .insert({ thread_id: threadId, role: 'assistant', content: String(body.reply) })
      if (answered.error) throw answered.error
      await supabase
        .from('ai_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId)
      return threadId
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: chatKey })
    },
  })
}

export function useDeleteThread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ai_threads').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: chatKey })
    },
  })
}
