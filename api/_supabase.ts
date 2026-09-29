import type { VercelRequest } from '@vercel/node'

/*
 * The server's way into Supabase, shared by the /api functions.
 *
 * Each value is read under our own name or under the one the Supabase
 * integration on Vercel creates, whichever is set:
 *   URL          VITE_SUPABASE_URL, SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL
 *   public key   VITE_SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY, …
 *   secret key   SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY
 * The secret key is server-only (never VITE_). Without it the app still
 * works, but the first account has to be made in the Supabase dashboard and
 * the Gemini key can only come from GEMINI_API_KEY.
 */

const first = (...names: string[]) => names.map((n) => process.env[n]).find(Boolean)

export const supabaseUrl = () =>
  first('VITE_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')?.replace(/\/+$/, '')

export const publicKey = () =>
  first(
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  )

const secretKey = () => first('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')

export const hasSecretKey = () => Boolean(supabaseUrl() && secretKey())

/**
 * A legacy service_role key is a JWT and goes in both headers; a new secret
 * key (sb_secret_…) only as apikey, the gateway does the rest.
 */
function adminHeaders(): Record<string, string> {
  const key = secretKey()!
  return key.startsWith('eyJ')
    ? { apikey: key, authorization: `Bearer ${key}` }
    : { apikey: key }
}

/** Whether the request carries a valid session of this budget's account. */
export async function isSignedIn(req: VercelRequest): Promise<boolean> {
  const url = supabaseUrl()
  const key = publicKey()
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!url || !key || !token) return false
  const who = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, authorization: `Bearer ${token}` },
  })
  return who.ok
}

/** Whether the budget's account exists yet. */
export async function hasAccount(): Promise<boolean> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/admin/users?page=1&per_page=1`, {
    headers: adminHeaders(),
  })
  if (!res.ok) throw new Error(`Supabase admin API: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as { users?: unknown[] }
  return (body.users?.length ?? 0) > 0
}

/**
 * Makes the budget's one account, confirmed so it can sign in straight away.
 * Returns an error message for the person, or null when it's made.
 */
export async function createAccount(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...adminHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (res.ok) return null
  const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string }
  console.error('create account', res.status, body)
  return body.msg ?? body.message ?? `Supabase refused (${res.status})`
}

/** A value from app_secrets (migration 0018), or undefined. */
export async function readSecret(name: string): Promise<string | undefined> {
  if (!hasSecretKey()) return undefined
  const res = await fetch(
    `${supabaseUrl()}/rest/v1/app_secrets?select=value&name=eq.${encodeURIComponent(name)}`,
    { headers: adminHeaders() },
  )
  // before migration 0018 the table isn't there: no stored secrets
  if (!res.ok) return undefined
  const rows = (await res.json()) as { value: string }[]
  return rows[0]?.value || undefined
}

/** Stores a value in app_secrets, or removes it with null. */
export async function writeSecret(name: string, value: string | null): Promise<void> {
  const base = `${supabaseUrl()}/rest/v1/app_secrets`
  const res =
    value === null
      ? await fetch(`${base}?name=eq.${encodeURIComponent(name)}`, {
          method: 'DELETE',
          headers: adminHeaders(),
        })
      : await fetch(base, {
          method: 'POST',
          headers: {
            ...adminHeaders(),
            'content-type': 'application/json',
            prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ name, value, updated_at: new Date().toISOString() }),
        })
  if (!res.ok) throw new Error(`Saving ${name}: ${res.status} ${await res.text()}`)
}
