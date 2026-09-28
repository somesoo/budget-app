import { ArrowLeft, PencilSimple, Plus } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RecentEntries } from '../components/add/RecentEntries'
import { AskLink } from '../components/AskLink'
import { TooltipRow } from '../components/charts/ChartCard'
import { ColumnChart } from '../components/charts/ColumnChart'
import { CHART } from '../components/charts/theme'
import { EntryDialogs } from '../components/history/EntryDialogs'
import { TripSpendingCard, WhereItWent } from '../components/projects/TripSpending'
import { AccountSheet, ACCOUNT_KINDS, ownerLabel } from '../components/savings/AccountSheet'
import { StatusLine } from '../components/savings/cards'
import { GoalSheet } from '../components/savings/GoalSheet'
import { MoneySheet, type MoneyMode } from '../components/savings/MoneySheet'
import { MovementList } from '../components/savings/MovementList'
import { useGoals } from '../hooks/useGoal'
import { useCategories } from '../hooks/useCategories'
import { useEntryActions } from '../hooks/useEntryActions'
import { useGoalTrips } from '../hooks/useGoalTrips'
import { useSavingsOverview } from '../hooks/useSavings'
import {
  categoryById,
  currentMonthKey,
  formatDayLong,
  formatMoney,
  formatMoneyWhole,
  formatMonth,
  formatMonthShort,
  monthKeyOfDate,
  roundMoney,
  shiftMonth,
} from '../lib/calculations'
import { toEntries } from '../lib/history'
import { monthsEndingAt } from '../lib/insights'
import { balanceHistory, projectBalance } from '../lib/savings'

type Sheet = { kind: 'money'; mode: MoneyMode; goalId?: string } | { kind: 'edit' } | null

