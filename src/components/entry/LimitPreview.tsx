import { Warning } from '@phosphor-icons/react'
import { formatMoneyWhole } from '../../lib/calculations'
import { limitImpact } from '../../lib/alerts'
import type { Category } from '../../types'
import { CHART } from '../charts/theme'

interface Props {
  category: Category
  /** Already spent in the category this month. */
  spent: number
  amount: number
  /** A trip or project: measured against its whole budget, not a month. */
  project?: boolean
}

/**
 * The category's month before and after this expense, against its limit, so
 * going over is something you see before saving rather than after.
 */
export function LimitPreview({ category, spent, amount, project = false }: Props) {
  const limit = project ? (category.budget_total ?? 0) : category.monthly_limit
  if (limit <= 0) return null
  const impact = limitImpact(spent, amount, limit)
  const scale = Math.max(impact.after, limit)
  const pct = (v: number) => `${(Math.min(v, scale) / scale) * 100}%`
  const warn = impact.levelAfter !== 'ok'

  return (
    <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-slate-300">
          {category.name}
          {amount > 0 ? ' after this' : project ? ' so far' : ' this month'}
        </span>
        <span className="shrink-0 tabular-nums text-white">
          {formatMoneyWhole(amount > 0 ? impact.after : impact.before)}{' '}
          <span className="text-muted">/ {formatMoneyWhole(limit)}</span>
        </span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-white/10" aria-hidden>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/40"
          style={{ width: pct(impact.before) }}
        />
        {amount > 0 && (
          <div
            className="absolute inset-y-0 rounded-full transition-[width] duration-300"
            style={{
              left: pct(impact.before),
              width: `calc(${pct(impact.after)} - ${pct(impact.before)})`,
              backgroundColor: warn ? CHART.warning : CHART.accent,
            }}
          />
        )}
        {impact.after > limit && (
          <div className="absolute -top-1 h-4 w-0.5 bg-slate-50" style={{ left: pct(limit) }} />
        )}
      </div>
      <p
        className="mt-2 flex items-center gap-1.5 text-sm"
        style={{ color: warn ? CHART.warning : CHART.textMuted }}
      >
        {warn && <Warning weight="fill" aria-hidden className="shrink-0" />}
        {impact.levelAfter === 'over'
          ? `${formatMoneyWhole(impact.overBy)} over the ${project ? 'budget' : 'limit'}`
          : impact.levelAfter === 'near'
            ? `${Math.round((impact.after / limit) * 100)}% of the ${project ? 'budget' : 'limit'}, ${formatMoneyWhole(impact.left)} left`
            : `${formatMoneyWhole(impact.left)} left in ${category.name}`}
      </p>
    </div>
  )
}
