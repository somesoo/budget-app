import { useState } from 'react'
import { SummaryBars } from '../components/SummaryBars'
import { GoalProgress } from '../components/GoalProgress'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Screen } from '../components/Screen'
import { useCategories } from '../hooks/useCategories'
import { useExpenses } from '../hooks/useExpenses'
import { useAddToGoal, useGoal } from '../hooks/useGoal'
import { PERSON_LABELS } from '../config'
import {
  currentMonthKey,
  formatMoney,
  sumByCategory,
  sumByPerson,
  sumExpenses,
} from '../lib/calculations'
import { PERSONS } from '../types'

export function Summary() {
  const [month, setMonth] = useState(currentMonthKey())
  const { data: categories = [] } = useCategories()
  const { data: expenses = [] } = useExpenses(month)
  const { data: goal } = useGoal()
  const addToGoal = useAddToGoal()

  const total = sumExpenses(expenses)
  const byCategory = sumByCategory(expenses)
  const byPerson = sumByPerson(expenses)
  const totalLimit = categories.reduce((acc, c) => acc + c.monthly_limit, 0)

  return (
    <Screen title="Summary" action={<MonthSwitcher month={month} onChange={setMonth} />}>
      <div className="mb-6 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
        <p className="text-sm text-muted">Spent this month</p>
        <p className="text-4xl font-bold tabular-nums text-white">{formatMoney(total)}</p>
        {totalLimit > 0 && (
          <p className="mt-1 text-sm text-muted">
            of {formatMoney(totalLimit)} in limits · {Math.round((total / totalLimit) * 100)}%
          </p>
        )}
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Who spent what
        </h2>
        <div className="flex gap-3">
          {PERSONS.map((person) => {
            const value = byPerson[person]
            const share = total > 0 ? Math.round((value / total) * 100) : 0
            return (
              <div key={person} className="flex-1 rounded-2xl bg-white/5 p-3">
                <p className="text-xs text-muted">{PERSON_LABELS[person]}</p>
                <p className="text-xl font-bold tabular-nums text-white">{formatMoney(value)}</p>
                <p className="text-xs text-muted">{share}% of spending</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Categories
        </h2>
        <SummaryBars categories={categories} spentByCategory={byCategory} />
      </section>

      {goal && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Goal: {goal.name}
          </h2>
          <GoalProgress
            goal={goal}
            pending={addToGoal.isPending}
            onAdd={(delta) => addToGoal.mutate({ goalId: goal.id, delta })}
          />
        </section>
      )}
    </Screen>
  )
}
