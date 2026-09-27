import { AirplaneTilt, CaretRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { formatMoneyWhole } from '../../lib/calculations'
import type { ProjectSummary } from '../../lib/projects'
import { CHART } from '../charts/theme'

/** Goals spent from, like trips, on the Budget tab: outside the month, so shown on their own. */
export function ProjectsCard({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) return null
  return (
    <section className="mt-6" aria-labelledby="projects-card">
      <h2 id="projects-card" className="mb-3 text-base font-semibold text-white">
        Spent from goals
      </h2>
      <ul className="grid gap-2">
        {projects.map(({ project, spent, budget, left }) => (
          <li key={project.id}>
            <Link
              to={project.goal_id ? `/savings/goal/${project.goal_id}` : `/project/${project.id}`}
              className="group block rounded-2xl bg-white/5 p-3.5 ring-1 ring-white/10 hover:bg-white/[0.08]"
            >
              <div className="flex items-center gap-2">
                <AirplaneTilt weight="fill" aria-hidden style={{ color: project.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                  {project.name}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-slate-300">
                  {formatMoneyWhole(spent)}
                  {budget ? ` / ${formatMoneyWhole(budget)}` : ''}
                </span>
                <CaretRight
                  aria-hidden
                  className="shrink-0 text-muted transition group-hover:translate-x-0.5"
                />
              </div>
              {budget ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(spent / budget, 1) * 100}%`,
                      backgroundColor: left !== null && left < 0 ? CHART.warning : project.color,
                    }}
                  />
                </div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
