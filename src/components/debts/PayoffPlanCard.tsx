import { CheckCircle, Warning } from '@phosphor-icons/react'
import { useState } from 'react'
import { currentMonthKey, formatMoneyWhole, formatMonth } from '../../lib/calculations'
import { payoffPlan, separatePayoff, type PlanDebt, type Strategy } from '../../lib/debts'
import type { Debt } from '../../types'
import { MoneyInput } from '../budget/MoneyInput'
import { CHART } from '../charts/theme'
import { Segments } from '../savings/fields'
import { t } from '../../i18n'

const STORAGE_KEY = 'budget-app.debt-plan'

function readSaved(): { strategy: Strategy; extra: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (raw && (raw.strategy === 'snowball' || raw.strategy === 'avalanche')) {
      return { strategy: raw.strategy, extra: Number(raw.extra) || 0 }
    }
  } catch {
    // nothing saved, or storage blocked
  }
  return { strategy: 'avalanche', extra: 0 }
}

/**
 * The way out of debt: every debt gets its own payment, and the extra goes
 * onto one at a time, the smallest (snowball) or the dearest (avalanche)
 * first. A paid-off debt's payment then joins the extra. The choice and the
 * extra are this device's, a what-if to play with.
 */
export function PayoffPlanCard({ debts, input }: { debts: Debt[]; input: PlanDebt[] }) {
  const saved = readSaved()
  const [strategy, setStrategyState] = useState<Strategy>(saved.strategy)
  const [extra, setExtraState] = useState(saved.extra)
  const persist = (next: { strategy: Strategy; extra: number }) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // storage blocked: it just won't be remembered
    }
  }
  const setStrategy = (s: Strategy) => {
    setStrategyState(s)
    persist({ strategy: s, extra })
  }
  const setExtra = (x: number) => {
    setExtraState(x)
    persist({ strategy, extra: x })
  }

  if (input.length === 0) return null
  const from = currentMonthKey()
  const plan = payoffPlan(input, extra, strategy, from)
  const alone = separatePayoff(input, from)
  const name = (id: string) => debts.find((d) => d.id === id)?.name ?? ''
  const stuck = input.filter((d) => plan.byDebt[d.id].months === null)
  const sooner = plan.months !== null && alone.months !== null ? alone.months - plan.months : 0
  const saving = alone.interest - plan.interest

  return (
    <section
      aria-labelledby="payoff"
      data-tour="debt-plan"
      className="rounded-3xl p-4 ring-1 ring-white/10"
      style={{ backgroundColor: CHART.surface }}
    >
      <h2 id="payoff" className="text-base font-semibold text-white">
        {t('debts.planTitle')}
      </h2>
      <p className="mt-1 text-sm leading-snug text-slate-300">
        {strategy === 'snowball' ? t('debts.snowballHelp') : t('debts.avalancheHelp')}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Segments
          value={strategy}
          onChange={setStrategy}
          options={[
            { value: 'avalanche', label: t('debts.avalanche') },
            { value: 'snowball', label: t('debts.snowball') },
          ]}
        />
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="shrink-0">{t('debts.extra')}</span>
          <MoneyInput value={extra} onChange={setExtra} label={t('debts.extra')} />
        </div>
      </div>

      {plan.months === null ? (
        <p className="mt-4 flex items-start gap-2 text-[15px] leading-snug text-slate-100">
          <Warning weight="fill" className="mt-0.5 shrink-0" style={{ color: CHART.warning }} aria-hidden />
          {t('debts.planNever', { names: stuck.map((d) => name(d.id)).join(', ') })}
        </p>
      ) : (
        <div className="mt-4">
          <p className="flex items-start gap-2 text-[15px] leading-snug text-white">
            <CheckCircle weight="fill" className="mt-0.5 shrink-0 text-positive" aria-hidden />
            <span>
              {t('debts.planFree', {
                month: formatMonth(plan.month!),
                count: plan.months,
                interest: formatMoneyWhole(plan.interest),
              })}
            </span>
          </p>
          {(sooner > 0 || saving >= 1) && (
            <p className="mt-1 pl-6 text-sm text-slate-300">
              {sooner > 0
                ? t('debts.planBetter', { count: sooner, amount: formatMoneyWhole(Math.max(0, saving)) })
                : t('debts.planLess', { amount: formatMoneyWhole(saving) })}
            </p>
          )}
        </div>
      )}

      <ol className="mt-4 grid gap-1.5">
        {plan.order.map((id, i) => {
          const d = input.find((x) => x.id === id)!
          const done = plan.byDebt[id]
          return (
            <li key={id} className="flex items-baseline gap-3 text-sm">
              <span className="w-5 shrink-0 text-right tabular-nums text-muted">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate text-slate-100">
                {name(id)}
                <span className="text-muted">
                  {' · '}
                  {formatMoneyWhole(d.balance)}
                  {d.ratePct != null && `, ${d.ratePct}%`}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-300">
                {done.month ? formatMonth(done.month) : '–'}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-xs leading-snug text-muted">{t('debts.planNote')}</p>
    </section>
  )
}
