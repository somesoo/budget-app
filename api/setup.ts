import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createAccount, hasAccount, hasSecretKey } from './_supabase.js'

/*
 * The welcome screen of a new install.
 *
 * GET  /api/setup   { canCreate, needsAccount }: whether the server can make
 *                   the account (it has the Supabase secret key) and whether
 *                   there's none yet
 * POST /api/setup   { email, password }: makes the budget's one account.
 *                   Refused once one exists; the database refuses a second
 *                   one too (migration 0016), so a race can't make two.
 *
 * No sign-in needed: there's nobody to sign in as yet.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('cache-control', 'no-store')
  if (!hasSecretKey()) {
    return res.status(200).json({ canCreate: false, needsAccount: null })
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ canCreate: true, needsAccount: !(await hasAccount()) })
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use GET or POST' })

    const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown }
    if (typeof email !== 'string' || !EMAIL.test(email.trim()) || email.length > 200) {
      return res.status(400).json({ error: 'Invalid email', code: 'email' })
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > 72) {
      return res.status(400).json({ error: 'Password too short', code: 'password' })
    }
    if (await hasAccount()) {
      return res.status(409).json({ error: 'This budget already has its account', code: 'exists' })
    }
    const error = await createAccount(email.trim().toLowerCase(), password)
    if (error) return res.status(502).json({ error })
    return res.status(201).json({ ok: true })
  } catch (error) {
    console.error('setup', error)
    return res.status(502).json({ error: 'Could not reach Supabase' })
  }
}
