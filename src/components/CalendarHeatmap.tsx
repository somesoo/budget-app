import { WEEKDAY_LABELS } from '../config'
import {
  daysInMonth,
  heatIntensity,
  monthGrid,
  todayKey,
  type MonthKey,
} from '../lib/calculations'

const HEAT_COLOR = '249, 115, 22' // orange — the more spent, the stronger

interface Props {
  month: MonthKey
  totalsByDay: Record<string, number>
  monthTotal: number
  selectedDay: string | null
  onSelectDay: (day: string | null) => void
}

/** Month grid; color intensity = that day's spending vs. the daily average. */
export function CalendarHeatmap({
  month,
  totalsByDay,
  monthTotal,
  selectedDay,
  onSelectDay,
}: Props) {
  const cells = monthGrid(month)
  const days = daysInMonth(month)
  const today = todayKey()

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-xs font-medium text-muted">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />

          const total = totalsByDay[day] ?? 0
          const intensity = heatIntensity(total, monthTotal, days)
          const selected = day === selectedDay
          const dayNumber = Number(day.slice(-2))

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(selected ? null : day)}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl text-center transition active:scale-95 ${
                selected ? 'ring-2 ring-white' : day === today ? 'ring-1 ring-white/40' : ''
              }`}
              style={{
                backgroundColor:
                  total > 0
                    ? `rgba(${HEAT_COLOR}, ${0.18 + intensity * 0.72})`
                    : 'rgba(255,255,255,0.04)',
              }}
            >
              <span className="text-[13px] font-semibold leading-none text-white">
                {dayNumber}
              </span>
              {total > 0 && (
                <span className="mt-1 text-[10px] leading-none tabular-nums text-white/85">
                  {Math.round(total)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
