import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GEMINI_SECRET, geminiKey } from './_gemini.js'
import { hasSecretKey, isSignedIn, writeSecret } from './_supabase.js'

/*
 * Settings → AI: the Gemini key typed in the app.
 *
 * GET   { source, hint, canStore }: where the key in use comes from ('server'
 *       for GEMINI_API_KEY, 'app' for one saved here, null for none), its
 *       last four characters, and whether this server can save one (it needs
 *       the Supabase secret key)
 * POST  { key }: checks the key with Google, then saves it; { key: null }
 *       removes it
 *
 * Signed-in only. The key itself never goes back to the browser.
 */

async function status() {
  const found = await geminiKey()
  return {
    source: found?.source ?? null,
    hint: found ? found.key.slice(-4) : null,
    canStore: hasSecretKey(),
  }
}

/** Asks Google whether the key works, with the cheapest call there is. */
async function keyWorks(key: string): Promise<boolean> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
    headers: { 'x-goog-api-key': key },
  })
  return res.ok
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('cache-control', 'no-store')
  if (!(await isSignedIn(req))) return res.status(401).json({ error: 'Not signed in' })

  try {
    if (req.method === 'GET') return res.status(200).json(await status())
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use GET or POST' })

    if (!hasSecretKey()) {
      return res.status(409).json({ error: 'No Supabase secret key on the server', code: 'no_store' })
    }
    const { key } = (req.body ?? {}) as { key?: unknown }
    if (key === null) {
      await writeSecret(GEMINI_SECRET, null)
      return res.status(200).json(await status())
    }
    const trimmed = typeof key === 'string' ? key.trim() : ''
    if (!trimmed || trimmed.length > 200 || !(await keyWorks(trimmed))) {
      return res.status(400).json({ error: 'Google did not accept this key', code: 'invalid' })
    }
    await writeSecret(GEMINI_SECRET, trimmed)
    return res.status(200).json(await status())
  } catch (error) {
    console.error('gemini-key', error)
    return res.status(502).json({ error: 'Could not reach Supabase' })
  }
}
