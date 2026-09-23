import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { MoneyInput } from './MoneyInput'
import { CURRENCY_SUFFIX, LOCALE } from '../../config'
import {
  useBudget,
  useDeleteBudget,
  useSaveBudget,
  useSuggestPlan,
  PlanUnavailableError,
} from '../../hooks/useBudgets'
import { useCategories } from '../../hooks/useCategories'
import { useExpensesBetween } from '../../hooks/useExpenses'
import { useGoal } from '../../hooks/useGoal'
import { useIncomesBetween } from '../../hooks/useIncomes'
import {
  formatAmount,
  formatMoneyCompact,
  formatMonth,
  formatMonthName,
  monthRange,
  shiftMonth,
  type MonthKey,
} from '../../lib/calculations'
import {
  buildPlanRequest,
  draftFrom,
  draftTotals,
  historyMonths,
  planBaseline,
  roundUpPlan,
  type FillSource,
  type PlanDraft,
} from '../../lib/planning'
import type { PlanSuggestion } from '../../types'

interface Props {
  month: MonthKey
  onClose: () => void
}

const shortMonthYear = new Intl.DateTimeFormat(LOCALE, { month: 'short', year: '2-digit' })

/**
 * Full-screen planner for one month. Zero-based: income minus savings minus
 * every category's limit should come to zero, so each złoty has a job. Every
 * category shows what it has actually cost, one tap to adopt; the AI draft
 * sits next to your numbers rather than replacing them.
 */
