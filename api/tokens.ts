import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isUuid } from './_month.js'
import { adminRest, hasSecretKey, isSignedIn } from './_supabase.js'
import { hashToken, MAX_TOKENS, newToken, rows, SCOPES, type Scope } from './_tokens.js'

/*
 * Settings → Other apps: the keys other apps use (api/v1).
 *
 * GET              { canStore, tokens: [{ id, name, scopes, person, created_at, last_used_at }] }
 * POST { name, scopes, person }   makes a key; the answer carries `token`, the
 *                  only time it's ever shown
 * DELETE ?id=…     revokes one: it stops working at once
 *
 * Signed-in only. Hashes never leave the server.
 */

const LIST = 'id,name,scopes,person,created_at,last_used_at'
type Row = {
  id: string
  name: string
  scopes: Scope[]
  person: string | null
  created_at: string
  last_used_at: string | null
}

const active = () => rows<Row>(`api_tokens?select=${LIST}&revoked_at=is.null&order=created_at.asc`)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('cache-control', 'no-store')
  if (!(await isSignedIn(req))) return res.status(401).json({ error: 'Not signed in' })

  try {
    if (!hasSecretKey()) {
      if (req.method === 'GET') return res.status(200).json({ canStore: false, tokens: [] })
      return res.status(409).json({ error: 'No Supabase secret key on the server', code: 'no_store' })
    }
    if (req.method === 'GET') return res.status(200).json({ canStore: true, tokens: await active() })

    if (req.method === 'POST') {
      const body = (req.body ?? {}) as { name?: unknown; scopes?: unknown; person?: unknown }
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const scopes = Array.isArray(body.scopes) ? [...new Set(body.scopes)] : []
      const person = body.person === undefined || body.person === null ? null : body.person
      if (
        !name ||
        name.length > 40 ||
        !scopes.length ||
        !scopes.every((s) => (SCOPES as readonly unknown[]).includes(s)) ||
        (person !== null && typeof person !== 'string')
      ) {
        return res.status(400).json({ error: 'Check the name and what the key may do', code: 'invalid' })
      }
      if (person !== null) {
        const known = await rows<{ id: string }>(`people?select=id&id=eq.${encodeURIComponent(person)}`)
        if (!known.length) return res.status(400).json({ error: 'No such person', code: 'invalid' })
      }
      if ((await active()).length >= MAX_TOKENS) {
        return res.status(409).json({ error: 'Too many keys: revoke one first', code: 'too_many' })
      }
      const token = newToken()
      const made = await adminRest(`api_tokens?select=${LIST}`, {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({ name, scopes, person, token_hash: hashToken(token) }),
      })
      if (!made.ok) throw new Error(`api_tokens: ${made.status} ${await made.text()}`)
      return res.status(201).json({ token, created: ((await made.json()) as Row[])[0] })
    }

    if (req.method === 'DELETE') {
      const id = req.query.id
      if (!isUuid(id)) return res.status(400).json({ error: 'Which key?', code: 'invalid' })
      const gone = await adminRest(`api_tokens?id=eq.${id}&revoked_at=is.null`, {
        method: 'PATCH',
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      })
      if (!gone.ok) throw new Error(`api_tokens: ${gone.status}`)
      return res.status(200).json({ canStore: true, tokens: await active() })
    }
    return res.status(405).json({ error: 'Use GET, POST or DELETE' })
  } catch (error) {
    console.error('tokens', error)
    return res.status(502).json({ error: 'Could not reach Supabase' })
  }
}
