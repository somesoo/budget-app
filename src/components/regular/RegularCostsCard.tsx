import { ArrowsClockwise, CalendarBlank, Check, Plus, Warning } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeviceUser } from '../../hooks/useDeviceUser'
import { usePaidDues, usePayRecurring, useRecurringCosts } from '../../hooks/useRecurring'
import { useSavingsOverview } from '../../hooks/useSavings'
import { formatDayShort, formatMoneyWhole, todayKey } from '../../lib/calculations'
import {
  daysUntil,
  dueForReview,
  fundShouldHold,
  isRare,
  nextDue,
  payState,
  perMonth,
  regularTotals,
  type PaidDue,
} from '../../lib/recurring'
import type { RecurringCost } from '../../types'
import { CHART } from '../charts/theme'
import { RecurringSheet, everyLabel } from './RecurringSheet'
import { ReviewSheet } from './ReviewSheet'
import { t } from '../../i18n'

/** Due within this many days: marked on the list. */
const SOON_DAYS = 14

type Sheet =
  | { kind: 'edit'; cost?: RecurringCost; as?: RecurringCost['kind']; note?: string }
  | { kind: 'review' }
  | null

/**
 * Subscriptions and the bills that come back: what they cost a month and a
 * year, what's due soon, and for the rarer bills (car insurance, a yearly
 * subscription) how much to put aside each month so they never catch the
 * budget out, against what the bills fund has.
 */
