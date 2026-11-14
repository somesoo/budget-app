import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isMonth, monthStatus, todayIn } from '../_month.js'
import { appUrl, authorize, BUDGET_ZONE } from '../_tokens.js'
import { loadMonth } from '../_v1.js'

/*
 * GET /api/v1/month[?month=YYYY-MM]   (key with 'read')
 *
 * The month category by category: limit (the month's plan, else the
 * category's default), spent, remaining and whether it's ok, near (80%) or
 * over. Monthly categories only; a project's spending is in the app.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!(await authorize(req, res, 'read'))) return
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
    const today = todayIn(BUDGET_ZONE)
    const month = req.query.month === undefined ? today.slice(0, 7) : req.query.month
    if (!isMonth(month)) return res.status(400).json({ error: 'invalid_month' })
    const { categories, expenses, budget } = await loadMonth(month)
    const base = appUrl(req)
    return res.status(200).json({
      month,
      currency: 'PLN',
      today,
      has_plan: budget !== null,
      categories: monthStatus(categories, expenses, budget).map((c) => ({
        ...c,
        link: base ? `${base}/category/${c.id}` : null,
      })),
      links: base ? { app: base, budget: `${base}/budget` } : null,
    })
  } catch (error) {
    console.error('v1/month', error)
    return res.status(502).json({ error: 'upstream_failed' })
  }
}
