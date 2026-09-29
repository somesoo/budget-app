import { Warning } from '@phosphor-icons/react'
import { formatMoneyWhole, roundMoney } from '../../lib/calculations'
import type { ProjectSummary } from '../../lib/projects'
import type { Expense } from '../../types'
import { CHART } from '../charts/theme'
import { t } from '../../i18n'

/** Items listed by what they were (their notes), biggest first. */
const TOP_ITEMS = 5

/** What a trip (or a goal spent from) has cost against its budget, and how it's going. */
export function TripSpendingCard({ summary }: { summary: ProjectSummary }) {
  const { project, spent, budget, left } = summary
  const progress = budget ? Math.min(spent / budget, 1) : null
  const over = left !== null && left < 0
  return (
    <section className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 lg:p-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('common.spent')} value={formatMoneyWhole(spent)} />
        <Stat
          label={t('project.budget')}
          value={budget ? formatMoneyWhole(budget) : t('category.none')}
        />
        <Stat
          label={over ? t('project.overBy') : t('project.left')}
          value={left === null ? t('project.noBudget') : formatMoneyWhole(Math.abs(left))}
          warn={over}
        />
      </div>
      {progress !== null && (
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: over ? CHART.warning : project.color,
            }}
          />
        </div>
      )}
      <p className="mt-3 flex items-start gap-1.5 text-sm leading-snug text-slate-300">
        {over && (
          <Warning weight="fill" className="mt-0.5 shrink-0" style={{ color: CHART.warning }} />
        )}
        {phaseLine(summary)}
      </p>
    </section>
  )
}

/** The biggest things it went on, by what they were called. */
export function WhereItWent({ expenses }: { expenses: Expense[] }) {
  const byNote = new Map<string, number>()
  for (const e of expenses) {
    const key = e.note?.trim() || t('project.untitled')
    byNote.set(key, (byNote.get(key) ?? 0) + e.amount)
  }
  const items = [...byNote.entries()]
    .map(([note, amount]) => ({ note, amount: roundMoney(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, TOP_ITEMS)
  if (items.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-white">{t('project.whereItWent')}</h2>
      <ul className="grid gap-1.5">
        {items.map((it) => (
          <li key={it.note} className="flex items-baseline gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-slate-200">{it.note}</span>
            <span className="shrink-0 font-semibold tabular-nums text-white">
              {formatMoneyWhole(it.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function phaseLine(s: ProjectSummary): string {
  const count = s.days ?? 0
  switch (s.phase) {
    case 'upcoming':
      return s.spent > 0
        ? t('project.startsInPaid', { count, amount: formatMoneyWhole(s.spent) })
        : t('project.startsIn', { count })
    case 'running':
      return s.perDayLeft !== null
        ? t('project.runningPerDay', {
            count,
            amount: formatMoneyWhole(Math.floor(s.perDayLeft)),
          })
        : t('project.running', { count })
    case 'finished':
      return s.left !== null
        ? s.left >= 0
          ? t('project.finishedUnder', { amount: formatMoneyWhole(s.left) })
          : t('project.finishedOver', { amount: formatMoneyWhole(-s.left) })
        : t('project.finished')
    default:
      return t('project.undated')
  }
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted">{label}</p>
      <p
        className="truncate text-lg font-bold tabular-nums text-white"
        style={warn ? { color: CHART.warning } : undefined}
      >
        {value}
      </p>
    </div>
  )
}
