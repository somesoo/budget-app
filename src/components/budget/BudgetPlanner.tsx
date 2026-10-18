import { useFeature } from '../../hooks/usePrefs'
import { ArrowLeft, CaretLeft, CaretRight, Check, Lightbulb, Sparkle } from '@phosphor-icons/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { MoneyInput } from './MoneyInput'
import { SavingsSplit, hasSplitTargets } from './SavingsSplit'
import { CarryoverPicker } from './CarryoverPicker'
import { useMonthMoney } from '../../hooks/useMonthMoney'
import { CategoryDetail } from '../category/CategoryDetail'
import { PlanCheckList, RecurringList, SuggestionList } from './PlanSuggestions'
import { CURRENCY_SUFFIX } from '../../config'
import {
  useBudget,
  useDeleteBudget,
  useSaveBudget,
  useSuggestPlan,
  PlanUnavailableError,
} from '../../hooks/useBudgets'
import { useCategories } from '../../hooks/useCategories'
import { useMonthlyExpensesBetween } from '../../hooks/useExpenses'
import { usePrimaryGoal, useSavingsOverview } from '../../hooks/useSavings'
import { useIncomesBetween } from '../../hooks/useIncomes'
import {
  formatAmount,
  formatMoneyCompact,
  formatMonth,
  formatMonthName,
  monthRange,
  plainDashes,
  shiftMonth,
  type MonthKey,
} from '../../lib/calculations'
import {
  buildPlanRequest,
  draftFrom,
  draftTotals,
  historyMonths,
  planBaseline,
  plannerReady,
  roundUpPlan,
  type FillSource,
  type PlanDraft,
} from '../../lib/planning'
import { planChecks, planSuggestions, recurringCosts, type Suggestion } from '../../lib/suggestions'
import { carryAllocations, defaultGoalAccount, sumAllocations } from '../../lib/allocations'
import { loanLines } from '../../lib/loans'
import type { PlanAllocation, PlanSuggestion } from '../../types'
import { dateFormat, t } from '../../i18n'
import { Trans } from '../../i18n/Trans'

interface Props {
  month: MonthKey
  onClose: () => void
}

