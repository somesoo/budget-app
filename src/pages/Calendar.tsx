import { useState } from 'react'
import { CalendarHeatmap } from '../components/CalendarHeatmap'
import { TransactionList } from '../components/TransactionList'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Screen } from '../components/Screen'
import { useCategories } from '../hooks/useCategories'
import { useExpenses } from '../hooks/useExpenses'
import {
  categoryById,
  currentMonthKey,
  daysInMonth,
  formatDayLong,
  formatMoney,
  sumByDay,
  sumExpenses,
} from '../lib/calculations'

export function Calendar() {
  const [month, setMonth] = useState(currentMonthKey())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const { data: categories = [] } = useCategories()
  const { data: expenses = [] } = useExpenses(month)

  const totalsByDay = sumByDay(expenses)
  const monthTotal = sumExpenses(expenses)
  const avgPerDay = monthTotal / daysInMonth(month)
  const dayExpenses = selectedDay ? expenses.filter((e) => e.expense_date === selectedDay) : []

  return (
    <Screen
      title="Calendar"
      action={
        <MonthSwitcher
          month={month}
          onChange={(m) => {
            setMonth(m)
            setSelectedDay(null)
          }}
        />
      }
    >
      <div className="mb-4 flex gap-3 text-sm">
        <div className="flex-1 rounded-2xl bg-white/5 p-3">
          <p className="text-xs text-muted">Total</p>
          <p className="text-lg font-bold text-white">{formatMoney(monthTotal)}</p>
        </div>
        <div className="flex-1 rounded-2xl bg-white/5 p-3">
          <p className="text-xs text-muted">Daily average</p>
          <p className="text-lg font-bold text-white">{formatMoney(avgPerDay)}</p>
        </div>
      </div>

      <CalendarHeatmap
        month={month}
        totalsByDay={totalsByDay}
        monthTotal={monthTotal}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
      />

      {selectedDay && (
        <section className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-white">{formatDayLong(selectedDay)}</h2>
            <span className="text-sm tabular-nums text-muted">
              {formatMoney(totalsByDay[selectedDay] ?? 0)}
            </span>
          </div>
          <TransactionList
            expenses={dayExpenses}
            categories={categoryById(categories)}
            showDate={false}
            emptyLabel="Nothing spent that day"
          />
        </section>
      )}
    </Screen>
  )
}
