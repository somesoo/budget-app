import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authorize } from '../_tokens.js'
import { loadCategories, loadPeople } from '../_v1.js'

/*
 * GET /api/v1/categories   (key with 'read')
 *
 * What an expense can be added to and by whom: the active monthly
 * categories and the people. `person` is the one this key adds for, when it
 * was made for one; an allowance (`owner`) takes only its owner's expenses.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = await authorize(req, res, 'read')
    if (!token) return
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
    const [categories, people] = await Promise.all([loadCategories(), loadPeople()])
    return res.status(200).json({
      person: token.person,
      can_add: token.scopes.includes('write'),
      people,
      categories: categories
        .filter((c) => c.kind === 'monthly' && !c.archived)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((c) => ({ id: c.id, name: c.name, color: c.color, owner: c.owner })),
    })
  } catch (error) {
    console.error('v1/categories', error)
    return res.status(502).json({ error: 'upstream_failed' })
  }
}
