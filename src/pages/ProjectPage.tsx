import { AirplaneTilt, ArrowLeft, PencilSimple, Warning } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RecentEntries } from '../components/add/RecentEntries'
import { CHART } from '../components/charts/theme'
import { EntryDialogs } from '../components/history/EntryDialogs'
import { ProjectSheet } from '../components/projects/ProjectSheet'
import { useCategories } from '../hooks/useCategories'
import { useEntryActions } from '../hooks/useEntryActions'
import { useProjectSummaries } from '../hooks/useProjectSummaries'
import { useSavingsOverview } from '../hooks/useSavings'
import { categoryById, formatDayLong, formatMoneyWhole, roundMoney } from '../lib/calculations'
import { toEntries } from '../lib/history'
import type { ProjectSummary } from '../lib/projects'

/** Items listed by what they were (their notes), biggest first. */
const TOP_ITEMS = 5

/**
 * `/project/:id`: a trip or project across all its months. What it has cost
 * against its budget, how much a day is left while it runs, what was saved
 * for it, and every expense.
 */
export function ProjectPage() {
  const { id = '' } = useParams()
  const projects = useProjectSummaries()
  const { data: categories = [] } = useCategories()
  const savings = useSavingsOverview()
  const actions = useEntryActions()
  const [editing, setEditing] = useState(false)
  const summary = projects.all.find((p) => p.project.id === id)

  if (projects.isLoading) {
    return (
      <Frame title="Project">
        <div className="h-64 animate-pulse rounded-3xl bg-white/5" />
      </Frame>
    )
  }
  if (!summary) return <Frame title="Project">Nothing here: it may have been removed.</Frame>

  const { project, spent, budget, left } = summary
  const expenses = projects.expensesOf(id)
  const goal = project.goal_id
    ? savings.goals.find((g) => g.goal.id === project.goal_id)
    : undefined
  const progress = budget ? Math.min(spent / budget, 1) : null
  const over = left !== null && left < 0

  // the biggest things it went on, by what they were called
  const byNote = new Map<string, number>()
  for (const e of expenses) {
    const key = e.note?.trim() || 'Untitled'
    byNote.set(key, (byNote.get(key) ?? 0) + e.amount)
  }
  const items = [...byNote.entries()]
    .map(([note, amount]) => ({ note, amount: roundMoney(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, TOP_ITEMS)

  return (
    <Frame
      title={project.name}
      color={project.color}
      subtitle={dates(summary)}
      onEdit={() => setEditing(true)}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 lg:p-5">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Spent" value={formatMoneyWhole(spent)} />
              <Stat label="Budget" value={budget ? formatMoneyWhole(budget) : 'None'} />
              <Stat
                label={over ? 'Over by' : 'Left'}
                value={left === null ? 'No budget' : formatMoneyWhole(Math.abs(left))}
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
                <Warning
                  weight="fill"
                  className="mt-0.5 shrink-0"
                  style={{ color: CHART.warning }}
                />
              )}
              {phaseLine(summary)}
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-white">Every expense</h2>
            {expenses.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing yet. Add expenses to it from the Add tab, where it has its own tile.
              </p>
            ) : (
              <RecentEntries
                entries={toEntries(expenses, [])}
                categories={categoryById(categories)}
                onOpen={actions.edit}
              />
            )}
          </section>
        </div>

        <div className="space-y-6">
          {goal && (
            <section className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <h2 className="text-base font-semibold text-white">Paid from {goal.goal.name}</h2>
              <p className="mt-1 text-sm leading-snug text-slate-300">
                {formatMoneyWhole(goal.saved)} saved for it
                {budget && left !== null && left > 0
                  ? goal.saved >= left
                    ? `, which covers the ${formatMoneyWhole(left)} still to spend.`
                    : `; the ${formatMoneyWhole(left)} still to spend needs ${formatMoneyWhole(left - goal.saved)} more.`
                  : '.'}
              </p>
              <Link
                to={`/savings/goal/${goal.goal.id}`}
                className="mt-2 inline-block text-sm font-semibold text-accent-soft hover:underline"
              >
                See the goal
              </Link>
            </section>
          )}

          {items.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">Where it went</h2>
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
          )}
        </div>
      </div>

      <EntryDialogs actions={actions} categories={categories} />
      {editing && <ProjectSheet project={project} onClose={() => setEditing(false)} />}
    </Frame>
  )
}

function dates({ project }: ProjectSummary): string {
  const from = project.starts_on ? formatDayLong(project.starts_on) : null
  const to = project.ends_on ? formatDayLong(project.ends_on) : null
  if (from && to) return `${from} to ${to}`
  if (from) return `From ${from}`
  if (to) return `Until ${to}`
  return 'Trip or project'
}

function phaseLine(s: ProjectSummary): string {
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
  switch (s.phase) {
    case 'upcoming':
      return `Starts in ${days(s.days ?? 0)}.${
        s.spent > 0 ? ` ${formatMoneyWhole(s.spent)} already paid ahead.` : ''
      }`
    case 'running':
      return s.perDayLeft !== null
        ? `${days(s.days ?? 0)} to go, today included: about ${formatMoneyWhole(Math.floor(s.perDayLeft))} a day keeps it within budget.`
        : `${days(s.days ?? 0)} to go, today included.`
    case 'finished':
      return s.left !== null
        ? s.left >= 0
          ? `Finished ${formatMoneyWhole(s.left)} under budget.`
          : `Finished ${formatMoneyWhole(-s.left)} over budget.`
        : 'Finished.'
    default:
      return 'No dates: it runs until you finish it in its settings.'
  }
}

function Frame({
  title,
  color,
  subtitle,
  onEdit,
  children,
}: {
  title: string
  color?: string
  subtitle?: string
  onEdit?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto min-h-[100dvh] max-w-md px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)] lg:max-w-6xl lg:px-8 lg:pb-12 lg:pt-8">
      <header className="mb-5 flex items-center gap-3">
        <Link
          to="/budget"
          aria-label="Back to Budget"
          className="-ml-2 rounded-full p-2 text-2xl text-muted hover:bg-white/5"
        >
          <ArrowLeft />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            {color && (
              <AirplaneTilt
                weight="fill"
                aria-hidden
                className="shrink-0 text-2xl"
                style={{ color }}
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
      </header>
      {children}
    </div>
  )
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
