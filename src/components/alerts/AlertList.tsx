import { CaretRight, Warning, WarningCircle, X } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import type { BudgetAlert } from '../../lib/alerts'
import { CHART } from '../charts/theme'

/** Over a limit is red; close to one or heading over it, amber. Always with an icon and words. */
export const alertColor = (a: BudgetAlert) => (a.kind === 'over' ? '#fca5a5' : CHART.warning)

export function AlertIcon({ alert, className = '' }: { alert: BudgetAlert; className?: string }) {
  const Icon = alert.kind === 'over' ? WarningCircle : Warning
  return (
    <Icon weight="fill" aria-hidden className={className} style={{ color: alertColor(alert) }} />
  )
}

/** Where a warning leads: its category, or the month's pace in Insights. */
export const alertHref = (a: BudgetAlert) =>
  a.category ? `/category/${a.category.id}?month=${a.id.slice(0, 7)}` : '/insights'

/** The month's warnings, each dismissible and one click from the details. */
export function AlertList({
  alerts,
  onDismiss,
}: {
  alerts: BudgetAlert[]
  onDismiss: (alert: BudgetAlert) => void
}) {
  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li
          key={a.id}
          className="group relative flex gap-3 rounded-2xl bg-white/[0.04] py-3 pl-3 pr-11 ring-1 ring-white/10"
        >
          <AlertIcon alert={a} className="mt-0.5 shrink-0 text-lg" />
          {a.private ? (
            // the other one's allowance: nothing behind it to open
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{a.title}</p>
              <p className="mt-0.5 text-sm leading-snug text-slate-300">{a.detail}</p>
            </div>
          ) : (
            <Link to={alertHref(a)} className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-sm font-semibold text-white">
                {a.title}
                <CaretRight
                  aria-hidden
                  className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-white"
                />
              </p>
              <p className="mt-0.5 text-sm leading-snug text-slate-300">{a.detail}</p>
            </Link>
          )}
          <button
            type="button"
            onClick={() => onDismiss(a)}
            aria-label={`Dismiss: ${a.title}`}
            title="Dismiss"
            className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-white"
          >
            <X />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** One line for the most serious warning, where there's no room for the list (the Add tab). */
export function AlertStrip({ alerts }: { alerts: BudgetAlert[] }) {
  const top = alerts[0]
  if (!top) return null
  const more = alerts.length - 1
  return (
    <Link
      to="/budget"
      className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/[0.07]"
    >
      <AlertIcon alert={top} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-slate-200">{top.title}</span>
      {more > 0 && <span className="shrink-0 text-xs text-muted">+{more} more</span>}
      <CaretRight aria-hidden className="shrink-0 text-muted" />
    </Link>
  )
}

/** Count on the Budget tab: how many warnings haven't been dismissed. */
export function AlertCount({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span
      aria-label={`${count} ${count === 1 ? 'warning' : 'warnings'}`}
      className="min-w-[1.125rem] rounded-full px-1 text-center text-[11px] font-bold leading-[1.125rem] text-ink"
      style={{ backgroundColor: CHART.warning }}
    >
      {count}
    </span>
  )
}
