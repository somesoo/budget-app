import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { AdviceRequest } from '../lib/forecast'
import type { Advice } from '../types'

export const adviceKey = (month: string) => ['advice', month] as const

/** The latest stored recommendations for a month, shared by both phones. */
export function useLatestAdvice(month: string) {
  return useQuery({
    queryKey: adviceKey(month),
    queryFn: async (): Promise<Advice | null> => {
      const { data, error } = await supabase
        .from('advice')
        .select('id, month, content, created_at')
        .eq('month', month)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw error
      return (data?.[0] as Advice | undefined) ?? null
    },
  })
}

export class AdviceUnavailableError extends Error {}

/**
 * Asks the server function for fresh recommendations and stores them. The
 * Gemini key lives only on the server; the request carries the signed-in
 * user's token so strangers can't spend your quota.
 */
export function useGenerateAdvice(month: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: AdviceRequest) => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/advice', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (res.status === 404) {
        throw new AdviceUnavailableError(
          'The recommendations server isn’t running here — it works on Vercel, or locally with `vercel dev`.',
        )
      }
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)

      const { error } = await supabase.from('advice').insert({ month, content: body })
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adviceKey(month) })
    },
  })
}
