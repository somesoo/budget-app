import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { ProjectSummary } from '../lib/projects'
import type { Category, Goal } from '../types'
import { categoriesKey, useCategories } from './useCategories'
import { useGoals } from './useGoal'
import { useProjectSummaries } from './useProjectSummaries'

export interface GoalTrip {
  goal: Goal
  /** What's been spent from it; undefined until its category exists. */
  trip: ProjectSummary | undefined
}

/**
 * Savings goals as trips: each can be spent from, through a category of kind
 * 'project' linked by goal_id (migration 0009 keeps one per goal). Spending
 * from a goal stays out of the monthly budget.
 */
export function useGoalTrips() {
  const qc = useQueryClient()
  const { data: goals = [], isLoading } = useGoals()
  const { data: categories = [] } = useCategories()
  const projects = useProjectSummaries()

  const tripOf = (goalId: string) => projects.all.find((p) => p.project.goal_id === goalId)
  const all: GoalTrip[] = goals.map((goal) => ({ goal, trip: tripOf(goal.id) }))

  /**
   * The goal's category, made on the spot if it's missing: a database that
   * hasn't run migration 0009 doesn't make one when a goal is added.
   */
  const ensureTrip = async (goal: Goal): Promise<Category> => {
    const existing = categories.find((c) => c.kind === 'project' && c.goal_id === goal.id)
    if (existing) return existing
    const sort_order = categories.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: goal.name,
        color: goal.color,
        monthly_limit: 0,
        kind: 'project',
        budget_total: goal.target_amount > 0 ? goal.target_amount : null,
        goal_id: goal.id,
        sort_order,
      })
      .select('id')
      .single()
    if (error) throw error
    await qc.invalidateQueries({ queryKey: categoriesKey })
    return {
      id: String(data.id),
      name: goal.name,
      color: goal.color,
      monthly_limit: 0,
      sort_order,
      archived: false,
      show_in_chart: true,
      kind: 'project',
      budget_total: goal.target_amount > 0 ? goal.target_amount : null,
      starts_on: null,
      ends_on: null,
      goal_id: goal.id,
      owner: null,
    }
  }

  return {
    isLoading: isLoading || projects.isLoading,
    all,
    open: all.filter((g) => !g.goal.archived),
    tripOf,
    expensesOf: projects.expensesOf,
    ensureTrip,
  }
}