const shortMonthYear = () => dateFormat({ month: 'short', year: '2-digit' })

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

  const { data: allCategories = [], isLoading: categoriesLoading } = useCategories()
  // trips and other projects have their own budget, not a monthly limit
  const categories = useMemo(
    () => allCategories.filter((c) => !c.archived && c.kind !== 'project'),
    [allCategories],
  )
  const existing = useBudget(month)
  const previous = useBudget(prevMonth)
  // what the history says: this chapter only, unless this phone lets past ones count
  const expenses = useMonthlyExpensesBetween(from, to, 'plan')
  const incomes = useIncomesBetween(from, to, false, 'plan')
  const { data: goal } = usePrimaryGoal()
  const savingsOverview = useSavingsOverview()
  const prevMoney = useMonthMoney(prevMonth)
  const save = useSaveBudget()
  const remove = useDeleteBudget()
  const suggest = useSuggestPlan()
  const showAi = useFeature('ai')

  const ready = plannerReady({
    categoriesLoaded: !categoriesLoading,
    existingLoaded: !existing.isLoading,
    previousLoaded: !previous.isLoading,
    expensesLoaded: !expenses.isLoading,
    incomesLoaded: !incomes.isLoading,
  })

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
  /** The category opened up in the three-pane view, or null for the list. */
  const [focused, setFocused] = useState<string | null>(null)

  // last month's savings lines carry over, except to goals and accounts closed since
  const keepAllocation = (a: PlanAllocation) =>
    !savingsOverview.available ||
    carryAllocations(
      [a],
      new Set(savingsOverview.goals.filter((g) => !g.goal.archived).map((g) => g.goal.id)),
      new Set(savingsOverview.accounts.filter((x) => !x.account.archived).map((x) => x.account.id)),
    ).length > 0
  // the month's own lines stay unless their goal, account or loan was deleted since
  const keepExisting = (a: PlanAllocation) =>
    !savingsOverview.available ||
    (a.loan_id ? savingsOverview.loans.some((l) => l.loan.id === a.loan_id) : true) &&
    carryAllocations(
      [a],
      new Set(savingsOverview.goals.map((g) => g.goal.id)),
      new Set(savingsOverview.accounts.map((x) => x.account.id)),
    ).length > 0
  const savingsLoading = savingsOverview.isLoading

  // first draft: the month's own plan, else last month's, else typical spending
  useEffect(() => {
    if (!ready || savingsLoading || draft) return
    const fresh = draftFrom({
      source: previous.data ? 'previous' : baseline.months.length ? 'typical' : 'defaults',
      categories,
      baseline,
      previousPlan: previous.data ?? null,
      existing: existing.data,
      keepAllocation,
      keepExisting,
      instalments: loanLines(savingsOverview.loans),
    })
    // nowhere chosen for the leftover yet: the emergency fund first, while it's short
    const emergency = savingsOverview.goals.find(
      (g) => g.goal.is_emergency && !g.goal.archived && g.status.kind !== 'reached',
    )
    if (!existing.data && fresh.carryover.length === 0 && emergency) {
      fresh.carryover = [
        {
          goal_id: emergency.goal.id,
          account_id: defaultGoalAccount(emergency, savingsOverview.accounts.map((a) => a.account)),
          share: 100,
        },
      ]
    }
    setDraft(fresh)
    // keepAllocation, keepExisting and the loans read the savings lists, loaded by now
  }, [ready, savingsLoading, draft, previous.data, existing.data, baseline, categories])

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
          // the chips refill the limits; where the savings go stays as set
          savings: d.savings,
          allocations: d.allocations,
          carryover: d.carryover,
          carryoverKeep: d.carryoverKeep,
        },
    )

  const aiById = new Map((ai?.categories ?? []).map((c) => [c.id, c]))

  // worked out against the draft as it stands: an applied suggestion drops out
  const history = expenses.data ?? []
  const suggestions = planSuggestions({
    target: month,
    baseline,
    draftLimits: draft.limits,
    expenses: history,
  })
  const suggestedIds = new Set(suggestions.map((s) => s.categoryId))
  const recurring = recurringCosts(history, baseline.months)
  const checks = planChecks({ draft, baseline, activeIds, goal })
  const categoriesById = Object.fromEntries(allCategories.map((c) => [c.id, c]))
  const applySuggestion = (s: Suggestion) =>
    setDraft((d) => {
      if (!d) return d
      const note =
        s.noteLine && !d.note.includes(s.noteLine)
          ? [d.note.trim(), s.noteLine].filter(Boolean).join(', ')
          : d.note
      return { ...d, limits: { ...d.limits, [s.categoryId]: s.limit }, note }
    })
  const applyAi = () => {
    if (!ai) return
    setDraft((d) => {
      if (!d) return d
      const limits = { ...d.limits }
      for (const c of ai.categories) limits[c.id] = c.amount
      // the goals and IKE payments stay; the suggestion can only change what's left over
      const savings =
        ai.savings === null ? d.savings : Math.max(ai.savings, sumAllocations(d.allocations))
      return { ...d, limits, savings }
    })
  }

  const askAi = () => {
    const { request, keyToId } = buildPlanRequest({
      target: month,
      draft,
      baseline,
      goal,
      suggestions,
      recurring,
    })
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
  const lastYearLabel = shortMonthYear().format(
    new Date(Number(month.slice(0, 4)) - 1, Number(month.slice(5)) - 1, 1),
  )

  const onSave = () => {
    save.mutate(
      {
        month,
        income: draft.income,
        savings: draft.savings,
        limits: Object.fromEntries(activeIds.map((id) => [id, draft.limits[id] ?? 0])),
        allocations: draft.allocations,
        carryover: draft.carryover,
        carryover_keep: draft.carryover.length > 0 ? draft.carryoverKeep : 0,
        note: draft.note.trim() || null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Shell
      month={month}
      onClose={focused ? () => setFocused(null) : onClose}
      status={existing.data ? t('planner.editing') : t('planner.notSaved')}
      fit={focused !== null}
      footer={
        <>
          {save.error && (
            <p className="mb-2 text-sm text-red-300 lg:mb-0 lg:mr-auto">
              {t('planner.saveFailed', { error: (save.error as Error).message })}
            </p>
          )}
          <p className="hidden text-sm text-muted lg:mr-auto lg:block">
            {balanceNote(draft.income, unassigned)}
          </p>
          <button
            type="button"
            onClick={onSave}
            disabled={save.isPending}
            className="h-14 w-full rounded-2xl bg-slate-100 text-lg font-bold text-ink transition short:lg:h-10 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 lg:h-12 lg:w-auto lg:px-10 lg:text-base"
          >
            {save.isPending
              ? t('common.saving')
              : t('planner.save', { month: formatMonthName(month) })}
          </button>
        </>
      }
    >
      {focused ? (
        <FocusedCategory
          month={month}
          categoryId={focused}
          categories={categories}
          draftLimits={draft.limits}
          onSelect={setFocused}
          onBack={() => setFocused(null)}
          extras={(id) => {
            const mine = suggestions.filter((s) => s.categoryId === id)
            return mine.length > 0 ? (
              <SuggestionList suggestions={mine} onApply={applySuggestion} compact />
            ) : null
          }}
          editor={(id, name) => (
            <MoneyInput
              label={t('planner.limitOf', { name })}
              value={draft.limits[id] ?? 0}
              onChange={(v) => setLimit(id, v)}
            />
          )}
        />
      ) : (
        <div className="space-y-5 px-4 pb-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8 lg:space-y-0 lg:px-0">
          <div className="space-y-5 lg:sticky lg:top-0">
            {/* ---------- the whole month on one card ---------- */}
            <section className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <Row
                label={t('entry.income')}
                hint={
                  baseline.typicalIncome !== null && baseline.typicalIncome !== draft.income ? (
                    <Hint
                      onClick={() =>
                        setDraft({ ...draft, income: Math.round(baseline.typicalIncome!) })
                      }
                    >
                      {t('planner.typicalPay', {
                        amount: formatAmount(Math.round(baseline.typicalIncome)),
                      })}
                    </Hint>
                  ) : null
                }
              >
                <MoneyInput
                  label={t('planner.plannedIncome')}
                  value={draft.income}
                  onChange={(income) => setDraft({ ...draft, income })}
                />
              </Row>
              {hasSplitTargets(savingsOverview) ? (
                <SavingsSplit
                  month={month}
                  value={{ savings: draft.savings, allocations: draft.allocations }}
                  onChange={(split) => setDraft({ ...draft, ...split })}
                  overview={savingsOverview}
                />
              ) : (
                <Row
                  label={t('nav.savings')}
                  hint={
                    savingsOverview.available && savingsOverview.neededPerMonth > 0 ? (
                      <Hint
                        active={draft.savings === roundUpPlan(savingsOverview.neededPerMonth)}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            savings: roundUpPlan(savingsOverview.neededPerMonth),
                          })
                        }
                      >
                        {t('planner.goalsNeed', {
                          amount: formatAmount(Math.round(savingsOverview.neededPerMonth)),
                        })}
                      </Hint>
                    ) : goal && !savingsOverview.available ? (
                      <span className="text-xs text-muted">
                        {monthsToGoal
                          ? t('planner.goalIn', { name: goal.name, count: monthsToGoal })
                          : goalLeft > 0
                            ? t('planner.goalLeft', { amount: formatAmount(goalLeft), name: goal.name })
                            : t('planner.goalReached', { name: goal.name })}
                      </span>
                    ) : null
                  }
                >
                  <MoneyInput
                    label={t('planner.plannedSavings')}
                    value={draft.savings}
                    onChange={(savings) => setDraft({ ...draft, savings })}
                  />
                </Row>
              )}
              <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3 text-sm">
                <span className="text-muted">{t('planner.spendingLimits')}</span>
                <span className="font-semibold tabular-nums text-white">
                  {formatMoneyCompact(spending)}
                </span>
              </div>
              <UnassignedBar income={draft.income} unassigned={unassigned} />
            </section>

            {/* ---------- where last month's leftover goes ---------- */}
            <CarryoverPicker
              prevMonth={prevMonth}
              leftover={prevMoney.leftover}
              final={prevMoney.final}
              value={draft.carryover}
              onChange={(carryover) => setDraft({ ...draft, carryover })}
              keep={draft.carryoverKeep}
              onKeepChange={(carryoverKeep) => setDraft({ ...draft, carryoverKeep })}
              planned={plannedByGoal(draft.allocations)}
              overview={savingsOverview}
            />

            {/* ---------- what makes this month different ---------- */}
            <section>
              <label
                htmlFor="plan-note"
                className="mb-1.5 block text-base font-semibold text-white"
              >
                {t('planner.noteLabel', { month: formatMonthName(month) })}
              </label>
              <textarea
                id="plan-note"
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                maxLength={500}
                rows={2}
                placeholder={t('planner.notePlaceholder')}
                className="w-full resize-none rounded-xl bg-white/5 px-3 py-2.5 text-white outline-none ring-1 ring-white/10 placeholder:text-muted/60 focus:ring-white/40"
              />
              <p className="mt-1 text-xs text-muted">
                {t('planner.noteHelp')}
              </p>
            </section>

            {/* ---------- AI draft ---------- */}
            {showAi && (
              <section className="rounded-3xl bg-accent/10 p-4 ring-1 ring-accent/25">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    <Sparkle weight="fill" aria-hidden />
                    {t('planner.aiDraft')}
                  </h2>
                  {ai && (
                    <button
                      type="button"
                      onClick={applyAi}
                      className="rounded-full bg-slate-50 px-3 py-1.5 text-sm font-bold text-ink active:opacity-80"
                    >
                      {t('planner.useAll')}
                    </button>
            )}
              </div>
              {ai ? (
                <div className="mt-2 space-y-2">
                  <p className="text-[15px] leading-snug text-white">{plainDashes(ai.summary)}</p>
                  {ai.savings !== null && (
                    <p className="text-sm text-slate-300">
                      <Trans
                        k="planner.suggestedSavings"
                        values={{ amount: `${formatAmount(ai.savings)} ${CURRENCY_SUFFIX}` }}
                        tags={{ b: (s) => <span className="font-semibold text-white">{s}</span> }}
                      />
                    </p>
                  )}
                  {ai.tips.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm leading-snug text-slate-300">
                      {ai.tips.map((tip, i) => (
                        <li key={i}>{plainDashes(tip)}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted">
                    {t('planner.aiFootnote', { model: ai.model })}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-300">
                  {baseline.months.length
                    ? t('planner.aiIntroHistory', { count: baseline.months.length })
                    : t('planner.aiIntroDefaults')}
                </p>
              )}
              <button
                type="button"
                onClick={askAi}
                disabled={suggest.isPending}
                className="mt-3 w-full rounded-2xl bg-white/10 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 active:bg-white/20 disabled:opacity-50"
              >
                {suggest.isPending
                  ? t('advice.thinking')
                  : ai
                    ? t('planner.draftAgain')
                    : t('planner.draft')}
              </button>
              {suggest.error && (
                <p className="mt-2 text-sm text-red-300">
                  {suggest.error instanceof PlanUnavailableError
                    ? suggest.error.message
                    : t('planner.draftFailed', { error: (suggest.error as Error).message })}
                </p>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                {t('planner.aiSent')}
              </p>
            </section>
            )}

            {/* ---------- from the history ---------- */}
            {suggestions.length > 0 && (
              <section aria-labelledby="plan-suggestions">
                <h2 id="plan-suggestions" className="mb-2 text-base font-semibold text-white">
                  {t('planner.suggestions')}
                </h2>
                <SuggestionList suggestions={suggestions} onApply={applySuggestion} />
              </section>
            )}

            {recurring.length > 0 && (
              <section aria-labelledby="plan-recurring">
                <h2 id="plan-recurring" className="mb-2 text-base font-semibold text-white">
                  {t('planner.recurring')}
                </h2>
                <RecurringList items={recurring} categories={categoriesById} />
              </section>
            )}

            <section aria-labelledby="plan-check">
              <h2 id="plan-check" className="mb-2 text-base font-semibold text-white">
                {t('planner.checks')}
              </h2>
              <PlanCheckList checks={checks} />
            </section>
          </div>

          {/* ---------- per category ---------- */}
          <div className="space-y-5">
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-white">{t('planner.limits')}</h2>
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                  {previous.data && (
                    <FillChip onClick={() => fill('previous')}>
                      {t('planner.fillPrevious', { month: formatMonthName(prevMonth) })}
                    </FillChip>
                  )}
                  {baseline.months.length > 0 && (
                    <FillChip onClick={() => fill('typical')}>{t('planner.fillTypical')}</FillChip>
                  )}
                  <FillChip onClick={() => fill('defaults')}>{t('planner.fillDefaults')}</FillChip>
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
                        <button
                          type="button"
                          onClick={() => setFocused(category.id)}
                          title={t('planner.openCategory')}
                          className="group flex min-w-0 flex-1 items-center gap-1 text-left"
                        >
                          <span className="truncate text-[15px] font-medium text-white decoration-white/30 underline-offset-4 group-hover:underline">
                            {category.name}
                          </span>
                          {suggestedIds.has(category.id) && (
                            <Lightbulb
                              weight="fill"
                              aria-label={t('planner.hasSuggestion')}
                              className="shrink-0 text-accent-soft"
                            />
                          )}
                          <CaretRight
                            aria-hidden
                            className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-white"
                          />
                        </button>
                        <div className="w-32 shrink-0">
                          <MoneyInput
                            label={t('planner.limitOf', { name: category.name })}
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
                            {t('planner.chipTypical', { amount: formatAmount(Math.round(typical)) })}
                          </Hint>
                        )}
                        {last !== null && (
                          <Hint
                            active={value === roundUpPlan(last)}
                            onClick={() => setLimit(category.id, roundUpPlan(last))}
                          >
                            {t('planner.chipLast', { amount: formatAmount(Math.round(last)) })}
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
                              ? 'bg-accent/15 text-accent-soft ring-accent/40'
                              : 'bg-white/5 text-slate-100 ring-white/10 hover:bg-white/10 active:bg-white/10'
                          }`}
                        >
                          <span className="font-semibold">
                            <Sparkle
                              weight="fill"
                              aria-hidden
                              className="inline-block align-[-0.125em]"
                            />{' '}
                            {formatAmount(suggestion.amount)} {CURRENCY_SUFFIX}
                            {value === suggestion.amount ? ` · ${t('planner.used')}` : ` · ${t('planner.tapToUse')}`}
                          </span>
                          <span className="block text-slate-300">
                            {plainDashes(suggestion.reason)}
                          </span>
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
              {baseline.months.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  {t('planner.typicalNote', {
                    count: Math.min(3, baseline.months.length),
                    currency: CURRENCY_SUFFIX,
                  })}
                </p>
              )}
            </section>

            {existing.data && (
              <button
                type="button"
                onClick={() => remove.mutate(month, { onSuccess: onClose })}
                className="w-full rounded-2xl py-3 text-sm font-semibold text-red-400 ring-1 ring-red-400/30 active:bg-red-500/10"
              >
                {t('planner.remove', { month: formatMonthName(month) })}
              </button>
            )}
          </div>
        </div>
      )}
    </Shell>
  )
}

function Shell({
  month,
  onClose,
  status,
  fit = false,
  footer,
  children,
}: {
  month: MonthKey
  onClose: () => void
  status?: string
  /** On a laptop, fit the content to the screen instead of scrolling it (the three-pane view). */
  fit?: boolean
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    // full-screen overlay: covers the bottom navigation (and the side one on a laptop) too
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col overflow-y-auto bg-ink lg:max-w-none">
      <header
        className={`mx-auto flex w-full items-center gap-2 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:max-w-7xl lg:px-8 lg:pb-5 lg:pt-6 ${
          // a short laptop screen needs every row for the three panes; the
          // category bar below says which plan this is instead
          fit ? 'short:lg:hidden' : ''
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.back')}
          className="-ml-2 shrink-0 rounded-full px-2 py-2 text-2xl leading-none text-muted active:bg-white/10"
        >
          <ArrowLeft />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-white lg:text-2xl lg:tracking-tight">
            {t('planner.title', { month: formatMonth(month) })}
          </h1>
          {status && <p className="text-xs text-muted">{status}</p>}
        </div>
      </header>
      <div className={`mx-auto w-full flex-1 lg:max-w-7xl lg:px-8 ${fit ? 'lg:min-h-0' : ''}`}>
        {children}
      </div>
      {footer && (
        <div
          className={`sticky bottom-0 border-t border-white/10 bg-ink/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur lg:px-0 lg:py-4 ${
            fit ? 'short:lg:py-2.5' : ''
          }`}
        >
          <div className="mx-auto lg:flex lg:max-w-7xl lg:items-center lg:justify-end lg:gap-4 lg:px-8">
            {footer}
          </div>
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

/** Goal id → what a plan's own savings lines put toward it (loan instalments aside). */
function plannedByGoal(lines: PlanAllocation[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of lines) {
    if (l.goal_id && !l.loan_id) out[l.goal_id] = (out[l.goal_id] ?? 0) + l.amount
  }
  return out
}

/** Where the zero-based plan stands: money without a job, exactly balanced, or over-committed. */
function UnassignedBar({ income, unassigned }: { income: number; unassigned: number }) {
  if (income <= 0) {
    return (
      <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-muted">
        {t('planner.addIncome')}
      </p>
    )
  }
  const balanced = Math.abs(unassigned) < 1
  const over = unassigned < 0
  return (
    <div
      className={`mt-3 flex items-baseline justify-between rounded-xl px-3 py-2.5 ${
        balanced ? 'bg-positive/15' : over ? 'bg-red-500/15' : 'bg-amber-400/10'
      }`}
    >
      <span
        className={`text-sm font-semibold ${balanced ? 'text-positive' : over ? 'text-red-300' : 'text-amber-200'}`}
      >
        {balanced ? (
          <>
            {t('planner.balanced')}{' '}
            <Check weight="bold" aria-hidden className="inline-block align-[-0.125em]" />
          </>
        ) : over ? (
          t('planner.overBy')
        ) : (
          t('planner.unassigned')
        )}
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

/** The footer's reminder, on a laptop, of where the zero-based plan stands. */
function balanceNote(planned: number, unassigned: number): string {
  if (planned <= 0) return t('planner.noteNoIncome')
  if (Math.abs(unassigned) < 1) return t('planner.noteBalanced')
  return unassigned < 0
    ? t('planner.noteOver', { amount: formatMoneyCompact(-unassigned) })
    : t('planner.noteUnassigned', { amount: formatMoneyCompact(unassigned) })
}

/**
 * One category of the plan, opened up: its history, forecast and share, with
 * the limit editable in place. The draft stays in the planner, so nothing is
 * lost going back to the list.
 */
function FocusedCategory({
  month,
  categoryId,
  categories,
  draftLimits,
  onSelect,
  onBack,
  editor,
  extras,
}: {
  month: MonthKey
  categoryId: string
  categories: { id: string; name: string; color: string }[]
  draftLimits: Record<string, number>
  onSelect: (id: string) => void
  onBack: () => void
  editor: (id: string, name: string) => ReactNode
  /** This category's suggestions, shown with the forecast. */
  extras: (id: string) => ReactNode
}) {
  const index = categories.findIndex((c) => c.id === categoryId)
  const category = categories[index]
  const step = (d: number) => categories[(index + d + categories.length) % categories.length]

  return (
    <div className="px-4 pb-6 lg:flex lg:h-full lg:flex-col lg:px-0 lg:pb-5 short:lg:pb-3 short:lg:pt-3">
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 short:lg:mb-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-300 ring-1 ring-white/10 hover:bg-white/5 active:bg-white/10"
        >
          {t('planner.allCategories')}
        </button>
        <h2 className="flex min-w-0 flex-1 items-center gap-2.5 text-xl font-bold text-white">
          {category && (
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded"
              style={{ backgroundColor: category.color }}
            />
          )}
          <span className="truncate">{category?.name}</span>
          <span className="hidden truncate text-base font-medium text-muted short:lg:inline">
            {t('planner.inPlan', { month: formatMonth(month) })}
          </span>
        </h2>
        {categories.length > 1 && index !== -1 && (
          <nav aria-label={t('planner.otherCategories')} className="flex items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => onSelect(step(-1).id)}
              aria-label={t('planner.previousCategory', { name: step(-1).name })}
              className="rounded-full px-3 py-1.5 text-muted ring-1 ring-white/10 hover:bg-white/5 hover:text-white"
            >
              <CaretLeft aria-hidden className="inline-block align-[-0.125em]" />
              <span className="ml-1.5 hidden lg:inline">{step(-1).name}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelect(step(1).id)}
              aria-label={t('planner.nextCategory', { name: step(1).name })}
              className="rounded-full px-3 py-1.5 text-muted ring-1 ring-white/10 hover:bg-white/5 hover:text-white"
            >
              <span className="mr-1.5 hidden lg:inline">{step(1).name}</span>
              <CaretRight aria-hidden className="inline-block align-[-0.125em]" />
            </button>
          </nav>
        )}
      </div>
      <div className="lg:min-h-0 lg:flex-1">
        <CategoryDetail
          categoryId={categoryId}
          month={month}
          draftLimits={draftLimits}
          limitEditor={category && editor(category.id, category.name)}
          planExtras={category && extras(category.id)}
          onSelectCategory={onSelect}
        />
      </div>
    </div>
  )
}
