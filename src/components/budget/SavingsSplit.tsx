import { Warning } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { MoneyInput } from './MoneyInput'
import { ownerLabel } from '../savings/AccountSheet'
import type { SavingsOverview } from '../../hooks/useSavings'
import {
  allocationKey,
  defaultGoalAccount,
  isRetirementWrapper,
  otherSavings,
  retirementStatus,
  setAllocation,
  sumAllocations,
} from '../../lib/allocations'
import { formatAmount, formatMoneyCompact, type MonthKey } from '../../lib/calculations'
import { roundUpPlan } from '../../lib/planning'
import type { PlanAllocation } from '../../types'

type Split = { savings: number; allocations: PlanAllocation[] }

/**
 * The plan's savings, paid out of the paycheck: so much per goal (onto the
 * account it's kept on), so much per IKE/IKZE, the rest "other savings". The
 * total is what the zero-based sum takes.
 */
export function SavingsSplit({
  month,
  value,
  onChange,
  overview,
}: {
  month: MonthKey
  value: Split
  onChange: (next: Split) => void
  overview: SavingsOverview
}) {
  const accounts = overview.accounts.map((a) => a.account)
  const openAccounts = accounts.filter((a) => !a.archived)
  const planned = new Map(value.allocations.map((a) => [allocationKey(a), a]))

  // open goals still collecting, and any the plan already pays into
  const goals = overview.goals.filter(
    (g) =>
      planned.has(`goal:${g.goal.id}`) ||
      (!g.goal.archived && g.status.kind !== 'reached'),
  )
  const wrappers = accounts
    .filter(isRetirementWrapper)
    .filter((a) => !a.archived || planned.has(`account:${a.id}`))
  // loans from savings still owed, and any the plan already pays back
  const loans = overview.loans.filter(
    (l) => l.remaining > 0 || planned.has(`loan:${l.loan.id}`),
  )
  const goalName = new Map(overview.goals.map((g) => [g.goal.id, g.goal.name]))
  const other = otherSavings(value.savings, value.allocations)
  const year = month.slice(0, 4)

  return (
    <div className="mt-1 border-t border-white/10 pt-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-white">Savings</p>
        <p className="text-sm font-semibold tabular-nums text-white">
          {formatMoneyCompact(value.savings)}
        </p>
      </div>
      <p className="text-xs text-muted">Straight from the paycheck, before any spending.</p>

      <ul className="mt-2 space-y-2.5">
        {goals.map((g) => {
          const line = planned.get(`goal:${g.goal.id}`)
          const account_id = line?.account_id ?? defaultGoalAccount(g, accounts)
          const needed =
            g.status.kind === 'on-track' || g.status.kind === 'behind'
              ? roundUpPlan(g.status.neededPerMonth)
              : null
          const amount = line?.amount ?? 0
          const set = (v: number, acc = account_id) =>
            onChange(setAllocation(value, { goal_id: g.goal.id, account_id: acc }, v))
          return (
            <Line
              key={g.goal.id}
              color={g.goal.color}
              name={g.goal.name}
              kind="Goal"
              amount={amount}
              onAmount={(v) => set(v)}
              hints={
                <>
                  {needed !== null && needed > 0 && (
                    <Chip active={amount === needed} onClick={() => set(needed)}>
                      on time: {formatAmount(needed)}
                    </Chip>
                  )}
                  {g.remaining > 0 && (
                    <span className="text-xs text-muted">
                      {formatMoneyCompact(Math.round(g.remaining))} to go
                    </span>
                  )}
                </>
              }
              footer={
                openAccounts.length > 1 && amount > 0 ? (
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    onto
                    <select
                      value={account_id ?? ''}
                      onChange={(e) => set(amount, e.target.value || null)}
                      className="min-w-0 rounded-lg bg-white/5 px-1.5 py-0.5 text-xs text-slate-200 outline-none ring-1 ring-white/10"
                    >
                      {openAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : openAccounts.length === 0 && amount > 0 ? (
                  <p className="text-xs text-amber-200">
                    Add a savings account (Savings tab) to pay this in.
                  </p>
                ) : null
              }
            />
          )
        })}

        {wrappers.map((a) => {
          const line = planned.get(`account:${a.id}`)
          const amount = line?.amount ?? 0
          const s = retirementStatus(a, overview.movements, month)
          // what the plan puts onto this account in total, goals kept on it included
          const onIt = sumAllocations(value.allocations.filter((x) => x.account_id === a.id))
          const over = Math.round(Math.max(onIt - s.room, 0))
          const set = (v: number) =>
            onChange(setAllocation(value, { goal_id: null, account_id: a.id }, v))
          return (
            <Line
              key={a.id}
              color={a.color}
              name={a.name}
              kind={`${a.kind.toUpperCase()} · ${ownerLabel(a.owner)}`}
              amount={amount}
              onAmount={set}
              hints={
                <>
                  {s.toMaxOut > 0 && (
                    <Chip active={amount === s.toMaxOut} onClick={() => set(s.toMaxOut)}>
                      max out: {formatAmount(s.toMaxOut)}
                    </Chip>
                  )}
                  <span className="text-xs tabular-nums text-muted">
                    {s.room > 0
                      ? `${formatAmount(Math.round(s.contributed))} of ${formatAmount(s.limit)} paid in ${year}`
                      : `${year} limit reached`}
                  </span>
                </>
              }
              footer={
                <>
                  {over > 0 && (
                    <p className="flex items-center gap-1 text-xs text-red-300">
                      <Warning weight="fill" aria-hidden />
                      {formatMoneyCompact(over)} over the {year} limit — the provider will refuse it
                    </p>
                  )}
                  {String(s.limitYear) !== year && (
                    <p className="text-xs text-muted">
                      {year}’s limit isn’t known yet; using {s.limitYear}’s.
                    </p>
                  )}
                </>
              }
            />
          )
        })}

        {loans.map((l) => {
          const line = planned.get(`loan:${l.loan.id}`)
          const amount = line?.amount ?? 0
          const goal = l.loan.goal_id ? goalName.get(l.loan.goal_id) : null
          const set = (v: number) =>
            onChange(
              setAllocation(
                value,
                { goal_id: l.loan.goal_id, account_id: l.loan.account_id, loan_id: l.loan.id },
                Math.min(v, l.remaining),
              ),
            )
          return (
            <Line
              key={l.loan.id}
              color="#f59e0b"
              name={`Pay back: ${l.loan.note}`}
              kind={`to ${goal ?? 'savings'} · ${formatMoneyCompact(l.remaining)} still owed`}
              amount={amount}
              onAmount={set}
              hints={
                l.nextInstalment > 0 && (
                  <Chip active={amount === l.nextInstalment} onClick={() => set(l.nextInstalment)}>
                    instalment: {formatAmount(l.nextInstalment)}
                  </Chip>
                )
              }
            />
          )
        })}

        <li className="flex items-center gap-3">
          <div className="min-w-0 flex-1 pl-5">
            <p className="text-[15px] text-white">Other savings</p>
            <p className="text-xs text-muted">Put aside, no particular goal</p>
          </div>
          <div className="w-32 shrink-0">
            <MoneyInput
              label="Other savings"
              value={Math.max(other, 0)}
              onChange={(v) =>
                onChange({ ...value, savings: sumAllocations(value.allocations) + v })
              }
            />
          </div>
        </li>
      </ul>
    </div>
  )
}

function Line({
  color,
  name,
  kind,
  amount,
  onAmount,
  hints,
  footer,
}: {
  color: string
  name: string
  kind: string
  amount: number
  onAmount: (v: number) => void
  hints?: ReactNode
  footer?: ReactNode
}) {
  return (
    <li>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-white">{name}</p>
          <p className="truncate text-xs text-muted">{kind}</p>
        </div>
        <div className="w-32 shrink-0">
          <MoneyInput label={`${name}: from the paycheck`} value={amount} onChange={onAmount} />
        </div>
      </div>
      {(hints || footer) && (
        <div className="mt-1 space-y-1 pl-5">
          {hints && <div className="flex flex-wrap items-center gap-1.5">{hints}</div>}
          {footer}
        </div>
      )}
    </li>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2 py-0.5 text-xs tabular-nums ring-1 transition ${
        active
          ? 'bg-white/15 text-white ring-white/40'
          : 'text-muted ring-white/10 active:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

/** Whether the planner has anything to split savings between. */
export function hasSplitTargets(overview: SavingsOverview): boolean {
  return (
    overview.available &&
    (overview.goals.some((g) => !g.goal.archived && g.status.kind !== 'reached') ||
      overview.accounts.some((a) => !a.account.archived && isRetirementWrapper(a.account)) ||
      overview.loans.some((l) => l.remaining > 0))
  )
}
