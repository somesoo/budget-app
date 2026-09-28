import { describe, expect, it } from 'vitest'
import { isOthersAllowance, ownCategories, ownExpenses } from './allowance'

const cats = [
  { id: 'food', owner: null },
  { id: 'bubs', owner: 'bubs' as const },
  { id: 'meow', owner: 'meow' as const },
]

describe('allowances', () => {
  it('hides only the other one’s allowance', () => {
    expect(ownCategories(cats, 'bubs').map((c) => c.id)).toEqual(['food', 'bubs'])
    expect(isOthersAllowance(cats[2], 'bubs')).toBe(true)
    expect(isOthersAllowance(cats[1], 'bubs')).toBe(false)
    expect(isOthersAllowance(cats[0], 'bubs')).toBe(false)
  })
  it('drops the other one’s allowance expenses', () => {
    const expenses = [{ category_id: 'food' }, { category_id: 'meow' }, { category_id: 'bubs' }]
    expect(ownExpenses(expenses, cats, 'bubs')).toEqual([
      { category_id: 'food' },
      { category_id: 'bubs' },
    ])
  })
})
