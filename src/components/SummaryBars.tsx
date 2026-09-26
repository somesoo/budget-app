import { CaretRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { CURRENCY_SUFFIX } from '../config'
import { formatAmount, isOverLimit, limitRatio } from '../lib/calculations'
import type { Category } from '../types'

interface Props {
  categories: Category[]
  spentByCategory: Record<string, number>
  /** Makes each row a link, e.g. to the category's own page. */
  linkTo?: (category: Category) => string
}

/** Per-category progress: spent / limit / percent. */
export function SummaryBars({ categories, spentByCategory, linkTo }: Props) {
  return (
    <ul className="space-y-1">
      {categories.map((category) => {
        const spent = spentByCategory[category.id] ?? 0
        const ratio = limitRatio(spent, category.monthly_limit)
        const over = isOverLimit(spent, category.monthly_limit)
        const width = category.monthly_limit > 0 ? Math.min(ratio, 1) * 100 : spent > 0 ? 100 : 0

        const body = (
          <>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1 truncate text-sm font-medium text-white">
                <span className="truncate">{category.name}</span>
                {linkTo && (
                  <CaretRight
                    aria-hidden
                    className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-white"
                  />
                )}
              </span>
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
          </>
        )

        return (
          <li key={category.id}>
            {linkTo ? (
              <Link
                to={linkTo(category)}
                className="group -mx-2 block rounded-xl px-2 py-1.5 transition hover:bg-white/5 active:bg-white/10"
              >
                {body}
              </Link>
            ) : (
              <div className="py-1.5">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
