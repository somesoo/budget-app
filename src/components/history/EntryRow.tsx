import { PERSON_LABELS } from '../../config'
import { formatDayShort, formatMoney, withAlpha } from '../../lib/calculations'
import type { Entry } from '../../lib/history'
import type { Category } from '../../types'

const INCOME_COLOR = '#34d399'
const UNKNOWN_COLOR = '#64748b'

interface Props {
  entry: Entry
  categories: Record<string, Category>
  onOpen?: () => void
  /** Tighter, for long lists (History). */
  dense?: boolean
  /** Adds the date to the second line, for lists not grouped by day. */
  showDate?: boolean
}

/**
 * One transaction: what it was on top, where it went and who paid underneath,
 * the amount on the right. The title is the note when there is one — that's
 * what you remember a purchase by — and the category otherwise.
 */
export function EntryRow({ entry, categories, onOpen, dense = false, showDate = false }: Props) {
  const isIncome = entry.kind === 'income'
  const category = entry.kind === 'expense' ? categories[entry.item.category_id] : undefined
  const color = isIncome ? INCOME_COLOR : (category?.color ?? UNKNOWN_COLOR)
  const categoryName = isIncome ? 'Income' : (category?.name ?? 'Unknown category')
  const note = entry.item.note
  const title = note ?? categoryName
  const detail = [
    note ? categoryName : null,
    PERSON_LABELS[entry.item.person],
    showDate ? formatDayShort(entry.date) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const content = (
    <>
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-full font-bold ${
          dense ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
        }`}
        style={{ backgroundColor: withAlpha(color, 0.18), color }}
      >
        {isIncome ? '+' : categoryName.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-5 text-white">{title}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] leading-4 text-muted">
          {note && !isIncome && (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
          )}
          <span className="truncate">{detail}</span>
        </span>
      </span>
      <span
        className={`shrink-0 text-[15px] font-semibold tabular-nums ${
          isIncome ? 'text-positive' : 'text-white'
        }`}
      >
        {isIncome && '+'}
        {formatMoney(entry.item.amount)}
      </span>
    </>
  )

  const base = `flex w-full items-center gap-3 px-3 text-left ${dense ? 'py-2' : 'py-2.5'}`
  if (!onOpen) return <div className={base}>{content}</div>

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${note ? `${title}, ` : ''}${categoryName}, ${formatMoney(entry.item.amount)}. Edit`}
      className={`${base} transition active:bg-white/5`}
    >
      {content}
    </button>
  )
}
