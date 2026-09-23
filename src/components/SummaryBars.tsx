import { CURRENCY_SUFFIX } from '../config'
import { formatAmount, isOverLimit, limitRatio } from '../lib/calculations'
import type { Category } from '../types'

interface Props {
  categories: Category[]
  spentByCategory: Record<string, number>
}

/** Per-category progress: spent / limit / percent. */
export function SummaryBars({ categories, spentByCategory }: Props) {
  return (
    <ul className="space-y-3">
      {categories.map((category) => {
        const spent = spentByCategory[category.id] ?? 0
        const ratio = limitRatio(spent, category.monthly_limit)
        const over = isOverLimit(spent, category.monthly_limit)
        const width = category.monthly_limit > 0 ? Math.min(ratio, 1) * 100 : spent > 0 ? 100 : 0

        return (
          <li key={category.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-white">{category.name}</span>
              <span className="shrink-0 text-sm tabular-nums text-muted">
                <span className={over ? 'font-semibold text-red-400' : 'text-white'}>
                  {/* whole złoty: an overview, and "241.5" reads like a typo */}
                  {formatAmount(Math.round(spent))}
                </span>
                {category.monthly_limit > 0
                  ? ` / ${formatAmount(category.monthly_limit)} ${CURRENCY_SUFFIX} · ${Math.round(ratio * 100)}%`
                  : ` ${CURRENCY_SUFFIX}`}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${width}%`,
                  backgroundColor: over ? '#dc2626' : category.color,
                }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
