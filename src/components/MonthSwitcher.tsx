import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { currentMonthKey, formatMonth, shiftMonth, type MonthKey } from '../lib/calculations'

interface Props {
  month: MonthKey
  onChange: (month: MonthKey) => void
  /** Latest month reachable — the current one unless the screen deals in plans. */
  max?: MonthKey
}

export function MonthSwitcher({ month, onChange, max = currentMonthKey() }: Props) {
  const atMax = month >= max

  return (
    <div className="flex shrink-0 items-center justify-between gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Previous month"
        className="rounded-full px-2 py-1.5 text-lg text-muted active:bg-white/10 sm:px-3"
      >
        <CaretLeft className="inline-block align-[-0.125em]" />
      </button>
      <span className="whitespace-nowrap text-sm font-semibold text-white">
        {formatMonth(month)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={atMax}
        aria-label="Next month"
        className="rounded-full px-2 py-1.5 text-lg text-muted active:bg-white/10 sm:px-3 disabled:opacity-25"
      >
        <CaretRight className="inline-block align-[-0.125em]" />
      </button>
    </div>
  )
}