export function BudgetPlanner({ month, onClose }: Props) {
  const prevMonth = shiftMonth(month, -1)
  const months = historyMonths(month)
  const from = monthRange(months[0]).from
  const to = monthRange(months[months.length - 1]).to

  const { data: allCategories = [] } = useCategories()
  const categories = useMemo(() => allCategories.filter((c) => !c.archived), [allCategories])
  const existing = useBudget(month)
  const previous = useBudget(prevMonth)
  const expenses = useExpensesBetween(from, to)
  const incomes = useIncomesBetween(from, to)
  const { data: goal } = useGoal()
  const save = useSaveBudget()
  const remove = useDeleteBudget()
  const suggest = useSuggestPlan()

  const ready =
    allCategories.length > 0 &&
    !existing.isLoading &&
    !previous.isLoading &&
    !!expenses.data &&
    !!incomes.data

  const baseline = useMemo(
    () =>
      planBaseline({
        target: month,
        expenses: expenses.data ?? [],
        incomes: incomes.data ?? [],
        categories,
      }),
    [month, expenses.data, incomes.data, categories],
  )

  const [draft, setDraft] = useState<PlanDraft | null>(null)
  const [ai, setAi] = useState<PlanSuggestion | null>(null)

  // first draft: the month's own plan, else last month's, else typical spending
  useEffect(() => {
    if (!ready || draft) return
    setDraft(
      draftFrom({
        source: previous.data ? 'previous' : baseline.months.length ? 'typical' : 'defaults',
        categories,
        baseline,
        previousPlan: previous.data ?? null,
        existing: existing.data,
      }),
    )
  }, [ready, draft, previous.data, existing.data, baseline, categories])

  if (!draft) {
    return (
      <Shell month={month} onClose={onClose}>
        <div className="space-y-3 px-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      </Shell>
    )
  }

  const activeIds = categories.map((c) => c.id)
  const { spending, unassigned } = draftTotals(draft, activeIds)
  const setLimit = (id: string, amount: number) =>
    setDraft((d) => d && { ...d, limits: { ...d.limits, [id]: amount } })
  const fill = (source: FillSource) =>
    setDraft(
      (d) =>
        d && {
          ...draftFrom({ source, categories, baseline, previousPlan: previous.data ?? null }),
          note: d.note,
        },
    )

  const aiById = new Map((ai?.categories ?? []).map((c) => [c.id, c]))
  const applyAi = () => {
    if (!ai) return
    setDraft((d) => {
      if (!d) return d
      const limits = { ...d.limits }
      for (const c of ai.categories) limits[c.id] = c.amount
      return { ...d, limits, savings: ai.savings ?? d.savings }
    })
  }

  const askAi = () => {
    const { request, keyToId } = buildPlanRequest({ target: month, draft, baseline, goal })
    suggest.mutate(request, {
      onSuccess: (s) =>
        setAi({
          ...s,
          categories: s.categories
            .filter((c) => keyToId[c.id])
            .map((c) => ({ ...c, id: keyToId[c.id] })),
        }),
    })
  }

  const goalLeft = goal ? Math.max(goal.target_amount - goal.current_amount, 0) : 0
  const monthsToGoal =
    goal && goalLeft > 0 && draft.savings > 0 ? Math.ceil(goalLeft / draft.savings) : null
  const lastYearLabel = shortMonthYear.format(
    new Date(Number(month.slice(0, 4)) - 1, Number(month.slice(5)) - 1, 1),
  )

  const onSave = () => {
    save.mutate(
      {
        month,
        income: draft.income,
        savings: draft.savings,
        limits: Object.fromEntries(activeIds.map((id) => [id, draft.limits[id] ?? 0])),
        note: draft.note.trim() || null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Shell
      month={month}
      onClose={onClose}
      status={existing.data ? 'Editing the saved plan' : 'Not saved yet'}
      footer={
        <>
          {save.error && (
            <p className="mb-2 text-sm text-red-300">
              Not saved: {(save.error as Error).message}. Has migration 0005 been run?
            </p>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={save.isPending}
            className="h-14 w-full rounded-2xl bg-white text-lg font-bold text-ink transition active:scale-[0.99] disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : `Save ${formatMonthName(month)} plan`}
          </button>
        </>
      }
    >
      <div className="space-y-5 px-4 pb-6">
        {/* ---------- the whole month on one card ---------- */}
        <section className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <Row
            label="Income"
            hint={
              baseline.typicalIncome !== null && baseline.typicalIncome !== draft.income ? (
                <Hint
                  onClick={() =>
                    setDraft({ ...draft, income: Math.round(baseline.typicalIncome!) })
                  }
                >
                  typical {formatAmount(Math.round(baseline.typicalIncome))}
                </Hint>
              ) : null
            }
          >
            <MoneyInput
              label="Planned income"
              value={draft.income}
              onChange={(income) => setDraft({ ...draft, income })}
            />
          </Row>
          <Row
            label="Savings"
            hint={
              goal ? (
                <span className="text-xs text-muted">
                  {monthsToGoal
                    ? `${goal.name} in ~${monthsToGoal} ${monthsToGoal === 1 ? 'month' : 'months'}`
                    : goalLeft > 0
                      ? `${formatAmount(goalLeft)} to ${goal.name}`
                      : `${goal.name} reached`}
                </span>
              ) : null
            }
          >
            <MoneyInput
              label="Planned savings"
              value={draft.savings}
              onChange={(savings) => setDraft({ ...draft, savings })}
            />
          </Row>
          <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3 text-sm">
            <span className="text-muted">Spending limits</span>
            <span className="font-semibold tabular-nums text-white">
              {formatMoneyCompact(spending)}
            </span>
          </div>
          <UnassignedBar income={draft.income} unassigned={unassigned} />
        </section>

        {/* ---------- what makes this month different ---------- */}
        <section>
          <label
            htmlFor="plan-note"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            What’s different about {formatMonthName(month)}?
          </label>
          <textarea
            id="plan-note"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            maxLength={500}
            rows={2}
            placeholder="e.g. car insurance 1,200 zł, a birthday, a weekend in Kraków"
            className="w-full resize-none rounded-xl bg-white/5 px-3 py-2.5 text-white outline-none ring-1 ring-white/10 placeholder:text-muted/60 focus:ring-white/40"
          />
          <p className="mt-1 text-xs text-muted">
            Saved with the plan, and the AI draft takes it into account.
          </p>
        </section>

        {/* ---------- AI draft ---------- */}
        <section className="rounded-3xl bg-gradient-to-br from-indigo-500/15 to-emerald-400/10 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">✦ AI draft</h2>
            {ai && (
              <button
                type="button"
                onClick={applyAi}
                className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-ink active:opacity-80"
              >
                Use all
              </button>
            )}
          </div>
          {ai ? (
            <div className="mt-2 space-y-2">
              <p className="text-[15px] leading-snug text-white">{ai.summary}</p>
              {ai.savings !== null && (
                <p className="text-sm text-slate-300">
                  Suggested savings:{' '}
                  <span className="font-semibold text-emerald-300">
                    {formatAmount(ai.savings)} {CURRENCY_SUFFIX}
                  </span>
                </p>
              )}
              {ai.tips.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm leading-snug text-slate-300">
                  {ai.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">
                Per-category suggestions are shown under each category below. Written by {ai.model}{' '}
                — a suggestion, not financial advice.
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-300">
              Drafts limits from{' '}
              {baseline.months.length
                ? `your last ${baseline.months.length} ${baseline.months.length === 1 ? 'month' : 'months'}`
                : 'your defaults'}
              , the season and your note above.
            </p>
          )}
          <button
            type="button"
            onClick={askAi}
            disabled={suggest.isPending}
            className="mt-3 w-full rounded-2xl bg-white/10 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 active:bg-white/20 disabled:opacity-50"
          >
            {suggest.isPending ? 'Thinking…' : ai ? 'Draft again' : 'Draft a plan with AI'}
          </button>
          {suggest.error && (
            <p className="mt-2 text-sm text-red-300">
              {suggest.error instanceof PlanUnavailableError
                ? suggest.error.message
                : `Couldn’t draft a plan: ${(suggest.error as Error).message}`}
            </p>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Sent to Gemini: monthly totals per category and of income, the goal, and your note. No
            individual expenses.
          </p>
        </section>

        {/* ---------- per category ---------- */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Limits</h2>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {previous.data && (
                <FillChip onClick={() => fill('previous')}>
                  {formatMonthName(prevMonth)}’s plan
                </FillChip>
              )}
              {baseline.months.length > 0 && (
                <FillChip onClick={() => fill('typical')}>Typical</FillChip>
              )}
              <FillChip onClick={() => fill('defaults')}>Defaults</FillChip>
            </div>
          </div>
          <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/5">
            {baseline.categories.map(({ category, typical, last, sameMonthLastYear }) => {
              const value = draft.limits[category.id] ?? 0
              const suggestion = aiById.get(category.id)
              return (
                <li key={category.id} className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">
                      {category.name}
                    </span>
                    <div className="w-32 shrink-0">
                      <MoneyInput
                        label={`${category.name} limit`}
                        value={value}
                        onChange={(v) => setLimit(category.id, v)}
                      />
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 pl-5">
                    {typical !== null && (
                      <Hint
                        active={value === roundUpPlan(typical)}
                        onClick={() => setLimit(category.id, roundUpPlan(typical))}
                      >
                        typical {formatAmount(Math.round(typical))}
                      </Hint>
                    )}
                    {last !== null && (
                      <Hint
                        active={value === roundUpPlan(last)}
                        onClick={() => setLimit(category.id, roundUpPlan(last))}
                      >
                        last {formatAmount(Math.round(last))}
                      </Hint>
                    )}
                    {sameMonthLastYear !== null && sameMonthLastYear > 0 && (
                      <Hint
                        active={value === roundUpPlan(sameMonthLastYear)}
                        onClick={() => setLimit(category.id, roundUpPlan(sameMonthLastYear))}
                      >
                        {lastYearLabel} {formatAmount(Math.round(sameMonthLastYear))}
                      </Hint>
                    )}
                  </div>
                  {suggestion && (
                    <button
                      type="button"
                      onClick={() => setLimit(category.id, suggestion.amount)}
                      className={`mt-2 ml-5 block rounded-xl px-2.5 py-1.5 text-left text-xs leading-snug ring-1 transition ${
                        value === suggestion.amount
                          ? 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/30'
                          : 'bg-indigo-400/10 text-indigo-100 ring-indigo-300/25 active:bg-indigo-400/20'
                      }`}
                    >
                      <span className="font-semibold">
                        ✦ {formatAmount(suggestion.amount)} {CURRENCY_SUFFIX}
                        {value === suggestion.amount ? ' · used' : ' · tap to use'}
                      </span>
                      <span className="block text-slate-300">{suggestion.reason}</span>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {baseline.months.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              “Typical” is the average of the last {Math.min(3, baseline.months.length)} complete
              months. Chips round up to 10 {CURRENCY_SUFFIX}.
            </p>
          )}
        </section>

        {existing.data && (
          <button
            type="button"
            onClick={() => remove.mutate(month, { onSuccess: onClose })}
            className="w-full rounded-2xl py-3 text-sm font-semibold text-red-400 ring-1 ring-red-400/30 active:bg-red-500/10"
          >
            Remove {formatMonthName(month)}’s plan (back to default limits)
          </button>
        )}
      </div>
    </Shell>
  )
}

function Shell({
  month,
  onClose,
  status,
  footer,
  children,
}: {
  month: MonthKey
  onClose: () => void
  status?: string
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    // full-screen overlay — covers the bottom navigation too
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col overflow-y-auto bg-ink">
      <header className="flex items-center gap-2 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="-ml-2 shrink-0 rounded-full px-2 py-2 text-2xl leading-none text-muted active:bg-white/10"
        >
          ←
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-white">Plan {formatMonth(month)}</h1>
          {status && <p className="text-xs text-muted">{status}</p>}
        </div>
      </header>
      <div className="flex-1">{children}</div>
      {footer && (
        <div className="sticky bottom-0 border-t border-white/10 bg-ink/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur">
          {footer}
        </div>
      )}
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
        {hint && <div className="mt-0.5">{hint}</div>}
      </div>
      <div className="w-36 shrink-0">{children}</div>
    </div>
  )
}

function Hint({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2 py-0.5 text-xs tabular-nums ring-1 transition ${
        active
          ? 'bg-white/15 text-white ring-white/40'
          : 'text-muted ring-white/10 active:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function FillChip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/10 active:bg-white/10"
    >
      {children}
    </button>
  )
}

/** Where the zero-based plan stands: money without a job, exactly balanced, or over-committed. */
function UnassignedBar({ income, unassigned }: { income: number; unassigned: number }) {
  if (income <= 0) {
    return (
      <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-muted">
        Add the income you expect to see whether the plan fits.
      </p>
    )
  }
  const balanced = Math.abs(unassigned) < 1
  const over = unassigned < 0
  return (
    <div
      className={`mt-3 flex items-baseline justify-between rounded-xl px-3 py-2.5 ${
        balanced ? 'bg-emerald-400/15' : over ? 'bg-red-500/15' : 'bg-amber-400/10'
      }`}
    >
      <span
        className={`text-sm font-semibold ${balanced ? 'text-emerald-300' : over ? 'text-red-300' : 'text-amber-200'}`}
      >
        {balanced ? 'Every złoty has a job ✓' : over ? 'Over income by' : 'Not assigned yet'}
      </span>
      {!balanced && (
        <span
          className={`text-lg font-bold tabular-nums ${over ? 'text-red-300' : 'text-amber-200'}`}
        >
          {formatMoneyCompact(Math.abs(unassigned))}
        </span>
      )}
    </div>
  )
}
