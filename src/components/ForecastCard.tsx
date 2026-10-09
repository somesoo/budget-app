import { Warning } from '@phosphor-icons/react'
import { ChartCard, LegendItem } from './charts/ChartCard'
import { CHART } from './charts/theme'
import { formatAmount, formatMoney, formatMoneyWhole } from '../lib/calculations'
import type { MonthForecast } from '../lib/forecast'
import type { Goal } from '../types'
import { personLabel } from '../lib/people'
import { t } from '../i18n'
import { Trans } from '../i18n/Trans'

const INCOME = '#34d399' // the app's income color: money that stays

interface Props {
  forecast: MonthForecast
  isCurrent: boolean
  goal: Goal | null | undefined
  /** Without its frame, inside another card. */
  bare?: boolean
}

/**
 * Income against projected spending, all computed in code. The bar is the
 * month's income split into spent so far, still to be spent (projected), and
 * what's left over.
 */
export function ForecastCard({ forecast: f, isCurrent, goal, bare }: Props) {
  if (f.income <= 0) {
    return (
      <ChartCard title={t('forecast.title')} bare={bare}>
        <p className="text-sm text-muted">
          {isCurrent ? t('forecast.noIncomeCurrent') : t('forecast.noIncomePast')}
        </p>
      </ChartCard>
    )
  }

  const saving = f.projectedSavings >= 0
  const scale = Math.max(f.income, f.projectedSpend)
  const pct = (v: number) => `${(Math.max(v, 0) / scale) * 100}%`
  const rest = Math.max(f.projectedSpend - f.spentSoFar, 0)
  const incomeMarker = f.projectedSpend > f.income ? (f.income / scale) * 100 : null

  const basis = f.incomeByPerson
    .filter((p) => p.expected > 0)
    .map((p) =>
      p.basis === 'typical'
        ? t('forecast.expected', {
            name: personLabel(p.person),
            amount: formatAmount(Math.round(p.expected)),
          })
        : `${personLabel(p.person)} ${formatAmount(p.expected)}`,
    )
    .join(' · ')

  const estimate = isCurrent ? formatMoneyWhole : formatMoney

  const sentence = isCurrent ? (
    saving ? (
      <Trans
        k={f.savingsRate !== null ? 'forecast.onCourseSaveRate' : 'forecast.onCourseSave'}
        values={{
          amount: formatMoneyWhole(f.projectedSavings),
          percent: Math.round((f.savingsRate ?? 0) * 100),
        }}
        tags={{ b: (s) => <strong>{s}</strong> }}
      />
    ) : (
      <Trans
        k="forecast.onCourseOverspend"
        values={{ amount: formatMoneyWhole(-f.projectedSavings) }}
        tags={{ b: (s) => <strong>{s}</strong> }}
      />
    )
  ) : saving ? (
    <Trans
      k={f.savingsRate !== null ? 'forecast.savedRate' : 'forecast.saved'}
      values={{
        amount: formatMoney(f.projectedSavings),
        percent: Math.round((f.savingsRate ?? 0) * 100),
      }}
      tags={{ b: (s) => <strong>{s}</strong> }}
    />
  ) : (
    <Trans
      k="forecast.overspent"
      values={{ amount: formatMoney(-f.projectedSavings) }}
      tags={{ b: (s) => <strong>{s}</strong> }}
    />
  )

  return (
    <ChartCard
      title={t('forecast.title')}
      bare={bare}
      headline={
        <>
          {/* the signed balance first: a month on the way to a loss shouldn't need reading */}
          <span className="mb-1 flex items-center gap-2">
            {!saving && (
              <Warning aria-hidden weight="fill" className="shrink-0 text-2xl text-amber-300" />
            )}
            <span
              className={`text-3xl font-bold tabular-nums ${saving ? 'text-emerald-300' : 'text-red-300'}`}
            >
              {saving ? '+' : '−'}
              {formatMoneyWhole(Math.abs(f.projectedSavings))}
            </span>
            <span className="text-sm text-muted">
              {isCurrent ? t('forecast.balanceProjected') : t('forecast.balance')}
            </span>
          </span>
          <span className="block">{sentence}</span>
        </>
      }
      legend={
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <LegendItem color={CHART.accent} label={t('common.spent')} shape="rect" />
          {isCurrent && rest > 0 && (
            <LegendItem
              color="rgba(57,135,229,0.4)"
              label={t('forecast.stillToSpend')}
              shape="rect"
            />
          )}
          {saving && <LegendItem color={INCOME} label={t('forecast.leftOver')} shape="rect" />}
        </div>
      }
      table={{
        head: ['', t('entry.amount')],
        rows: [
          [t('entry.income'), formatAmount(f.income)],
          [t('forecast.spentSoFar'), formatAmount(f.spentSoFar)],
          ...(isCurrent
            ? [[t('forecast.projected'), formatAmount(Math.round(f.projectedSpend))]]
            : []),
          [
            saving ? t('forecast.leftOver') : t('forecast.shortfall'),
            formatAmount(Math.round(Math.abs(f.projectedSavings))),
          ],
        ],
      }}
    >
      {/* part-to-whole of the income; 2px surface gaps between segments */}
      <div className="relative">
        <div className="flex h-4 w-full gap-0.5">
          <span
            className="h-full rounded-l"
            style={{ width: pct(f.spentSoFar), backgroundColor: CHART.accent }}
          />
          {isCurrent && rest > 0 && (
            <span
              className="h-full"
              style={{ width: pct(rest), backgroundColor: 'rgba(57,135,229,0.4)' }}
            />
          )}
          {saving && (
            <span
              className="h-full rounded-r"
              style={{ width: pct(f.projectedSavings), backgroundColor: INCOME }}
            />
          )}
        </div>
        {incomeMarker !== null && (
          <span
            aria-hidden
            className="absolute -top-1 h-6 w-0.5 bg-slate-50"
            style={{ left: `${incomeMarker}%` }}
            title={t('entry.income')}
          />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">{t('entry.income')}</dt>
          <dd className="font-semibold text-white">{formatMoney(f.income)}</dd>
          <dd className="text-xs text-muted">{basis}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{isCurrent ? t('forecast.projected') : t('common.spent')}</dt>
          <dd className="font-semibold text-white">{estimate(f.projectedSpend)}</dd>
          {isCurrent && (
            <dd className="text-xs text-muted">
              {t('forecast.soFar', { amount: formatMoney(f.spentSoFar) })}
            </dd>
          )}
        </div>

        {f.perDayToBreakEven !== null && (
          <div className="col-span-2">
            <dt className="text-xs text-muted">{t('forecast.breakEven')}</dt>
            <dd className="text-white">
              <Trans
                k="forecast.breakEvenDetail"
                count={f.daysLeft}
                values={{ amount: formatMoneyWhole(f.perDayToBreakEven) }}
                tags={{ b: (s) => <span className="font-semibold">{s}</span> }}
              />
            </dd>
          </div>
        )}

        {goal && f.monthsToGoal !== null && (
          <div className="col-span-2">
            <dt className="text-xs text-muted">{t('forecast.goal', { name: goal.name })}</dt>
            <dd className="text-white">
              <Trans
                k="forecast.goalDetail"
                count={f.monthsToGoal}
                tags={{ b: (s) => <span className="font-semibold">{s}</span> }}
              />
            </dd>
          </div>
        )}
      </dl>

      {f.incomeByPerson.some((p) => p.basis === 'typical') && (
        <p className="mt-3 text-xs text-muted">
          {t('forecast.expectedNote')}
        </p>
      )}
    </ChartCard>
  )
}
