import { formatMoneyWhole } from '../lib/calculations'
import type { TopCategory } from '../lib/insights'
import { t } from '../i18n'

export function sharePercent(share: number): string {
  return share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`
}

/** Within this of usual, a category is "about as usual": a few złoty either way is noise. */
const AS_USUAL = 0.1

/**
 * The month's biggest categories, numbered, each with its share and against
 * what it usually costs. Numbered and named, so the category color is only
 * decoration.
 */
export function TopCategoriesList({ top, isCurrent }: { top: TopCategory[]; isCurrent: boolean }) {
  const versus = (amount: number, typical: number | null) => {
    if (typical === null) return t('insights.topNoTypical')
    // a running month isn't over: say what's usual, never "less than usual" on the 9th
    if (isCurrent) return t('insights.topTypical', { amount: formatMoneyWhole(typical) })
    const diff = amount - typical
    if (Math.abs(diff) <= typical * AS_USUAL) return t('insights.topAsUsual')
    return diff > 0
      ? t('insights.topMore', { amount: formatMoneyWhole(diff) })
      : t('insights.topLess', { amount: formatMoneyWhole(-diff) })
  }

  return (
    <ol className="space-y-3">
      {top.map((r, i) => (
        <li key={r.category.id} className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: r.category.color }}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[15px] font-semibold text-white">
                {r.category.name}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-white">
                {formatMoneyWhole(r.amount)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-sm text-slate-300">
              <span className="truncate">{versus(r.amount, r.typical)}</span>
              <span className="shrink-0 tabular-nums text-muted">{sharePercent(r.share)}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
