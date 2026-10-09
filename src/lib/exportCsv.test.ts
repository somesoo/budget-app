import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseClient', () => ({ supabase: {} }))

const { toCsv } = await import('./exportCsv')

describe('toCsv', () => {
  it('lists expenses and income together, newest first, quoting what needs it', () => {
    const csv = toCsv(
      [
        {
          id: 'e1',
          amount: 12.5,
          category_id: 'c1',
          person: 'bubs',
          note: 'Coffee, "the good one"',
          expense_date: '2026-09-02',
          created_at: '2026-09-02T08:00:00Z',
        },
      ],
      [
        {
          id: 'i1',
          amount: 7200,
          person: 'meow',
          note: 'Salary',
          income_date: '2026-09-10',
          for_month: null,
          one_off: false,
          created_at: '2026-09-10T08:00:00Z',
        },
      ],
      [
        {
          id: 'c1',
          name: 'Eating out',
          color: '#000',
          monthly_limit: 0,
          sort_order: 0,
          archived: false,
          show_in_chart: true,
          kind: 'monthly',
          budget_total: null,
          starts_on: null,
          ends_on: null,
          goal_id: null,
          owner: null,
          spending_group: null,
        },
      ],
    )
    expect(csv.split('\r\n')).toEqual([
      'date,type,amount,category,note,person',
      '2026-09-10,income,7200.00,,Salary,Meow',
      '2026-09-02,expense,12.50,Eating out,"Coffee, ""the good one""",Bubs',
      '',
    ])
  })
})
