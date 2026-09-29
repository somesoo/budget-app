import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { t } from '../i18n'
import { supabase } from '../lib/supabaseClient'

/** What /api/gemini-key says about the key. It never sends the key itself. */
export interface GeminiKeyStatus {
  /** 'server': GEMINI_API_KEY, which wins; 'app': saved in Settings; null: none. */
  source: 'server' | 'app' | null
  /** The key's last four characters. */
  hint: string | null
  /** Whether the server can save a key (it has the Supabase secret key). */
  canStore: boolean
}

const key = ['gemini-key'] as const

/** Thrown when the server functions aren't there (plain `npm run dev`). */
export class GeminiKeyUnavailableError extends Error {}

async function call(init?: RequestInit): Promise<GeminiKeyStatus> {
  const { data: session } = await supabase.auth.getSession()
  const token = session.session?.access_token
  if (!token) throw new Error(t('errors.notSignedIn'))
  const res = await fetch('/api/gemini-key', {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => null)
  if (!body) throw new GeminiKeyUnavailableError(t('errors.aiUnavailable'))
  if (!res.ok) {
    throw new Error(
      body.code === 'invalid'
        ? t('settings.ai.invalid')
        : (body.error ?? t('errors.requestFailed', { status: res.status })),
    )
  }
  return body as GeminiKeyStatus
}

export function useGeminiKey() {
  return useQuery({ queryKey: key, queryFn: () => call(), retry: false })
}

/** Saves a key (checked with Google first), or removes the saved one with null. */
export function useSaveGeminiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (value: string | null) =>
      call({ method: 'POST', body: JSON.stringify({ key: value }) }),
    onSuccess: (status) => qc.setQueryData(key, status),
  })
}
