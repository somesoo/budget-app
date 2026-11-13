import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { t } from '../i18n'
import { supabase } from '../lib/supabaseClient'

/** A key another app uses (api/v1). The key itself is never listed, only what it may do. */
export interface ApiToken {
  id: string
  name: string
  scopes: ('read' | 'write')[]
  /** Whose expenses it adds; null when the other app names the person. */
  person: string | null
  created_at: string
  last_used_at: string | null
}

export interface ApiTokens {
  /** Whether the server can keep keys (it has the Supabase secret key). */
  canStore: boolean
  tokens: ApiToken[]
}

const key = ['api-tokens'] as const

/** Thrown when the server functions aren't there (plain `npm run dev`). */
export class ApiTokensUnavailableError extends Error {}

async function call<T>(path = '', init?: RequestInit): Promise<T> {
  const { data: session } = await supabase.auth.getSession()
  const token = session.session?.access_token
  if (!token) throw new Error(t('errors.notSignedIn'))
  const res = await fetch(`/api/tokens${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => null)
  if (!body) throw new ApiTokensUnavailableError(t('errors.aiUnavailable'))
  if (!res.ok) {
    throw new Error(
      body.code === 'too_many'
        ? t('settings.apps.tooMany')
        : body.code === 'invalid'
          ? t('settings.apps.invalid')
          : (body.error ?? t('errors.requestFailed', { status: res.status })),
    )
  }
  return body as T
}

export function useApiTokens() {
  return useQuery({ queryKey: key, queryFn: () => call<ApiTokens>(), retry: false })
}

/** Makes a key. The result's `token` is the only time the key is ever shown. */
export function useCreateApiToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; scopes: ('read' | 'write')[]; person: string | null }) =>
      call<{ token: string; created: ApiToken }>('', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

/** Revokes a key: it stops working at once. */
export function useRevokeApiToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      call<ApiTokens>(`?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: (list) => qc.setQueryData(key, list),
  })
}
