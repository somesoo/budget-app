import type { Category, Expense, Person } from '../types'

/*
 * An allowance is one person's money nobody has to explain. The other phone
 * doesn't show its tile, its spending or its entries: it only counts in the
 * month's totals, and warns once it goes over its limit.
 */

/** A category that is the other person's allowance, as seen from this device. */
export const isOthersAllowance = (
  category: Pick<Category, 'owner'> | null | undefined,
  me: Person | null,
) => !!category?.owner && category.owner !== me

/** The categories this device shows one by one. */
export const ownCategories = <C extends Pick<Category, 'owner'>>(
  categories: C[],
  me: Person | null,
) => categories.filter((c) => !isOthersAllowance(c, me))

/** Expenses this device shows one by one: all but those in the other's allowance. */
export function ownExpenses<E extends Pick<Expense, 'category_id'>>(
  expenses: E[],
  categories: Pick<Category, 'id' | 'owner'>[],
  me: Person | null,
): E[] {
  const hidden = new Set(categories.filter((c) => isOthersAllowance(c, me)).map((c) => c.id))
  return hidden.size === 0 ? expenses : expenses.filter((e) => !hidden.has(e.category_id))
}