export function RegularCostsCard() {
  const { data } = useRecurringCosts()
  const savings = useSavingsOverview()
  const [sheet, setSheet] = useState<Sheet>(null)
  const { data: paidDues } = usePaidDues()
  const pay = usePayRecurring()
  const { person } = useDeviceUser()
  if (!data?.available) return null

  // marking one paid logs it as an expense in its category, dated today
  const paid = paidDues?.available ? paidDues.paid : null
  const markPaid = (cost: RecurringCost, due: string) => {
    if (!cost.category_id) {
      setSheet({ kind: 'edit', cost, note: t('regular.needsCategory') })
      return
    }
    if (person) pay.mutate({ cost, due, date: todayKey(), person })
  }

  const today = todayKey()
  const open = data.costs.filter((c) => !c.archived)
  const subs = open.filter((c) => c.kind === 'subscription')
  const bills = open.filter((c) => c.kind === 'bill')
  const totals = regularTotals(open)
  const review = dueForReview(open, today)
  const fund = savings.goals.find((g) => g.goal.is_bills_fund && !g.goal.archived)
  const shouldHold = fundShouldHold(open, today)
  const rare = open.filter(isRare)
  // by the date each shows: one waiting to be marked paid first
  const shownDue = (c: RecurringCost) => {
    const state = paidDues?.available ? payState(c, today, paidDues.paid) : null
    return state?.kind === 'due' ? state.due : nextDue(c, today)
  }
  const byDue = (a: RecurringCost, b: RecurringCost) => shownDue(a).localeCompare(shownDue(b))

  return (
    <section
      aria-labelledby="regular"
      data-tour="regular-costs"
      className="mb-6 rounded-3xl p-4 ring-1 ring-white/10"
      style={{ backgroundColor: CHART.surface }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="regular" className="text-base font-semibold text-white">
            {t('regular.title')}
          </h2>
          <p className="mt-0.5 text-sm text-slate-300">
            {open.length === 0
              ? t('regular.intro')
              : t('regular.totals', {
                  monthly: formatMoneyWhole(totals.monthly),
                  yearly: formatMoneyWhole(totals.yearly),
                })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSheet({ kind: 'edit' })}
          className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-accent-soft hover:bg-accent/10"
        >
          <Plus weight="bold" aria-hidden /> {t('common.add')}
        </button>
      </div>

      {review.length > 0 && (
        <button
          type="button"
          onClick={() => setSheet({ kind: 'review' })}
          className="mt-3 flex w-full items-start gap-2 rounded-2xl bg-amber-300/10 px-3 py-2.5 text-left text-sm text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-300/15"
        >
          <Warning weight="fill" className="mt-0.5 shrink-0" style={{ color: CHART.warning }} aria-hidden />
          <span>
            {t('regular.reviewDue', { count: review.length })}{' '}
            <span className="font-semibold underline underline-offset-2">{t('regular.reviewNow')}</span>
          </span>
        </button>
      )}

      <Group
        title={t('regular.subscriptions')}
        sum={subs.reduce((s, c) => s + perMonth(c), 0)}
        empty={t('regular.subsEmpty')}
        onAdd={() => setSheet({ kind: 'edit', as: 'subscription' })}
        costs={[...subs].sort(byDue)}
        today={today}
        paid={paid}
        onPay={markPaid}
        onPick={(cost) => setSheet({ kind: 'edit', cost })}
      />
      <Group
        title={t('regular.bills')}
        sum={bills.reduce((s, c) => s + perMonth(c), 0)}
        empty={t('regular.billsEmpty')}
        onAdd={() => setSheet({ kind: 'edit', as: 'bill' })}
        costs={[...bills].sort(byDue)}
        today={today}
        paid={paid}
        onPay={markPaid}
        onPick={(cost) => setSheet({ kind: 'edit', cost })}
      />

      {rare.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
          <p className="text-sm text-white">
            {t('regular.setAside', { amount: formatMoneyWhole(totals.setAside) })}
          </p>
          {fund ? (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-300">
              {fund.saved + 0.5 >= shouldHold ? (
                <Check weight="bold" className="mt-0.5 shrink-0 text-positive" aria-hidden />
              ) : (
                <Warning weight="fill" className="mt-0.5 shrink-0" style={{ color: CHART.warning }} aria-hidden />
              )}
              <span>
                {fund.saved + 0.5 >= shouldHold
                  ? t('regular.fundOk', { name: fund.goal.name, saved: formatMoneyWhole(fund.saved) })
                  : t('regular.fundShort', {
                      name: fund.goal.name,
                      saved: formatMoneyWhole(fund.saved),
                      should: formatMoneyWhole(shouldHold),
                    })}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-300">
              {t('regular.noFund')}{' '}
              <Link to="/savings" className="font-semibold text-accent-soft hover:underline">
                {t('regular.pickFund')}
              </Link>
            </p>
          )}
        </div>
      )}

      {sheet?.kind === 'edit' && (
        <RecurringSheet
          cost={sheet.cost}
          kind={sheet.as}
          note={sheet.note}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'review' && <ReviewSheet costs={review} onClose={() => setSheet(null)} />}
    </section>
  )
}

function Group({
  title,
  sum,
  empty,
  onAdd,
  costs,
  today,
  paid,
  onPay,
  onPick,
}: {
  title: string
  sum: number
  empty: string
  onAdd: () => void
  costs: RecurringCost[]
  today: string
  /** Due dates logged as expenses; null before migration 0022, when there's no paying. */
  paid: PaidDue[] | null
  onPay: (cost: RecurringCost, due: string) => void
  onPick: (cost: RecurringCost) => void
}) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {costs.length > 0 && (
          <span className="text-xs tabular-nums text-muted">
            {t('regular.perMonth', { amount: formatMoneyWhole(sum) })}
          </span>
        )}
      </div>
      {costs.length === 0 ? (
        <button type="button" onClick={onAdd} className="text-sm text-muted hover:text-white">
          {empty}
        </button>
      ) : (
        <ul className="divide-y divide-white/5">
          {costs.map((c) => {
            const state = paid ? payState(c, today, paid) : ({ kind: 'none' } as const)
            // one waiting to be marked paid shows the date it was due, not the next
            const overdue = state.kind === 'due' && state.due < today
            const due = overdue ? state.due : nextDue(c, today)
            const days = daysUntil(due, today)
            const soon = days <= SOON_DAYS
            return (
              <li key={c.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left hover:bg-white/[0.02]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-white">{c.name}</span>
                    <span className={`flex items-center gap-1 text-xs ${soon ? 'text-amber-200' : 'text-muted'}`}>
                      <CalendarBlank aria-hidden />
                      {overdue
                        ? t('regular.wasDue', { date: formatDayShort(due) })
                        : days === 0
                        ? t('regular.dueToday')
                        : soon
                          ? t('regular.dueIn', { count: days, date: formatDayShort(due) })
                          : formatDayShort(due)}
                      {' · '}
                      {everyLabel(c.every_months)}
                      {c.auto_log && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-accent-soft">
                          <ArrowsClockwise aria-hidden />
                          {t('regular.auto')}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[15px] font-semibold tabular-nums text-white">
                      {formatMoneyWhole(c.amount)}
                    </span>
                    {isRare(c) && (
                      <span className="block text-xs tabular-nums text-muted">
                        {t('regular.perMonth', { amount: formatMoneyWhole(perMonth(c)) })}
                      </span>
                    )}
                  </span>
                </button>
                {state.kind === 'paid' ? (
                  <span className="flex w-[4.75rem] shrink-0 items-center justify-center gap-1 text-xs font-semibold text-positive">
                    <Check weight="bold" aria-hidden />
                    {t('regular.paidDone')}
                  </span>
                ) : state.kind === 'due' || state.kind === 'soon' ? (
                  <button
                    type="button"
                    onClick={() => onPay(c, state.due)}
                    aria-label={t('regular.markPaidLabel', {
                      name: c.name,
                      amount: formatMoneyWhole(c.amount),
                    })}
                    className={`w-[4.75rem] shrink-0 rounded-full py-1.5 text-xs font-semibold ring-1 transition ${
                      state.kind === 'due'
                        ? 'bg-amber-300/15 text-amber-100 ring-amber-300/30 hover:bg-amber-300/25'
                        : 'text-slate-200 ring-white/15 hover:bg-white/5'
                    }`}
                  >
                    {t('regular.markPaid')}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
