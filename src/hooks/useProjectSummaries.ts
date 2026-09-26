import { projectSummary, type ProjectSummary } from '../lib/projects'
import { useProjects } from './useCategories'
import { useProjectExpenses } from './useExpenses'

/**
 * Every project with what's been spent on it so far, whatever the month.
 * `open` leaves out the finished-and-archived ones.
 */
export function useProjectSummaries() {
  const { data: projects = [], isLoading } = useProjects()
  const { data: byProject = {}, isLoading: loadingExpenses } = useProjectExpenses(
    projects.map((p) => p.id),
  )
  const all: ProjectSummary[] = projects.map((p) => projectSummary(p, byProject[p.id] ?? []))
  return {
    isLoading: isLoading || (projects.length > 0 && loadingExpenses),
    all,
    open: all.filter((s) => !s.project.archived),
    expensesOf: (id: string) => byProject[id] ?? [],
  }
}
