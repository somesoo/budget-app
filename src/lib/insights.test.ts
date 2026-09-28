import { describe, expect, it } from 'vitest'
import { paceStatus } from './insights'

describe('paceStatus', () => {
  // 3000 over 30 days: 1000 by day 10
  it('is under pace more than 10% below', () => {
    expect(paceStatus(899, 3000, 10, 30)).toBe('under')
  })
  it('is on pace within ±10%', () => {
    expect(paceStatus(900, 3000, 10, 30)).toBe('on')
    expect(paceStatus(1000, 3000, 10, 30)).toBe('on')
    expect(paceStatus(1100, 3000, 10, 30)).toBe('on')
  })
  it('is over pace more than 10% above', () => {
    expect(paceStatus(1101, 3000, 10, 30)).toBe('over')
  })
  it('has nothing to say without a limit or before the month', () => {
    expect(paceStatus(100, 0, 10, 30)).toBeNull()
    expect(paceStatus(100, 3000, 0, 30)).toBeNull()
  })
})
