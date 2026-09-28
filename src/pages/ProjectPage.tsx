import { AirplaneTilt, ArrowLeft, PencilSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { RecentEntries } from '../components/add/RecentEntries'
import { EntryDialogs } from '../components/history/EntryDialogs'
import { ProjectSheet } from '../components/projects/ProjectSheet'
import { TripSpendingCard, WhereItWent } from '../components/projects/TripSpending'
import { useCategories } from '../hooks/useCategories'
import { useEntryActions } from '../hooks/useEntryActions'
import { useProjectSummaries } from '../hooks/useProjectSummaries'
import { categoryById, formatDayLong } from '../lib/calculations'
import { toEntries } from '../lib/history'
import type { ProjectSummary } from '../lib/projects'

/**
 * `/project/:id`: a trip or project across all its months. Since goals and
 * trips are one thing (migration 0009), a trip tied to a goal lives on the
 * goal's page; this one is left for a trip without a goal, on a database that
 * hasn't run that migration yet.
 */
export function ProjectPage() {
  const { id = '' } = useParams()
  const projects = useProjectSummaries()
  const { data: categories = [] } = useCategories()
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

  const { project } = summary
  if (project.goal_id) return <Navigate to={`/savings/goal/${project.goal_id}`} replace />
  const expenses = projects.expensesOf(id)
  return (
    <Frame
      title={project.name}
      color={project.color}
      subtitle={dates(summary)}
      onEdit={() => setEditing(true)}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="space-y-6">
          <TripSpendingCard summary={summary} />

          <section>
            <h2 className="mb-2 text-base font-semibold text-white">Every expense</h2>
            {expenses.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing yet. Tie it to a savings goal in Edit, then add expenses from the Goals tile on the Add tab.
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
          <WhereItWent expenses={expenses} />
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
