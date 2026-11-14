import { createHash, randomBytes } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminRest, hasSecretKey } from './_supabase.js'

/*
 * Keys for other apps (migration 0023, Settings → Other apps).
 *
 * A key is `bud_` and 32 random bytes. The database keeps its SHA-256 only:
 * the key is high-entropy, so a plain hash is enough and a leaked table opens
 * nothing. A request shows it as `Authorization: Bearer bud_…`.
 */

export const TOKEN_PREFIX = 'bud_'
export const SCOPES = ['read', 'write'] as const
export type Scope = (typeof SCOPES)[number]
/** Keys in use at once; a household needs a handful. */
export const MAX_TOKENS = 10

export interface AppToken {
  id: string
  name: string
  scopes: Scope[]
  person: string | null
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const newToken = () => TOKEN_PREFIX + randomBytes(32).toString('base64url')

function bearer(req: VercelRequest): string | null {
  const header = req.headers.authorization ?? ''
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1]
  return token && token.startsWith(TOKEN_PREFIX) && token.length <= 100 ? token : null
}

/**
 * The key a request carries when it may do `scope`; otherwise the answer has
 * been sent and this returns null. One answer for a missing, unknown and
 * revoked key, so a caller can't tell which.
 */
export async function authorize(
  req: VercelRequest,
  res: VercelResponse,
  scope: Scope,
): Promise<AppToken | null> {
  res.setHeader('cache-control', 'no-store')
  if (!hasSecretKey()) {
    res.status(503).json({ error: 'server_not_configured' })
    return null
  }
  const token = bearer(req)
  const found = token
    ? await adminRest(
        `api_tokens?select=id,name,scopes,person,last_used_at&revoked_at=is.null&token_hash=eq.${hashToken(token)}`,
      )
    : null
  if (found && !found.ok) throw new Error(`api_tokens: ${found.status}`)
  const row = found ? ((await found.json()) as (AppToken & { last_used_at: string | null })[])[0] : undefined
  if (!row) {
    res.setHeader('www-authenticate', 'Bearer')
    res.status(401).json({ error: 'unauthorized' })
    return null
  }
  if (!row.scopes.includes(scope)) {
    res.status(403).json({ error: 'scope_required', scope })
    return null
  }
  // "last used" to the hour is enough for the list in Settings
  if (!row.last_used_at || Date.now() - Date.parse(row.last_used_at) > 3_600_000) {
    await adminRest(`api_tokens?id=eq.${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    }).catch(() => undefined)
  }
  return { id: row.id, name: row.name, scopes: row.scopes, person: row.person }
}

/** Rows from a table through the secret key, or a thrown error naming it. */
export async function rows<T>(path: string): Promise<T[]> {
  const res = await adminRest(path)
  if (!res.ok) throw new Error(`${path.split('?')[0]}: ${res.status}`)
  return (await res.json()) as T[]
}

/** The app's own address, for links back to the detail. */
export function appUrl(req: VercelRequest): string | null {
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0].trim()
  if (!host) return null
  const proto = String(req.headers['x-forwarded-proto'] ?? 'https').split(',')[0].trim()
  return `${proto}://${host}`
}

/** Where the budget's days are counted (the app writes the phone's local date). */
export const BUDGET_ZONE = process.env.BUDGET_TIMEZONE || 'Europe/Warsaw'
