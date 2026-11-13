import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isMonth, monthSummary, todayIn } from '../_month.js'
import { appUrl, authorize, BUDGET_ZONE } from '../_tokens.js'
import { loadMonth } from '../_v1.js'

/*
 * GET /api/v1/summary[?month=YYYY-MM]   (key with 'read')
 *
 * The month in a few numbers: income received and planned, spent against
 * the limits, what's left, how many categories are near or over, the last
 * expense (no note). The running month when none is named. `links` lead
 * back to the app for the detail.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!(await authorize(req, res, 'read'))) return
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
    const today = todayIn(BUDGET_ZONE)
    const month = req.query.month === undefined ? today.slice(0, 7) : req.query.month
    if (!isMonth(month)) return res.status(400).json({ error: 'invalid_month' })
    const base = appUrl(req)
    return res.status(200).json({
      ...monthSummary({ month, today, ...(await loadMonth(month)) }),
      links: base ? { app: base, budget: `${base}/budget`, history: `${base}/history` } : null,
    })
  } catch (error) {
    console.error('v1/summary', error)
    return res.status(502).json({ error: 'upstream_failed' })
  }
}
