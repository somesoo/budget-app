import { roundMoney } from './calculations'

/* When spending stops keeping to the budget: the thresholds and the arithmetic
   behind every warning the app shows. */

/** Share of a limit at which a category counts as close to it. */
export const NEAR_RATIO = 0.8

export type LimitLevel = 'ok' | 'near' | 'over'

export function limitLevel(spent: number, limit: number): LimitLevel {
  if (limit <= 0) return 'ok'
  if (spent > limit) return 'over'
  return spent / limit >= NEAR_RATIO ? 'near' : 'ok'
}

export interface LimitImpact {
  before: number
  after: number
  limit: number
  levelBefore: LimitLevel
  levelAfter: LimitLevel
  /** Above the limit after this expense; 0 when within it. */
  overBy: number
  /** Still available after this expense; 0 when over. */
  left: number
}

/** What one more expense does to a category's month. */
export function limitImpact(spent: number, amount: number, limit: number): LimitImpact {
  const after = roundMoney(spent + amount)
  return {
    before: spent,
    after,
    limit,
    levelBefore: limitLevel(spent, limit),
    levelAfter: limitLevel(after, limit),
    overBy: limit > 0 ? Math.max(roundMoney(after - limit), 0) : 0,
    left: limit > 0 ? Math.max(roundMoney(limit - after), 0) : 0,
  }
}
