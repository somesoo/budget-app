import { PERSON_LABELS } from '../config'
import type { Category, Expense, Income } from '../types'
import { supabase } from './supabaseClient'
import { todayKey } from './calculations'

/*
 * Everything logged, as one CSV a spreadsheet opens: a backup, and a way to
 * look at the data with other tools. Expenses and income in one list, newest
 * first, amounts with a dot so every locale reads them as numbers.
 */

const HEADER = ['date', 'type', 'amount', 'category', 'note', 'person']

/** One field, quoted when it holds a comma, a quote or a line break. */
function field(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toCsv(expenses: Expense[], incomes: Income[], categories: Category[]): string {
  const name = new Map(categories.map((c) => [c.id, c.name]))
  const rows = [
    ...expenses.map((e) => ({
      date: e.expense_date,
      created: e.created_at,
      cells: [
        e.expense_date,
        'expense',
        e.amount.toFixed(2),
        name.get(e.category_id) ?? '',
        e.note ?? '',
        PERSON_LABELS[e.person],
      ],
    })),
    ...incomes.map((i) => ({
      date: i.income_date,
      created: i.created_at,
      cells: [
        i.income_date,
        'income',
        i.amount.toFixed(2),
        '',
        i.note ?? '',
        PERSON_LABELS[i.person],
      ],
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created))
  return (
    [HEADER, ...rows.map((r) => r.cells)].map((r) => r.map(field).join(',')).join('\r\n') + '\r\n'
  )
}

const PAGE = 1000

async function all<T>(table: string, columns: string, order: string): Promise<T[]> {
  const out: T[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order, { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return out
  }
}

/** Fetches every expense and income and hands the browser a CSV file. Resolves to the row count. */
export async function downloadCsv(categories: Category[]): Promise<number> {
  const [expenses, incomes] = await Promise.all([
    all<Expense>(
      'expenses',
      'id, amount, category_id, person, note, expense_date, created_at',
      'expense_date',
    ),
    all<Income>('incomes', 'id, amount, person, note, income_date, created_at', 'income_date'),
  ])
  const csv = toCsv(
    expenses.map((e) => ({ ...e, amount: Number(e.amount) })),
    incomes.map((i) => ({ ...i, amount: Number(i.amount) })),
    categories,
  )
  // a BOM so Excel reads the Polish letters as UTF-8
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `budget-${todayKey()}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return expenses.length + incomes.length
}
