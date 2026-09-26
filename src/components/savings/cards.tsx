import { CaretRight, Check, Plus, Warning, WarningCircle } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { formatMoneyWhole, formatMonth, type MonthKey } from '../../lib/calculations'
import type { AccountSummary, GoalStatus, GoalSummary } from '../../lib/savings'
import { CHART } from '../charts/theme'
import { ACCOUNT_KINDS, ownerLabel } from './AccountSheet'

/** A goal's status in words, with an icon where it needs attention. */
export function StatusLine({ status, pace }: { status: GoalStatus; pace: number }) {
  const lately = pace > 0 ? `, ${formatMoneyWhole(pace)} a month lately` : ''
  switch (status.kind) {
    case 'reached':
      return (
        <Line icon={<Check weight="bold" className="text-positive" />} tone="text-positive">
          Reached
        </Line>
      )
    case 'open':
      return <Line tone="text-slate-300">Keeps growing{lately}</Line>
    case 'no-date':
      return (
        <Line tone="text-slate-300">
          {status.eta
            ? `At this pace, there by ${formatMonth(status.eta)}`
            : 'Nothing put in lately'}
        </Line>
      )
    case 'on-track':
      return (
        <Line icon={<Check weight="bold" className="text-positive" />} tone="text-slate-300">
          On track: {formatMoneyWhole(status.neededPerMonth)} a month does it
        </Line>
      )
    case 'behind':
      return (
        <Line
          icon={<Warning weight="fill" style={{ color: CHART.warning }} />}
          tone="text-slate-200"
        >
          Needs {formatMoneyWhole(status.neededPerMonth)} a month; at this pace{' '}
          {formatMoneyWhole(status.shortfall)} short
        </Line>
      )
    case 'overdue':
      return (
        <Line icon={<WarningCircle weight="fill" className="text-red-300" />} tone="text-slate-200">
          Its date has passed, {formatMoneyWhole(status.shortfall)} to go
        </Line>
      )
  }
}

function Line({
  icon,
  tone,
  children,
}: {
  icon?: React.ReactNode
  tone: string
  children: React.ReactNode
}) {
  return (
    <p className={`flex items-start gap-1.5 text-sm leading-snug ${tone}`}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <span>{children}</span>
    </p>
  )
}

export function GoalCard({ summary, onSave }: { summary: GoalSummary; onSave: () => void }) {
  const { goal, saved, progress, funding, status, pace } = summary
  return (
    <li className="group relative rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.06]">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: goal.color }}
        />
        <div className="min-w-0 flex-1">
          <Link
            to={`/savings/goal/${goal.id}`}
            className="flex items-center gap-1 text-[15px] font-semibold text-white after:absolute after:inset-0 after:rounded-3xl"
          >
            <span className="truncate">{goal.name}</span>
            <CaretRight
              aria-hidden
              className="shrink-0 text-muted transition group-hover:translate-x-0.5"
            />
          </Link>
          <p className="mt-0.5 text-sm tabular-nums text-slate-300">
            <span className="font-semibold text-white">{formatMoneyWhole(saved)}</span>
            {goal.target_amount > 0 && ` of ${formatMoneyWhole(goal.target_amount)}`}
            {goal.target_date && (
              <span className="text-muted">
                {' '}
                · by {formatMonth(goal.target_date.slice(0, 7) as MonthKey)}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          aria-label={`Save money for ${goal.name}`}
          className="relative z-10 flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent/15 px-3 text-sm font-semibold text-accent-soft ring-1 ring-accent/30 hover:bg-accent/25"
        >
          <Plus weight="bold" aria-hidden /> Save
        </button>
      </div>

      {progress !== null && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress * 100}%`, backgroundColor: goal.color }}
          />
        </div>
      )}

      <div className="mt-2.5 space-y-1">
        <StatusLine status={status} pace={pace} />
        {funding.length > 0 && (
          <p className="truncate text-xs text-muted">
            On {funding.map((f) => `${f.account.name} ${formatMoneyWhole(f.amount)}`).join(', ')}
          </p>
        )}
      </div>
    </li>
  )
}

export function AccountCard({ summary, history }: { summary: AccountSummary; history: number[] }) {
  const { account, balance, unassigned } = summary
  return (
    <li>
      <Link
        to={`/savings/account/${account.id}`}
        className="group flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10 transition hover:bg-white/[0.06]"
      >
        <span
          aria-hidden
          className="h-9 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: account.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{account.name}</p>
          <p className="truncate text-xs text-muted">
            {ACCOUNT_KINDS[account.kind]} · {ownerLabel(account.owner)}
            {account.interest_rate != null && ` · ${account.interest_rate}%`}
          </p>
        </div>
        <Sparkline values={history} color={account.color} />
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-bold tabular-nums text-white">
            {formatMoneyWhole(balance)}
          </p>
          {unassigned > 0.5 && (
            <p className="text-xs tabular-nums text-muted">
              {formatMoneyWhole(unassigned)} unassigned
            </p>
          )}
        </div>
      </Link>
    </li>
  )
}

/** Month-end balances as a tiny line: the direction, not the numbers (those are on the account page). */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2 || values.every((v) => v === values[0]))
    return <span className="w-20 shrink-0" />
  const w = 80
  const h = 28
  const max = Math.max(...values)
  const min = Math.min(...values, 0)
  const x = (i: number) => (i / (values.length - 1)) * w
  const y = (v: number) => h - 2 - ((v - min) / (max - min || 1)) * (h - 4)
  return (
    <svg width={w} height={h} aria-hidden className="hidden shrink-0 sm:block">
      <polyline
        points={values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
