import { ArrowRight, CaretDown, CheckCircle, Circle } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen } from '../components/Screen'
import { useBudget } from '../hooks/useBudgets'
import { useGeminiKey } from '../hooks/useGeminiKey'
import { useIncomesBetween } from '../hooks/useIncomes'
import { useRecurringCosts } from '../hooks/useRecurring'
import { useSavingsOverview } from '../hooks/useSavings'
import { useFeatures } from '../hooks/usePrefs'
import { useWealth } from '../hooks/useWealth'
import { currentMonthKey, formatMonthName, monthRange } from '../lib/calculations'
import { GUIDE_LABELS, startProgress, visibleGuide, type GuideCheck, type GuideSection, type GuideStep } from '../lib/guide'
import { t, type MessageKey } from '../i18n'
import { Trans } from '../i18n/Trans'

/** The buttons and tabs the texts name, in the app's own words. */
function labels(): Record<string, ReactNode> {
  const out: Record<string, ReactNode> = {}
  for (const [name, key] of Object.entries(GUIDE_LABELS)) out[name] = <Label>{t(key)}</Label>
  out.planMonth = <Label>{t('budget.planMonth', { month: formatMonthName(currentMonthKey()) })}</Label>
  return out
}

function Label({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-white">{children}</strong>
}

/** What the app can tell is set up already; undefined while it doesn't know. */
function useChecks(): Partial<Record<GuideCheck, boolean>> {
  const month = currentMonthKey()
  const { from, to } = monthRange(month)
  const savings = useSavingsOverview()
  const wealth = useWealth()
  const regular = useRecurringCosts()
  const incomes = useIncomesBetween(from, to)
  const plan = useBudget(month)
  const ai = useGeminiKey()
  const goals = savings.goals.map((g) => g.goal)
  const known = <T,>(ready: boolean, value: T) => (ready ? value : undefined)
  return {
    accounts: known(savings.available, savings.accounts.length > 0),
    emergency: known(savings.available, goals.some((g) => g.is_emergency && !g.archived)),
    billsFund: known(savings.available, goals.some((g) => g.is_bills_fund && !g.archived)),
    debts: known(wealth.available, wealth.debts.length > 0),
    regular: known(!!regular.data?.available, (regular.data?.costs.length ?? 0) > 0),
    income: known(!!incomes.data, (incomes.data?.length ?? 0) > 0),
    plan: known(!plan.isLoading, !!plan.data),
    ai: known(!!ai.data, ai.data?.source != null),
  }
}

/**
 * How to use the app, in the order it's needed: setting it up once, then the
 * daily, monthly and quarterly habits, then what the numbers mean. Each step
 * can open its screen and point at the spot.
 */
export function Guide() {
  const checks = useChecks()
  const values = labels()
  const guide = visibleGuide(useFeatures())
  const progress = startProgress(checks, guide)
  const [open, setOpen] = useState<Set<string>>(
    () => new Set([progress.total > 0 && progress.done === progress.total ? 'daily' : 'start']),
  )
  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Screen title={t('guide.title')}>
      <p className="-mt-2 mb-5 text-[15px] leading-relaxed text-slate-300">{t('guide.intro')}</p>
      <div className="space-y-3">
        {guide.map((section) => (
          <Section
            key={section.id}
            section={section}
            open={open.has(section.id)}
            onToggle={() => toggle(section.id)}
            values={values}
            checks={section.id === 'start' ? checks : undefined}
            progress={section.id === 'start' ? progress : undefined}
          />
        ))}
      </div>
    </Screen>
  )
}

function Section({
  section,
  open,
  onToggle,
  values,
  checks,
  progress,
}: {
  section: GuideSection
  open: boolean
  onToggle: () => void
  values: Record<string, ReactNode>
  checks?: Partial<Record<GuideCheck, boolean>>
  progress?: { done: number; total: number }
}) {
  const id = section.id
  const all = progress && progress.total > 0 && progress.done === progress.total
  return (
    <section className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-white">
            {t(`guide.${id}.title` as MessageKey)}
          </span>
          <span className="block text-sm text-muted">
            {progress && progress.total > 0
              ? t('guide.progress', { done: progress.done, total: progress.total })
              : t(`guide.${id}.when` as MessageKey)}
          </span>
        </span>
        <CaretDown
          aria-hidden
          className={`shrink-0 text-lg text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4">
          {all && <p className="mb-3 text-sm text-positive">{t('guide.allDone')}</p>}
          <ol className="space-y-3">
            {section.steps.map((step, i) => (
              <Step
                key={step.id}
                section={id}
                step={step}
                n={i + 1}
                values={values}
                done={step.check && checks ? checks[step.check] : undefined}
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function Step({
  section,
  step,
  n,
  values,
  done,
}: {
  section: string
  step: GuideStep
  n: number
  values: Record<string, ReactNode>
  done: boolean | undefined
}) {
  const navigate = useNavigate()
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex w-6 shrink-0 justify-center">
        {done === true ? (
          <CheckCircle weight="fill" className="text-xl text-positive" aria-label={t('guide.doneLabel')} />
        ) : done === false ? (
          <Circle className="text-xl text-muted" aria-label={t('guide.todoLabel')} />
        ) : (
          <span className="text-sm font-semibold tabular-nums text-muted">{n}.</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] leading-relaxed ${done ? 'text-slate-400' : 'text-slate-200'}`}>
          <Trans k={`guide.${section}.${step.id}` as MessageKey} values={values} />
          {step.optional && (
            <span className="ml-1.5 rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted">
              {t('guide.optional')}
            </span>
          )}
        </p>
        {step.route && (
          <button
            type="button"
            onClick={() => navigate(step.route!, { state: { highlight: step.target } })}
            className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold text-accent-soft ring-1 ring-accent/25 hover:bg-accent/10"
          >
            {t('guide.show')} <ArrowRight weight="bold" aria-hidden />
          </button>
        )}
      </div>
    </li>
  )
}
