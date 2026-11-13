import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkExpense, isUuid, monthStatus, sameExpense, todayIn } from '../_month.js'
import { adminRest } from '../_supabase.js'
import { authorize, BUDGET_ZONE, rows } from '../_tokens.js'
import { loadMonth, loadPeople } from '../_v1.js'

/*
 * POST /api/v1/expenses   (key with 'write')
 *
 *   { "amount": 23.5, "category_id": "…", "person": "anna", "note": "…", "date": "2026-11-13" }
 *
 * Adds one expense, the way the Add tab does. `person` may be left out when
 * the key was made for one; `date` defaults to today and may go back 31 days,
 * never ahead; `note` is optional. Monthly categories only.
 *
 * `Idempotency-Key: <uuid>` becomes the expense's id: sending the same
 * request again (a retry after a timeout) answers with the stored expense and
 * adds nothing; the same key with different content is refused (409).
 *
 * 201 with the expense and its category's month after it; 200 for a repeat.
 */

const FIELDS = 'id,amount,category_id,person,note,expense_date,created_at'
type Stored = {
  id: string
  amount: number
  category_id: string
  person: string
  note: string | null
  expense_date: string
  created_at: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = await authorize(req, res, 'write')
    if (!token) return
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

    const key = req.headers['idempotency-key']
    if (key !== undefined && !isUuid(key)) return res.status(400).json({ error: 'invalid_idempotency_key' })
    const id = (key as string | undefined)?.toLowerCase() ?? randomUUID()

    const today = todayIn(BUDGET_ZONE)
    const [month, people] = await Promise.all([loadMonth(today.slice(0, 7)), loadPeople()])
    const checked = checkExpense(req.body, {
      today,
      categories: month.categories,
      people: people.map((p) => p.id),
      tokenPerson: token.person,
    })
    if (!checked.ok) return res.status(400).json({ error: checked.error })

    const insert = await adminRest(`expenses?select=${FIELDS}`, {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({ id, ...checked.expense }),
    })
    let stored: Stored | undefined
    let repeat = false
    if (insert.status === 409) {
      // the id is taken: the same request again, or the key reused for another
      stored = (await rows<Stored>(`expenses?select=${FIELDS}&id=eq.${id}`))[0]
      if (!stored || !sameExpense(stored, checked.expense)) {
        return res.status(409).json({ error: 'idempotency_conflict' })
      }
      repeat = true
    } else if (!insert.ok) {
      throw new Error(`insert: ${insert.status} ${await insert.text()}`)
    } else {
      stored = ((await insert.json()) as Stored[])[0]
    }

    // the category's month with this expense in it (the expense may be dated in another month)
    const after = stored.expense_date.slice(0, 7) === today.slice(0, 7) && repeat
      ? month
      : await loadMonth(stored.expense_date.slice(0, 7))
    const category = monthStatus(after.categories, after.expenses, after.budget).find(
      (c) => c.id === stored!.category_id,
    )
    return res.status(repeat ? 200 : 201).json({
      expense: { ...stored, amount: Number(stored.amount) },
      repeat,
      category: category ?? null,
    })
  } catch (error) {
    console.error('v1/expenses', error)
    return res.status(502).json({ error: 'upstream_failed' })
  }
}
