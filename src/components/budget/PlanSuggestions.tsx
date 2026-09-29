import { Check, Lightbulb, Warning } from '@phosphor-icons/react'
import { formatMoneyWhole, roundMoney } from '../../lib/calculations'
import type { PlanCheck, Recurring, Suggestion } from '../../lib/suggestions'
import type { Category } from '../../types'
import { CHART } from '../charts/theme'
import { t } from '../../i18n'

/** What the history suggests for the draft, each one click from applied. */
export function SuggestionList({
  suggestions,
  onApply,
  compact = false,
}: {
  suggestions: Suggestion[]
  onApply: (s: Suggestion) => void
  /** Inside a category's own view, where its name is already the heading. */
  compact?: boolean
}) {
  return (
    <ul className="space-y-2">
      {suggestions.map((s) => (
        <li
          key={s.id}
          className={`flex gap-3 rounded-2xl ring-1 ring-white/10 ${compact ? 'bg-white/5 p-3' : 'bg-white/[0.04] p-3'}`}
        >
          <Lightbulb aria-hidden weight="fill" className="mt-0.5 shrink-0 text-accent-soft" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">{s.title}</p>
            <p className="mt-0.5 text-sm leading-snug text-slate-300">{s.detail}</p>
          </div>
          <button
            type="button"
            onClick={() => onApply(s)}
            className="h-8 shrink-0 self-center rounded-full bg-accent/15 px-3 text-sm font-semibold text-accent-soft ring-1 ring-accent/30 hover:bg-accent/25"
          >
            {t('planner.apply')}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** The part of the month that's already certain: payments that come every month. */
export function RecurringList({
  items,
  categories,
}: {
  items: Recurring[]
  categories: Record<string, Category>
}) {
  const total = roundMoney(items.reduce((a, r) => a + r.amount, 0))
  return (
    <div>
      <p className="text-sm text-slate-300">
        {t('planner.recurringIntro', { amount: formatMoneyWhole(total) })}
      </p>
      <ul className="mt-2 grid gap-1">
        {items.map((r) => (
          <li key={`${r.categoryId}:${r.note}`} className="flex items-baseline gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-white">
              {r.note}
              <span className="text-muted">
                {' '}
                {t('planner.inCategory', {
                  name: categories[r.categoryId]?.name ?? t('planner.hiddenCategory'),
                })}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-200">
              {formatMoneyWhole(r.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A read of the draft before saving. Informs, never blocks. */
export function PlanCheckList({ checks }: { checks: PlanCheck[] }) {
  return (
    <ul className="space-y-1.5">
      {checks.map((c) => (
        <li key={c.text} className="flex gap-2 text-sm leading-snug">
          {c.ok ? (
            <Check aria-hidden weight="bold" className="mt-0.5 shrink-0 text-positive" />
          ) : (
            <Warning
              aria-hidden
              weight="fill"
              className="mt-0.5 shrink-0"
              style={{ color: CHART.warning }}
            />
          )}
          <span className={c.ok ? 'text-slate-300' : 'text-white'}>{c.text}</span>
        </li>
      ))}
    </ul>
  )
}
