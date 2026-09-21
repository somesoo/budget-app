import { CURRENCY_SUFFIX } from '../config'
import {
  fillPercent,
  formatAmount,
  isOverLimit,
  limitRatio,
  readableTextColor,
  withAlpha,
} from '../lib/calculations'
import type { Category } from '../types'

interface Props {
  category: Category
  spent: number
  onClick: () => void
}

const OVER_LIMIT_COLOR = '#dc2626'

// The tile has a fixed height (h-32), so we know at which fill level the
// category color reaches each line of text and the contrast has to flip.
const FILL_REACHES_AMOUNT = 37
const FILL_REACHES_SUBLINE = 16
const FILL_REACHES_TITLE = 92

/**
 * Category tile filled from the bottom in proportion to the monthly limit used.
 * Past 100% the whole tile turns red as a warning.
 */
export function CategoryTile({ category, spent, onClick }: Props) {
  const over = isOverLimit(spent, category.monthly_limit)
  const ratio = limitRatio(spent, category.monthly_limit)
  const fill = fillPercent(spent, category.monthly_limit)

  const onFill = readableTextColor(category.color)
  const titleColor = over || fill < FILL_REACHES_TITLE ? '#ffffff' : onFill
  const amountColor = over || fill < FILL_REACHES_AMOUNT ? '#ffffff' : onFill
  const subLineColor = over || fill < FILL_REACHES_SUBLINE ? '#ffffff' : onFill

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-32 w-full touch-manipulation flex-col justify-between overflow-hidden rounded-3xl p-3 text-left ring-1 ring-white/10 transition active:scale-[0.97]"
      style={{ backgroundColor: over ? OVER_LIMIT_COLOR : withAlpha(category.color, 0.18) }}
    >
      {!over && (
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 transition-[height] duration-500 ease-out"
          style={{ height: `${fill}%`, backgroundColor: category.color }}
        />
      )}

      <div className="relative flex items-start justify-between gap-1">
        <span
          className="text-[15px] font-semibold leading-tight drop-shadow-sm"
          style={{ color: titleColor }}
        >
          {category.name}
        </span>
        {over && (
          <span aria-label="over limit" className="text-lg leading-none">
            ⚠️
          </span>
        )}
      </div>

      <div className="relative">
        <div
          className="text-xl font-bold tabular-nums drop-shadow-sm"
          style={{ color: amountColor }}
        >
          {formatAmount(spent)} {CURRENCY_SUFFIX}
        </div>
        <div
          className="text-xs font-medium opacity-80 tabular-nums"
          style={{ color: subLineColor }}
        >
          {category.monthly_limit > 0
            ? `of ${formatAmount(category.monthly_limit)} · ${Math.round(ratio * 100)}%`
            : 'no limit'}
        </div>
      </div>
    </button>
  )
}