/** `/savings/account/:id`: one account's balance over time, what it holds for which goal, every movement. */
export function SavingsAccountPage() {
  const { id = '' } = useParams()
  const s = useSavingsOverview()
  const { data: goals = [] } = useGoals()
  const [sheet, setSheet] = useState<Sheet>(null)
  const navigate = useNavigate()
  const summary = s.accounts.find((a) => a.account.id === id)

  if (s.isLoading) return <Frame back="/savings" title="Account" loading />
  if (!summary)
    return (
      <Frame back="/savings" title="Account">
        Nothing here: the account may have been removed.
      </Frame>
    )

  const { account, balance, allocated, unassigned, byGoal } = summary
  const mine = s.movements.filter((m) => m.account_id === id)
  const month = currentMonthKey()
  const first = mine.reduce<string | null>((min, m) => {
    const k = monthKeyOfDate(m.movement_date)
    return min === null || k < min ? k : min
  }, null)
  const months = monthsEndingAt(month, 12).filter((m) => !first || m >= first)
  const history = balanceHistory(mine, months)
  const interest = roundMoney(
    mine.filter((m) => m.kind === 'interest').reduce((a, m) => a + m.amount, 0),
  )

  // what went in lately, per month: the projection assumes it carries on
  const since = shiftMonth(month, -3)
  const recent =
    mine
      .filter(
        (m) =>
          (m.kind === 'deposit' || m.kind === 'withdrawal') &&
          monthKeyOfDate(m.movement_date) >= since &&
          monthKeyOfDate(m.movement_date) < month,
      )
      .reduce((a, m) => a + m.amount, 0) / 3
  const year = projectBalance(balance, account.interest_rate, Math.max(recent, 0), 12)
  const inAYear = year[year.length - 1]
  const earned = roundMoney(inAYear - balance - Math.max(recent, 0) * 12)

  const goalShares = Object.entries(byGoal)
    .map(([goalId, amount]) => ({ goal: goals.find((g) => g.id === goalId), amount }))
    .filter((x) => x.goal)
    .sort((a, b) => b.amount - a.amount)

  return (
    <Frame
      back="/savings"
      title={account.name}
      color={account.color}
      subtitle={`${ACCOUNT_KINDS[account.kind]} · ${ownerLabel(account.owner)}${
        account.interest_rate != null ? ` · ${account.interest_rate}% a year` : ''
      }`}
      onEdit={() => setSheet({ kind: 'edit' })}
      actions={
        <Actions
          onPick={(mode) => setSheet({ kind: 'money', mode })}
          modes={['deposit', 'withdraw', 'interest', 'balance', 'transfer']}
        />
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="space-y-6">
          <section className="grid grid-cols-3 gap-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <Stat label="Balance" value={formatMoneyWhole(balance)} />
            <Stat label="Set aside" value={formatMoneyWhole(allocated)} />
            <Stat label="Unassigned" value={formatMoneyWhole(unassigned)} />
          </section>

          {history.length > 1 && (
            <section
              className="rounded-3xl p-4 ring-1 ring-white/10"
              style={{ backgroundColor: CHART.surface }}
            >
              <h2 className="text-base font-semibold text-white">Balance at month end</h2>
              {interest > 0 && (
                <p className="mt-0.5 text-sm text-slate-300">
                  {formatMoneyWhole(interest)} of it is interest.
                </p>
              )}
              <div className="mt-3">
                <ColumnChart
                  ariaLabel={`${account.name} balance at the end of each month`}
                  emphasize={month}
                  columns={history.map((p) => ({
                    key: p.month,
                    label: formatMonthShort(p.month),
                    value: Math.max(p.balance, 0),
                    tooltip: (
                      <>
                        <p className="mb-1 text-slate-400">{formatMonth(p.month)}</p>
                        <TooltipRow label="Balance" value={formatMoney(p.balance)} />
                        {p.interest > 0 && (
                          <TooltipRow label="Interest so far" value={formatMoney(p.interest)} />
                        )}
                      </>
                    ),
                  }))}
                />
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-base font-semibold text-white">Movements</h2>
            <MovementList
              movements={mine}
              accounts={s.accounts.map((a) => a.account)}
              goals={goals}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Set aside for</h2>
              <button
                type="button"
                onClick={() => setSheet({ kind: 'money', mode: 'allocate' })}
                className="rounded-full px-3 py-1.5 text-sm font-semibold text-accent-soft hover:bg-accent/10"
              >
                Assign
              </button>
            </div>
            {goalShares.length === 0 ? (
              <p className="text-sm text-muted">No goal has money on this account yet.</p>
            ) : (
              <ul className="grid gap-1.5">
                {goalShares.map(({ goal, amount }) => (
                  <li key={goal!.id}>
                    <Link
                      to={`/savings/goal/${goal!.id}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-white/10 hover:bg-white/5"
                    >
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: goal!.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-white">
                        {goal!.name}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-white">
                        {formatMoneyWhole(amount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <h2 className="text-base font-semibold text-white">In a year</h2>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">
              {formatMoneyWhole(inAYear)}
            </p>
            <p className="mt-1 text-sm leading-snug text-slate-300">
              {recent > 0
                ? `If ${formatMoneyWhole(recent)} a month keeps going in, as lately`
                : 'With nothing more put in'}
              {account.interest_rate
                ? `, plus about ${formatMoneyWhole(Math.max(earned, 0))} interest at ${account.interest_rate}% before the 19% tax.`
                : '. Add its interest rate to see what it earns.'}
            </p>
          </section>
        </div>
      </div>

      {sheet?.kind === 'money' && (
        <MoneySheet
          mode={sheet.mode}
          accounts={s.accounts}
          goals={s.goals}
          accountId={id}
          goalId={sheet.goalId}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'edit' && (
        <AccountSheet
          account={account}
          onClose={() => setSheet(null)}
          onDeleted={() => navigate('/savings')}
        />
      )}
    </Frame>
  )
}

/**
 * `/savings/goal/:id`: how far a goal is, where its money is, what went in and
 * out for it, and, since a goal is also a trip, what's been spent from it.
 */
export function SavingsGoalPage() {
  const { id = '' } = useParams()
  const s = useSavingsOverview()
  const trips = useGoalTrips()
  const { data: categories = [] } = useCategories()
  const actions = useEntryActions()
  const [sheet, setSheet] = useState<Sheet>(null)
  const summary = s.goals.find((g) => g.goal.id === id)

  if (s.isLoading) return <Frame back="/savings" title="Goal" loading />
  if (!summary)
    return (
      <Frame back="/savings" title="Goal">
        Nothing here: the goal may have been removed.
      </Frame>
    )

  const { goal, saved, progress, funding, status, pace, remaining } = summary
  const mine = s.movements.filter((m) => m.goal_id === id)
  const trip = trips.tripOf(id)
  const spending = trip ? trips.expensesOf(trip.project.id) : []
  const tripDates = trip ? datesOf(trip.project.starts_on, trip.project.ends_on) : null

  return (
    <Frame
      back="/savings"
      title={goal.name}
      color={goal.color}
      subtitle={
        [
          goal.target_amount > 0
            ? `Target ${formatMoneyWhole(goal.target_amount)}${
                goal.target_date ? ` by ${formatMonth(goal.target_date.slice(0, 7))}` : ''
              }`
            : 'No finish line',
          tripDates,
        ]
          .filter(Boolean)
          .join(' · ')
      }
      onEdit={() => setSheet({ kind: 'edit' })}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Actions
            onPick={(mode) => setSheet({ kind: 'money', mode, goalId: id })}
            modes={['deposit', 'withdraw', 'allocate', 'transfer']}
          />
          <AskLink question={`How do we get to ${goal.name} in time, and what would it take?`} />
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 lg:p-5">
            <p className="text-sm text-muted">Saved</p>
            <p className="text-3xl font-bold tabular-nums text-white">{formatMoneyWhole(saved)}</p>
            {progress !== null && (
              <>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${progress * 100}%`, backgroundColor: goal.color }}
                  />
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {Math.round(progress * 100)}%
                  {remaining > 0 && `, ${formatMoneyWhole(remaining)} to go`}
                </p>
              </>
            )}
            <div className="mt-3">
              <StatusLine status={status} pace={pace} />
            </div>
            {goal.note && <p className="mt-3 text-sm text-slate-300">{goal.note}</p>}
          </section>

          {trip && (
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">Spent from it</h2>
              {spending.length > 0 && <TripSpendingCard summary={trip} />}
              {spending.length === 0 ? (
                <p className="text-sm text-muted">
                  Nothing yet. Add what it costs from the Goals tile on the Add tab: it stays out
                  of the monthly budget.
                </p>
              ) : (
                <div className="mt-3">
                  <RecentEntries
                    entries={toEntries(spending, [])}
                    categories={categoryById(categories)}
                    onOpen={actions.edit}
                  />
                </div>
              )}
            </section>
          )}

          <section>
            <h2 className="mb-2 text-base font-semibold text-white">Put in and taken out</h2>
            <MovementList
              movements={mine}
              accounts={s.accounts.map((a) => a.account)}
              goals={[goal]}
              showAccount
            />
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-base font-semibold text-white">Where the money is</h2>
            {funding.length === 0 ? (
              <p className="text-sm text-muted">Nothing set aside for it on any account yet.</p>
            ) : (
              <ul className="grid gap-1.5">
                {funding.map((f) => (
                  <li key={f.account.id}>
                    <Link
                      to={`/savings/account/${f.account.id}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-white/10 hover:bg-white/5"
                    >
                      <span
                        aria-hidden
                        className="h-6 w-1.5 rounded-full"
                        style={{ backgroundColor: f.account.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-white">
                        {f.account.name}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-white">
                        {formatMoneyWhole(f.amount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <WhereItWent expenses={spending} />
        </div>
      </div>

      {sheet?.kind === 'money' && (
        <MoneySheet
          mode={sheet.mode}
          accounts={s.accounts}
          goals={s.goals}
          goalId={sheet.goalId}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'edit' && <GoalSheet goal={goal} onClose={() => setSheet(null)} />}
      <EntryDialogs actions={actions} categories={categories} />
    </Frame>
  )
}

/* ---------- bits ---------- */

function datesOf(from: string | null, to: string | null): string | null {
  if (from && to) return `${formatDayLong(from)} to ${formatDayLong(to)}`
  if (from) return `From ${formatDayLong(from)}`
  if (to) return `Until ${formatDayLong(to)}`
  return null
}

function Frame({
  back,
  title,
  color,
  subtitle,
  onEdit,
  actions,
  loading,
  children,
}: {
  back: string
  title: string
  color?: string
  subtitle?: string
  onEdit?: () => void
  actions?: ReactNode
  loading?: boolean
  children?: ReactNode
}) {
  return (
    <div className="mx-auto min-h-[100dvh] max-w-md px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)] lg:max-w-6xl lg:px-8 lg:pb-12 lg:pt-8">
      <header className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-3">
        <Link
          to={back}
          aria-label="Back to Savings"
          className="-ml-2 rounded-full p-2 text-2xl text-muted hover:bg-white/5"
        >
          <ArrowLeft />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            {color && (
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 rounded"
                style={{ backgroundColor: color }}
              />
            )}
            <span className="truncate">{title}</span>
          </h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
          >
            <PencilSimple aria-hidden /> Edit
          </button>
        )}
        {actions && <div className="w-full">{actions}</div>}
      </header>
      {loading ? <div className="h-64 animate-pulse rounded-3xl bg-white/5" /> : children}
    </div>
  )
}

const ACTION_LABEL: Record<MoneyMode, string> = {
  deposit: 'Save money',
  withdraw: 'Take out',
  interest: 'Interest',
  balance: 'Update balance',
  allocate: 'Assign',
  transfer: 'Move',
}

function Actions({ modes, onPick }: { modes: MoneyMode[]; onPick: (m: MoneyMode) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      {modes.map((m, i) => (
        <button
          key={m}
          type="button"
          onClick={() => onPick(m)}
          className={
            i === 0
              ? 'flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-4 text-sm font-bold text-ink hover:bg-slate-50'
              : 'h-10 shrink-0 rounded-full px-4 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5'
          }
        >
          {i === 0 && <Plus weight="bold" aria-hidden />}
          {ACTION_LABEL[m]}
        </button>
      ))}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted">{label}</p>
      <p className="truncate text-lg font-bold tabular-nums text-white">{value}</p>
    </div>
  )
}
