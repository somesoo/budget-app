import { useEffect, useState } from 'react'
import { ArrowUp } from '@phosphor-icons/react'
import { DesktopAdd } from '../components/add/DesktopAdd'
import { GoalPicker, GoalsTile } from '../components/add/GoalPicker'
import { useGoalTrips } from '../hooks/useGoalTrips'
import { CategoryPager } from '../components/CategoryPager'
import { PrivateOverTile } from '../components/CategoryTile'
import { AmountPad } from '../components/AmountPad'
import { IncomePad } from '../components/IncomePad'
import { AskLink } from '../components/AskLink'
import { Screen } from '../components/Screen'
import { SettingsLink } from '../components/SettingsLink'
import { WidgetCarousel } from '../components/add/WidgetCarousel'
import { useAddWidgets } from '../components/add/widgets'
import { useMonthCategories } from '../hooks/useBudgets'
import { useAddExpense, useMonthlyExpenses } from '../hooks/useExpenses'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { useAddIncome } from '../hooks/useIncomes'
import { LAPTOP, useMediaQuery } from '../hooks/useMediaQuery'
import { usePrefs } from '../hooks/usePrefs'
import { useMonthMoney } from '../hooks/useMonthMoney'
import { useSavingsOverview } from '../hooks/useSavings'
import { BottomSheet } from '../components/history/BottomSheet'
import { PaycheckCard } from '../components/budget/PaycheckCard'
import {
  currentMonthKey,
  daysInMonth,
  formatDayLong,
  formatMoney,
  formatMoneyCompact,
  monthKeyOfDate,
  isOverLimit,
  sumByCategory,
  sumExpenses,
  todayKey,
} from '../lib/calculations'
import { crossingNote, limitImpact } from '../lib/alerts'
import { isOthersAllowance, ownCategories } from '../lib/allowance'
import { elapsedDays, paceStatus, type PaceStatus } from '../lib/insights'
import type { Category, Person } from '../types'
import { personIds, personLabel } from '../lib/people'
import { t } from '../i18n'

const PACE_COLOR: Record<PaceStatus, string> = {
  under: 'text-positive',
  on: 'text-slate-300',
  over: 'text-red-300',
}
const paceLabel = (pace: PaceStatus) => t(`home.pace.${pace}`)

