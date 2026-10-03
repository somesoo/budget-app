import { currentMonthKey, roundMoney } from '../lib/calculations'
import { balancesOf, currentBalance, planDebts } from '../lib/debts'
import { monthsEndingAt } from '../lib/insights'
import { netWorthHistory } from '../lib/wealth'
import { useDebts } from './useDebts'
import { useSavings } from './useSavings'

/** Months of net worth history drawn. */
export const NET_WORTH_MONTHS = 12

/** Debts with what's owed, and net worth over the last year: savings and debts together. */
export function useWealth() {
  const savings = useSavings()
  const debts = useDebts()
  const list = debts.data?.debts ?? []
  const balances = debts.data?.balances ?? []
  const movements = savings.data?.movements ?? []
  const months = monthsEndingAt(currentMonthKey(), NET_WORTH_MONTHS)

  const owed = (id: string) => currentBalance(balances, id)
  const history = (id: string) => {
    const own = balancesOf(balances, id)
    return months.map((m) => {
      const found = own.find((b) => b.balance_date.slice(0, 7) <= m)
      return found?.balance ?? 0
    })
  }

  return {
    available: debts.data?.available ?? false,
    isLoading: savings.isLoading || debts.isLoading,
    debts: list,
    balances,
    owed,
    history,
    totalOwed: roundMoney(list.reduce((s, d) => s + owed(d.id), 0)),
    planInput: planDebts(list, balances),
    netWorth: netWorthHistory({ months, movements, debts: list, balances }),
    /** The latest month a debt was first logged in: net worth before it leaves that debt out. */
    debtsKnownFrom: list.reduce<string | null>((latest, d) => {
      const own = balancesOf(balances, d.id)
      const first = own[own.length - 1]?.balance_date.slice(0, 7)
      return first && (!latest || first > latest) ? first : latest
    }, null),
  }
}
