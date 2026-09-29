import { Warning } from '@phosphor-icons/react'
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
import { t } from '../i18n'

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
 * The big number is what's left to spend this month; past 100% it goes below
 * zero and the whole tile turns red as a warning.
 */
export function CategoryTile({ category, spent, onClick, height }: Props) {
  const over = isOverLimit(spent, category.monthly_limit)
  const ratio = limitRatio(spent, category.monthly_limit)
  const fill = fillPercent(spent, category.monthly_limit)
  const hasLimit = category.monthly_limit > 0
  // what can still be spent this month; below zero once the limit is passed
  const left = Math.round(category.monthly_limit - spent)

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
          <span aria-label={t('tile.overLimit')} className="text-xs leading-none">
            <Warning weight="fill" aria-hidden />
          </span>
        )}
      </div>

      <div className="relative">
        <div
          className="truncate text-base font-bold leading-5 tabular-nums drop-shadow-sm"
          style={{ color: amountColor }}
        >
          {/* whole złoty — a third of the screen has no room for "241.5" */}
          {hasLimit ? (
            <>
              {left < 0 ? '−' : ''}
              {formatAmount(Math.abs(left))} {CURRENCY_SUFFIX}{' '}
              <span className="text-[11px] font-semibold opacity-90">
                {left < 0 ? t('tile.over') : t('tile.left')}
              </span>
            </>
          ) : (
            `${formatAmount(Math.round(spent))} ${CURRENCY_SUFFIX}`
          )}
        </div>
        <div
          className="truncate text-[10.5px] font-medium leading-[14px] opacity-90 drop-shadow-sm tabular-nums"
          style={{ color: subLineColor }}
        >
          {hasLimit
            ? t('tile.spentOf', {
                spent: formatAmount(Math.round(spent)),
                limit: formatAmount(category.monthly_limit),
                percent: Math.round(ratio * 100),
              })
            : t('tile.noLimit')}
        </div>
      </div>
    </button>
  )
}