export function Home() {
  const month = currentMonthKey()
  const { person: devicePerson } = useDeviceUser()
  // limits come from this month's plan where it has one
  const { data: allCategories = [], isLoading, error } = useMonthCategories(month)
  // shared categories and this phone's own allowance, not the other one's
  const categories = ownCategories(
    allCategories.filter((c) => !c.archived),
    devicePerson,
  )
  const { data: expenses = [] } = useMonthlyExpenses(month)
  const spentByCategory = sumByCategory(expenses)
  // someone else's allowance shows up only once it's over its limit, and says only that
  const partnersOver = allCategories.filter(
    (c) =>
      !c.archived &&
      isOthersAllowance(c, devicePerson) &&
      isOverLimit(spentByCategory[c.id] ?? 0, c.monthly_limit),
  )
  const addExpense = useAddExpense()
  const addIncome = useAddIncome()
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [goalsOpen, setGoalsOpen] = useState(false)

  const [selected, setSelected] = useState<Category | null>(null)
  // Person for this one expense — defaults to whoever owns the phone, but can be
  // overridden with one tap (e.g. when someone borrows the phone).
  const [entryPerson, setEntryPerson] = useState<Person>(devicePerson ?? personIds()[0])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(id)
  }, [toast])

  const monthTotal = sumExpenses(expenses)
  const monthLimit = categories.reduce((a, c) => a + c.monthly_limit, 0)
  const left = monthLimit - monthTotal
  const money = useMonthMoney(month)
  const safe = money.safe
  const free = safe ? safe.amount : left
  // pace is about the everyday spending, not rent and bills paid once a month
  const flexible = categories.filter((c) => c.kind === 'monthly' && c.show_in_chart)
  const pace = paceStatus(
    flexible.reduce((a, c) => a + (spentByCategory[c.id] ?? 0), 0),
    flexible.reduce((a, c) => a + c.monthly_limit, 0),
    elapsedDays(month),
    daysInMonth(month),
  )
  const savings = useSavingsOverview()
  /** Right after a paycheck is logged: where the plan sends it. */
  const [payOutOpen, setPayOutOpen] = useState(false)

  const laptop = useMediaQuery(LAPTOP)
  const prefs = usePrefs()

  const goals = useGoalTrips()
  // spending from a goal is measured by all it has cost against its target, not by the month
  const spentOf = (c: Category) =>
    c.kind === 'project'
      ? (goals.all.find((g) => g.trip?.project.id === c.id)?.trip?.spent ?? 0)
      : (spentByCategory[c.id] ?? 0)
  const limitOf = (c: Category) => (c.kind === 'project' ? (c.budget_total ?? 0) : c.monthly_limit)

  const widgets = useAddWidgets({ expenses, categories, allCategories })

  const openCategory = (category: Category) => {
    setEntryPerson(devicePerson ?? personIds()[0])
    setSelected(category)
  }

  // a different screen on a laptop, not a stretched phone one
  if (laptop) return <DesktopAdd />

  if (incomeOpen) {
    return (
      <IncomePad
        person={entryPerson}
        onPersonChange={setEntryPerson}
        onCancel={() => setIncomeOpen(false)}
        saving={addIncome.isPending}
        onSave={({ amount, person, note, date, forMonth, oneOff }) => {
          addIncome.mutate(
            { amount, person, note, income_date: date, for_month: forMonth, one_off: oneOff },
            { onError: (err) => setToast(t('entry.notSaved', { error: (err as Error).message })) },
          )
          setIncomeOpen(false)
          // pay the plan's savings out straight away, while the money is there;
          // a one-off isn't the paycheck the plan was made around
          if (
            !oneOff &&
            money.plan &&
            savings.available &&
            (money.plan.allocations.length > 0 || money.plan.carryover.length > 0) &&
            (forMonth ?? monthKeyOfDate(date)) === month
          ) {
            setPayOutOpen(true)
          }
          setToast(
            date === todayKey()
              ? t('home.incomeSaved')
              : `${t('home.incomeSaved')} · ${formatDayLong(date)}`,
          )
        }}
      />
    )
  }

  if (selected) {
    return (
      <AmountPad
        category={selected}
        spent={spentOf(selected)}
        person={entryPerson}
        onPersonChange={setEntryPerson}
        onCancel={() => setSelected(null)}
        saving={addExpense.isPending}
        onSave={({ amount, person, note, date }) => {
          addExpense.mutate(
            {
              amount,
              category_id: selected.id,
              person,
              note,
              expense_date: date,
            },
            { onError: (err) => setToast(t('entry.notSaved', { error: (err as Error).message })) },
          )
          setSelected(null)
          // a backdated expense lands in another month, whose limits aren't on screen
          const crossed =
            selected.kind === 'project' || monthKeyOfDate(date) === month
              ? crossingNote(
                  selected,
                  limitImpact(spentOf(selected), amount, limitOf(selected), prefs.nearRatio),
                )
              : null
          setToast(
            crossed
              ? t('entry.savedCrossed', { note: crossed })
              : date === todayKey()
                ? t('home.saved')
                : `${t('home.saved')} · ${formatDayLong(date)}`,
          )
        }}
      />
    )
  }

  return (
    <Screen title={t('home.title')} hideTitle fill>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        {/* what's free to spend, coloured by how the flexible spending keeps pace */}
        <p
          data-tour="safe"
          aria-label={[
            t(safe ? 'home.safeLabel' : 'home.leftLabel', {
              amount: `${free < 0 ? '−' : ''}${formatMoney(Math.abs(free))}`,
            }),
            pace ? paceLabel(pace) : null,
          ]
            .filter(Boolean)
            .join(', ')}
          className={`min-w-0 truncate text-xl font-bold tabular-nums ${pace ? PACE_COLOR[pace] : 'text-white'}`}
        >
          {free < 0 ? '−' : ''}
          {formatMoneyCompact(Math.abs(free))}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <span data-tour="ask" className="flex">
            <AskLink question={t('home.askQuestion')} />
          </span>
          <button
            type="button"
            onClick={() => {
              setEntryPerson(devicePerson ?? personIds()[0])
              setIncomeOpen(true)
            }}
            data-tour="income"
            aria-label={t('home.addIncome')}
            title={t('home.addIncome')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-soft ring-1 ring-accent/25 hover:bg-accent/20 active:bg-accent/25"
          >
            <ArrowUp weight="bold" aria-hidden />
          </button>
          <SettingsLink />
        </div>
      </div>

      {error && (
        <p className="mb-3 shrink-0 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">
          {t('add.loadFailed', { error: (error as Error).message })}
        </p>
      )}

      {/* all switched off in Settings: the tiles get the room */}
      {widgets.length > 0 && (
        <div data-tour="widgets" className="mb-3 shrink-0">
          <WidgetCarousel widgets={widgets} />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : (
        <CategoryPager
          categories={categories}
          spentByCategory={spentByCategory}
          onSelect={openCategory}
          // next to the Goals tile, after everything this phone logs into
          extra={partnersOver.map((c) => ({
            key: c.id,
            render: (height) => (
              <PrivateOverTile
                category={c}
                spent={spentByCategory[c.id] ?? 0}
                owner={personLabel(c.owner)}
                height={height}
              />
            ),
          }))}
          trailing={
            goals.open.length > 0
              ? (height) => (
                  <GoalsTile goals={goals.open} height={height} onClick={() => setGoalsOpen(true)} />
                )
              : undefined
          }
        />
      )}

      {payOutOpen && money.plan && (
        <BottomSheet title={t('paycheck.title')} onClose={() => setPayOutOpen(false)}>
          <p className="mb-2 text-sm text-slate-300">
            {t('home.payOutHelp')}
          </p>
          <PaycheckCard month={month} plan={money.plan} overview={savings} bare />
        </BottomSheet>
      )}

      {goalsOpen && (
        <GoalPicker
          goals={goals.open}
          onClose={() => setGoalsOpen(false)}
          onPick={async ({ goal }) => {
            const category = await goals.ensureTrip(goal)
            setGoalsOpen(false)
            openCategory(category)
          }}
        />
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 lg:bottom-8 lg:left-60">
          <div className="rounded-full bg-slate-50 px-5 py-2.5 text-sm font-semibold text-ink shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </Screen>
  )
}

