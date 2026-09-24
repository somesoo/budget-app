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
  /** In px — the grid sizes tiles to fit the screen, see CategoryPager. */
  height: number
}

const OVER_LIMIT_COLOR = '#dc2626'

// Text line boxes, in px (the title sits at the top, under PAD). Knowing them and the tile's height tells us at which
// fill level the category color has swallowed each line and the contrast has
// to flip. Each line flips only once the fill covers it *completely* —
// flipping halfway puts dark text on the dark half of its own line, which is
// the one combination that can't be read at all.
const PAD = 8 // p-2
const AMOUNT_LINE = 20 // leading-5
const SUBLINE_LINE = 14 // leading-[14px]

/** Fill percentage at which the bottom `px` of the tile are covered. */
const covers = (px: number, height: number) => (px / height) * 100

/**
 * Category tile filled from the bottom in proportion to the monthly limit used.
 * Past 100% the whole tile turns red as a warning.
 */
export function CategoryTile({ category, spent, onClick, height }: Props) {
  const over = isOverLimit(spent, category.monthly_limit)
  const ratio = limitRatio(spent, category.monthly_limit)
  const fill = fillPercent(spent, category.monthly_limit)

  const onFill = readableTextColor(category.color)
  const titleColor = over || fill < covers(height - PAD, height) ? '#ffffff' : onFill
  const amountColor =
    over || fill < covers(PAD + SUBLINE_LINE + AMOUNT_LINE, height) ? '#ffffff' : onFill
  const subLineColor = over || fill < covers(PAD + SUBLINE_LINE, height) ? '#ffffff' : onFill

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full touch-manipulation flex-col justify-between overflow-hidden rounded-2xl p-2 text-left ring-1 ring-white/10 transition active:scale-[0.97]"
      style={{
        height,
        backgroundColor: over ? OVER_LIMIT_COLOR : withAlpha(category.color, 0.18),
      }}
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
          className="truncate text-[12px] font-semibold leading-[15px] drop-shadow-sm"
          style={{ color: titleColor }}
        >
          {category.name}
        </span>
        {over && (
          <span aria-label="over limit" className="text-xs leading-none">
            ⚠️
          </span>
        )}
      </div>

      <div className="relative">
        <div
          className="truncate text-base font-bold leading-5 tabular-nums drop-shadow-sm"
          style={{ color: amountColor }}
        >
          {/* whole złoty — a third of the screen has no room for "241.5" */}
          {formatAmount(Math.round(spent))} {CURRENCY_SUFFIX}
        </div>
        <div
          className="truncate text-[10.5px] font-medium leading-[14px] opacity-90 drop-shadow-sm tabular-nums"
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
