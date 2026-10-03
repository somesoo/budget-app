import { useState } from 'react'
import { useReviewSubscriptions } from '../../hooks/useRecurring'
import { formatMoneyWhole } from '../../lib/calculations'
import { perYear } from '../../lib/recurring'
import type { RecurringCost } from '../../types'
import { BottomSheet } from '../history/BottomSheet'
import { Segments } from '../savings/fields'
import { t } from '../../i18n'

/**
 * The quarterly look at subscriptions: for each, still worth it? Kept ones
 * are marked checked, cancelled ones put away (cancel them with the provider
 * too). The yearly cost is what makes the question honest.
 */
export function ReviewSheet({ costs, onClose }: { costs: RecurringCost[]; onClose: () => void }) {
  const review = useReviewSubscriptions()
  const [choice, setChoice] = useState<Record<string, 'keep' | 'cancel'>>(
    Object.fromEntries(costs.map((c) => [c.id, 'keep'])),
  )
  const cancelled = costs.filter((c) => choice[c.id] === 'cancel')
  const saved = cancelled.reduce((s, c) => s + perYear(c), 0)

  const submit = async () => {
    await review.mutateAsync({
      keep: costs.filter((c) => choice[c.id] === 'keep').map((c) => c.id),
      cancel: cancelled.map((c) => c.id),
    })
    onClose()
  }

  return (
    <BottomSheet title={t('regular.reviewTitle')} onClose={onClose}>
      <div className="grid gap-4 pb-2">
        <p className="text-sm leading-snug text-slate-300">{t('regular.reviewIntro')}</p>
        <ul className="grid gap-3">
          {costs.map((c) => (
            <li key={c.id} className="grid gap-2 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[15px] font-semibold text-white">{c.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-slate-300">
                  {t('regular.yearly', { amount: formatMoneyWhole(perYear(c)) })}
                </span>
              </div>
              <Segments
                value={choice[c.id]}
                onChange={(v) => setChoice((all) => ({ ...all, [c.id]: v }))}
                options={[
                  { value: 'keep', label: t('regular.keep') },
                  { value: 'cancel', label: t('regular.cancelIt') },
                ]}
              />
            </li>
          ))}
        </ul>
        {saved > 0 && (
          <p className="rounded-xl bg-positive/10 px-3 py-2 text-sm text-positive">
            {t('regular.reviewSaves', { amount: formatMoneyWhole(saved) })}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={review.isPending}
          className="h-12 rounded-2xl bg-slate-100 text-base font-bold text-ink hover:bg-slate-50 disabled:opacity-40"
        >
          {review.isPending ? t('common.saving') : t('regular.reviewDone')}
        </button>
      </div>
    </BottomSheet>
  )
}
