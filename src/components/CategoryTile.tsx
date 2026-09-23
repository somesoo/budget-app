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

// The tile has a fixed height (h-24), so we know at which fill level the
// category color has swallowed each line of text and the contrast has to flip.
// Each line flips only once the fill covers it *completely* — flipping halfway
// puts dark text on the dark half of its own line, which is the one combination
// that can't be read at all.
const FILL_COVERS_AMOUNT = 52
const FILL_COVERS_SUBLINE = 27
const FILL_COVERS_TITLE = 90

/**
 * Category tile filled from the bottom in proportion to the monthly limit used.
 * Past 100% the whole tile turns red as a warning.
 */
export function CategoryTile({ category, spent, onClick }: Props) {
  const over = isOverLimit(spent, category.monthly_limit)
  const ratio = limitRatio(spent, category.monthly_limit)
  const fill = fillPercent(spent, category.monthly_limit)

  const onFill = readableTextColor(category.color)
  const titleColor = over || fill < FILL_COVERS_TITLE ? '#ffffff' : onFill
  const amountColor = over || fill < FILL_COVERS_AMOUNT ? '#ffffff' : onFill
  const subLineColor = over || fill < FILL_COVERS_SUBLINE ? '#ffffff' : onFill

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-24 w-full touch-manipulation flex-col justify-between overflow-hidden rounded-2xl p-2.5 text-left ring-1 ring-white/10 transition active:scale-[0.97]"
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
          className="text-[13px] font-semibold leading-tight drop-shadow-sm"
          style={{ color: titleColor }}
        >
          {category.name}
        </span>
        {over && (
          <span aria-label="over limit" className="text-base leading-none">
            ⚠️
          </span>
        )}
      </div>

      <div className="relative">
        <div
          className="text-lg font-bold leading-6 tabular-nums drop-shadow-sm"
          style={{ color: amountColor }}
        >
          {formatAmount(spent)} {CURRENCY_SUFFIX}
        </div>
        <div
          className="text-[11px] font-medium leading-4 opacity-90 drop-shadow-sm tabular-nums"
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
