import { currentMonthKey, formatMonth, shiftMonth, type MonthKey } from '../lib/calculations'

interface Props {
  month: MonthKey
  onChange: (month: MonthKey) => void
}

export function MonthSwitcher({ month, onChange }: Props) {
  const isCurrent = month === currentMonthKey()

  return (
    <div className="flex shrink-0 items-center justify-between gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Previous month"
        className="rounded-full px-3 py-1.5 text-lg text-muted active:bg-white/10"
      >
        ‹
      </button>
      <span className="whitespace-nowrap text-sm font-semibold text-white">
        {formatMonth(month)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={isCurrent}
        aria-label="Next month"
        className="rounded-full px-3 py-1.5 text-lg text-muted active:bg-white/10 disabled:opacity-25"
      >
        ›
      </button>
    </div>
  )
}
