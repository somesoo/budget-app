import { CaretDown, CaretUp, Warning } from '@phosphor-icons/react'
import { useState } from 'react'
import { ChartCard } from './charts/ChartCard'
import { CHART } from './charts/theme'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { isOthersAllowance } from '../lib/allowance'
import { formatAmount, formatMoneyWhole } from '../lib/calculations'
import type { PayPart, PaySplit } from '../lib/paySplit'
import { t } from '../i18n'
import { Trans } from '../i18n/Trans'

/**
 * One color per part, never cycled. The order is the validated chart palette
 * (dataviz validate_palette, dark, against CHART.surface: every adjacent pair
 * passes), and parts are drawn in this order; every part is also named in the
 * list, so none is told apart by color alone.
 */
export const PAY_COLORS: Record<PayPart, string> = {
  daily: '#3987e5',
  bills: '#d95926',
  debts: '#199e70',
  fun: '#c98500',
  other: '#d55181',
  savings: '#008300',
  investments: '#9085e9',
}
/** What's left isn't a use of the money, so it gets the neutral. */
const LEFT_COLOR = CHART.deemphasisActive

function percentOf(part: number, whole: number): string {
  if (whole <= 0) return ''
  const p = (part / whole) * 100
  return p < 1 ? '<1%' : `${Math.round(p)}%`
}

/**
 * Where the month's pay went: one bar the length of what came in, split into
 * everyday spending, bills, debts, fun, other, savings and investments, and
 * what's left. A month that ran short goes past the income line.
 */
export function PaySplitCard({
  split,
  monthName,
  bare,
}: {
  split: PaySplit
  /** The month's name alone. */
  monthName: string
  /** Without its frame, inside a widget. */
  bare?: boolean
}) {
  const { person: me } = useDeviceUser()
  const [open, setOpen] = useState<PayPart | null>(null)
  const { income, parts, fromSavings, left } = split

  if (income <= 0) {
    return (
      <ChartCard title={t('paySplit.title')} bare={bare}>
        <p className="text-sm text-muted">{t('paySplit.noIncome', { month: monthName })}</p>
      </ChartCard>
    )
  }

  const short = left < 0
  const cameIn = income + fromSavings
  const out = parts.reduce((s, p) => s + p.amount, 0)
  const scale = Math.max(cameIn, out)
  const width = (v: number) => `${(Math.max(v, 0) / scale) * 100}%`
  const incomeMarker = short ? (cameIn / scale) * 100 : null

  return (
    <ChartCard
      title={t('paySplit.title')}
      bare={bare}
      headline={
        short ? (
          <span className="flex items-start gap-1.5">
            <Warning aria-hidden weight="fill" className="mt-0.5 shrink-0 text-amber-300" />
            <span>
              <Trans
                k="paySplit.headlineShort"
                values={{ income: formatMoneyWhole(income), amount: formatMoneyWhole(-left) }}
                tags={{ b: (s) => <strong>{s}</strong> }}
              />
            </span>
          </span>
        ) : (
          <Trans
            k="paySplit.headline"
            values={{ income: formatMoneyWhole(income), amount: formatMoneyWhole(left) }}
            tags={{ b: (s) => <strong>{s}</strong> }}
          />
        )
      }
      table={{
        head: ['', t('entry.amount'), t('paySplit.ofIncome')],
        rows: [
          ...parts.map((p) => [
            t(`paySplit.part.${p.id}`),
            formatAmount(p.amount),
            percentOf(p.amount, income),
          ]),
          [
            short ? t('paySplit.short') : t('paySplit.left'),
            formatAmount(Math.abs(left)),
            percentOf(Math.abs(left), income),
          ],
        ],
      }}
    >
      {/* part-to-whole of what came in; 2px surface gaps between segments */}
      <div className="relative">
        <div className="flex h-5 w-full gap-0.5 overflow-hidden rounded">
          {parts.map((p) => (
            <span
              key={p.id}
              className="h-full"
              style={{ width: width(p.amount), backgroundColor: PAY_COLORS[p.id] }}
              title={`${t(`paySplit.part.${p.id}`)}: ${formatMoneyWhole(p.amount)}`}
            />
          ))}
          {!short && left > 0 && (
            <span
              className="h-full"
              style={{ width: width(left), backgroundColor: LEFT_COLOR }}
              title={`${t('paySplit.left')}: ${formatMoneyWhole(left)}`}
            />
          )}
        </div>
        {incomeMarker !== null && (
          <span
            aria-hidden
            className="absolute -top-1 h-7 w-0.5 bg-slate-50"
            style={{ left: `${incomeMarker}%` }}
            title={t('paySplit.incomeLine')}
          />
        )}
      </div>
      {incomeMarker !== null && (
        <p className="mt-1.5 text-xs text-muted">{t('paySplit.incomeLineNote')}</p>
      )}

      <ul className="mt-3 divide-y divide-white/5">
        {parts.map((p) => {
          const rows = p.categories.filter((r) => !isOthersAllowance(r.category, me))
          const expandable = rows.length > 0
          const isOpen = open === p.id
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={!expandable}
                onClick={() => setOpen(isOpen ? null : p.id)}
                aria-expanded={expandable ? isOpen : undefined}
                className="flex w-full items-center gap-2.5 py-2 text-left disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: PAY_COLORS[p.id] }}
                />
                <span className="min-w-0 flex-1 truncate text-[15px] text-slate-100">
                  {t(`paySplit.part.${p.id}`)}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted">
                  {percentOf(p.amount, income)}
                </span>
                <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-white">
                  {formatMoneyWhole(p.amount)}
                </span>
                <span aria-hidden className="w-4 shrink-0 text-muted">
                  {expandable && (isOpen ? <CaretUp /> : <CaretDown />)}
                </span>
              </button>
              {isOpen && (
                <ul className="mb-2 ml-5 space-y-1">
                  {rows.map((r) => (
                    <li
                      key={r.category.id}
                      className="flex items-baseline justify-between gap-2 text-sm text-slate-300"
                    >
                      <span className="truncate">{r.category.name}</span>
                      <span className="shrink-0 tabular-nums">{formatMoneyWhole(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
        <li className="flex items-center gap-2.5 py-2">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: short ? 'transparent' : LEFT_COLOR }}
          >
            {short && <Warning weight="fill" className="h-3 w-3 text-amber-300" />}
          </span>
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">
            {short ? t('paySplit.short') : t('paySplit.left')}
          </span>
          <span className="shrink-0 text-sm tabular-nums text-muted">
            {percentOf(Math.abs(left), income)}
          </span>
          <span
            className={`w-24 shrink-0 text-right font-bold tabular-nums ${short ? 'text-red-300' : 'text-emerald-300'}`}
          >
            {short ? '−' : ''}
            {formatMoneyWhole(Math.abs(left))}
          </span>
          <span aria-hidden className="w-4 shrink-0" />
        </li>
      </ul>

      {fromSavings > 0 && (
        <p className="mt-2 text-xs text-muted">
          {t('paySplit.fromSavings', { amount: formatMoneyWhole(fromSavings) })}
        </p>
      )}
      {split.guessed && <p className="mt-2 text-xs text-muted">{t('paySplit.guessed')}</p>}
    </ChartCard>
  )
}
