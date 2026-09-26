import { AirplaneTilt } from '@phosphor-icons/react'
import { formatAmount } from '../../lib/calculations'
import type { ProjectSummary } from '../../lib/projects'
import type { Category } from '../../types'

/**
 * Trips and other projects, above the monthly tiles: they don't start over
 * each month, so each shows its running total against its whole budget.
 */
export function ProjectStrip({
  projects,
  onSelect,
}: {
  projects: ProjectSummary[]
  onSelect: (project: Category) => void
}) {
  if (projects.length === 0) return null
  return (
    <div className="no-scrollbar -mx-4 mb-3 flex shrink-0 gap-2 overflow-x-auto px-4">
      {projects.map(({ project, spent, budget }) => (
        <button
          key={project.id}
          type="button"
          onClick={() => onSelect(project)}
          className="flex shrink-0 items-center gap-2 rounded-2xl py-2 pl-3 pr-4 text-left ring-1 ring-white/10 transition active:scale-[0.97]"
          style={{ backgroundColor: `${project.color}29` }}
        >
          <AirplaneTilt
            weight="fill"
            aria-hidden
            className="shrink-0"
            style={{ color: project.color }}
          />
          <span>
            <span className="block text-sm font-semibold leading-tight text-white">
              {project.name}
            </span>
            <span className="block text-xs tabular-nums leading-tight text-slate-300">
              {formatAmount(Math.round(spent))}
              {budget ? ` of ${formatAmount(budget)}` : ''} zł
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
