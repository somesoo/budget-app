import { Receipt } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CURRENCY_SUFFIX } from '../../config'
import { usePrefs } from '../../hooks/usePrefs'
import { useMonthCategories } from '../../hooks/useBudgets'
import { useCategories } from '../../hooks/useCategories'
import { useBudgetAlerts } from '../../hooks/useBudgetAlerts'
import { useGoalTrips } from '../../hooks/useGoalTrips'
import { useDeviceUser } from '../../hooks/useDeviceUser'
import { useEntryActions } from '../../hooks/useEntryActions'
import { useAddExpense, useExpenses, useMonthlyExpenses } from '../../hooks/useExpenses'
import { useAddIncome, useIncomesBetween, useLastIncomes } from '../../hooks/useIncomes'
import {
  categoryById,
  currentMonthKey,
  daysInMonth,
  formatAmount,
  formatDayLong,
  formatMoney,
  formatMoneyCompact,
  formatMoneyWhole,
  monthKeyOfDate,
  monthRange,
  readableTextColor,
  sumByCategory,
  sumExpenses,
  todayKey,
} from '../../lib/calculations'
import { crossingNote, limitImpact } from '../../lib/alerts'
import { toEntries } from '../../lib/history'
import { categorySlices, elapsedDays } from '../../lib/insights'
import type { Category, Goal, Person } from '../../types'
import { CHART } from '../charts/theme'
import { SpendDonut } from '../charts/SpendDonut'
import { AlertStrip } from '../alerts/AlertList'
import { AmountField } from '../entry/AmountField'
import { LimitPreview } from '../entry/LimitPreview'
import { useAmountEntry } from '../entry/useAmountEntry'
import { DateChip, PersonToggle } from '../HeaderControls'
import { EntryDialogs } from '../history/EntryDialogs'
import { UserSwitcher } from '../UserSwitcher'
import { CategoryGrid } from './CategoryGrid'
import { GoalPicker, GoalsTile } from './GoalPicker'
import { RecentEntries } from './RecentEntries'
import { ownExpenses } from '../../lib/allowance'

type Mode = 'expense' | 'income'

/** How many of the latest entries the side column lists. */
const RECENT = 12

/**
 * The Add tab on a laptop: every category on the left, the entry form always
 * open in the middle, what was just logged on the right. Made for the
 * keyboard: type a few letters of the category, Enter, the amount, Enter.
 */
export function DesktopAdd() {
  const month = currentMonthKey()
  const { person: devicePerson, setPerson: setDevicePerson } = useDeviceUser()
  const { data: allCategories = [], isLoading, error } = useMonthCategories(month)
  // shared categories and this device's own allowance, not the other one's
  const categories = allCategories.filter(
    (c) => !c.archived && (!c.owner || c.owner === devicePerson),
  )
  // goals included: what was just logged may have been spent from one
  const { data: everyCategory = [] } = useCategories()
  const { data: expenses = [] } = useMonthlyExpenses(month)
  // recent entries include spending from goals: it was just logged here too
  const { data: allExpenses = [] } = useExpenses(month)
  const { from, to } = monthRange(month)
  const { data: incomes = [] } = useIncomesBetween(from, to)
  const { data: lastIncomes = [] } = useLastIncomes()
  const addExpense = useAddExpense()
  const addIncome = useAddIncome()
  const actions = useEntryActions()
  const { alerts } = useBudgetAlerts()
  const prefs = usePrefs()
  const goals = useGoalTrips()

  const [mode, setMode] = useState<Mode>('expense')
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [person, setPerson] = useState<Person>(devicePerson ?? 'bubs')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayKey())
  const [toast, setToast] = useState<string | null>(null)
  const entry = useAmountEntry()
  const searchRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  // "/" jumps to the category filter from anywhere that isn't a text field
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key !== '/' || el.closest('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      setMode('expense')
      searchRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // goals show their whole target on the tile, and all that's been spent from them;
  // one without its category yet gets a stand-in until it's picked
  const goalTiles: Category[] = goals.open.map(({ goal, trip }) => ({
    ...(trip?.project ?? standIn(goal)),
    monthly_limit: trip?.budget ?? goal.target_amount,
  }))
  const spentByCategory = {
    ...sumByCategory(expenses),
    ...Object.fromEntries(goals.open.flatMap((g) => (g.trip ? [[g.trip.project.id, g.trip.spent]] : []))),
  }
  const monthTotal = sumExpenses(expenses)
  const monthLimit = categories.reduce((a, c) => a + c.monthly_limit, 0)
  const left = monthLimit - monthTotal
  const daysLeft = daysInMonth(month) - elapsedDays(month) + 1
  const q = query.trim().toLowerCase()
  const matches = (c: Category) => !q || c.name.toLowerCase().includes(q)
  const shown = categories.filter(matches)
  const shownGoals = goalTiles.filter(matches)
  const selected = [...categories, ...goalTiles].find((c) => c.id === selectedId) ?? null
  const isProjectPick = selected?.kind === 'project'
  // the other one's allowance isn't listed here, as in History
  const recent = toEntries(ownExpenses(allExpenses, everyCategory, devicePerson), incomes).slice(
    0,
    RECENT,
  )
  const lastIncome = lastIncomes.find((i) => i.person === person)
  const inThisMonth = monthKeyOfDate(date) === month

  const pick = (category: Category) => {
    setMode('expense')
    setSelectedId(category.id)
    setQuery('')
    // after the click has landed, so the tile doesn't keep the focus
    requestAnimationFrame(() => amountRef.current?.focus())
  }

  const pickGoal = async (goal: Goal) => {
    const category = await goals.ensureTrip(goal)
    setGoalsOpen(false)
    pick(category)
  }

  const pickTile = (category: Category) => {
    const goal = goals.open.find((g) => category.id === standIn(g.goal).id)?.goal
    if (!goal) return pick(category)
    pickGoal(goal).catch((err) => setToast(`Couldn’t open it: ${(err as Error).message}`))
  }

  const canSave =
    entry.amount > 0 &&
    (mode === 'income' || selected !== null) &&
    !addExpense.isPending &&
    !addIncome.isPending

  const save = () => {
    if (!canSave) return
    const trimmed = note.trim() || null
    const where = date === todayKey() ? '' : ` · ${formatDayLong(date)}`
    if (mode === 'expense' && selected) {
      addExpense.mutate(
        {
          amount: entry.amount,
          category_id: selected.id,
          person,
          note: trimmed,
          expense_date: date,
        },
        { onError: (err) => setToast(`Not saved: ${(err as Error).message}`) },
      )
      const crossed =
        inThisMonth || isProjectPick
          ? crossingNote(
              selected,
              limitImpact(
                spentByCategory[selected.id] ?? 0,
                entry.amount,
                selected.monthly_limit,
                prefs.nearRatio,
              ),
            )
          : null
      setToast(
        crossed
          ? `Saved. ${crossed}`
          : `Saved ${formatMoney(entry.amount)} to ${selected.name}${where}`,
      )
    } else {
      addIncome.mutate(
        { amount: entry.amount, person, note: trimmed, income_date: date, for_month: null },
        { onError: (err) => setToast(`Not saved: ${(err as Error).message}`) },
      )
      setToast(`Income saved · ${formatMoney(entry.amount)}${where}`)
    }
    // the category stays picked: several receipts from one shop go in a row
    entry.reset()
    setNote('')
    amountRef.current?.focus()
  }

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const first = shown[0] ?? shownGoals[0]
    if (e.key === 'Enter' && first) {
      e.preventDefault()
      pickTile(first)
    } else if (e.key === 'Escape') {
      setQuery('')
    }
  }

  const onFieldKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (entry.text) entry.reset()
      else searchRef.current?.focus()
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    entry.reset()
    setNote('')
    requestAnimationFrame(() =>
      next === 'expense' && !selected ? searchRef.current?.focus() : amountRef.current?.focus(),
    )
  }

  return (
    <div className="mx-auto flex h-[100dvh] max-w-7xl flex-col px-8 pb-6 pt-8">
      <header className="mb-6 flex shrink-0 items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-white">Add</h1>
          <p className="mt-1 text-sm text-muted">
            This month: <span className="font-semibold text-white">{formatMoney(monthTotal)}</span>
            {monthLimit > 0 && (
              <span className={left < 0 ? 'text-red-300' : ''}>
                {' '}
                ·{' '}
                {left < 0
                  ? `${formatMoneyCompact(-left)} over`
                  : `${formatMoneyCompact(left)} left`}
              </span>
            )}
          </p>
        </div>
        {devicePerson && (
          <UserSwitcher
            value={devicePerson}
            onChange={(p) => {
              setDevicePerson(p)
              setPerson(p)
            }}
          />
        )}
      </header>

      {error && (
        <p className="mb-4 shrink-0 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">
          Could not load categories: {(error as Error).message}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_24rem] gap-6 wide:grid-cols-[minmax(0,1fr)_24rem_21rem]">
        {/* ---------- categories ---------- */}
        <section aria-label="Categories" className="flex min-h-0 flex-col">
          {alerts.length > 0 && (
            <div className="mb-3 shrink-0">
              <AlertStrip alerts={alerts} />
            </div>
          )}
          {isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : (
            <CategoryGrid
              categories={shown}
              goals={shownGoals}
              goalsTile={
                goals.open.length > 0
                  ? (height) => (
                      <GoalsTile
                        goals={goals.open}
                        height={height}
                        onClick={() => setGoalsOpen(true)}
                      />
                    )
                  : undefined
              }
              spentByCategory={spentByCategory}
              selectedId={mode === 'expense' ? selectedId : null}
              onSelect={pickTile}
              query={query}
              onQueryChange={setQuery}
              searchRef={searchRef}
              onSearchKeyDown={onSearchKey}
            />
          )}
        </section>

        {/* ---------- the entry ---------- */}
        <section
          aria-label="New entry"
          className="flex min-h-0 flex-col overflow-y-auto rounded-3xl p-5 ring-1 ring-white/10"
          style={{ backgroundColor: CHART.surface }}
        >
          <div className="mb-4 grid shrink-0 grid-cols-2 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
            {(['expense', 'income'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                aria-pressed={mode === m}
                className={`rounded-full py-2 text-sm font-semibold transition ${
                  mode === m ? 'bg-slate-50 text-ink' : 'text-muted hover:text-white'
                }`}
              >
                {m === 'expense' ? 'Expense' : 'Income'}
              </button>
            ))}
          </div>

          <div className="mb-3 flex min-h-9 items-center gap-2">
            {mode === 'expense' ? (
              selected ? (
                <span
                  className="min-w-0 truncate rounded-full px-3 py-1.5 text-sm font-semibold"
                  style={{
                    backgroundColor: selected.color,
                    color: readableTextColor(selected.color),
                  }}
                >
                  {selected.name}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm text-muted">
                  <Receipt aria-hidden /> Pick a category first
                </span>
              )
            ) : (
              <span className="rounded-full bg-positive px-3 py-1.5 text-sm font-semibold text-ink">
                Income
              </span>
            )}
            <span className="ml-auto flex shrink-0 gap-2">
              <PersonToggle value={person} onChange={setPerson} />
              <DateChip value={date} onChange={setDate} />
            </span>
          </div>

          <AmountField
            ref={amountRef}
            value={entry.text}
            onChange={entry.type}
            onKeyDown={onFieldKey}
            label={mode === 'expense' ? 'Amount' : 'Amount received'}
            compact
          />

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={onFieldKey}
            placeholder={mode === 'expense' ? 'Title (optional)' : 'Note (e.g. salary, bonus)'}
            aria-label={mode === 'expense' ? 'Title' : 'Note'}
            maxLength={120}
            className="mt-3 w-full rounded-xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10 placeholder:text-muted focus:ring-white/30"
          />

          {mode === 'expense' && (
            <div className="mt-3 grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-2">
              {prefs.quickAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    // they add up: 10 twice is 20
                    entry.add(amount)
                    amountRef.current?.focus()
                  }}
                  aria-label={`Add ${amount} ${CURRENCY_SUFFIX}`}
                  className="h-11 rounded-xl bg-white/5 text-sm font-semibold tabular-nums text-slate-100 ring-1 ring-white/10 transition hover:bg-white/10 active:scale-[0.97] active:bg-white/15"
                >
                  +{amount} {CURRENCY_SUFFIX}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  entry.reset()
                  amountRef.current?.focus()
                }}
                disabled={entry.amount <= 0}
                className="h-11 rounded-xl px-3 text-sm font-semibold text-slate-300 ring-1 ring-white/10 hover:bg-white/5 disabled:opacity-30"
              >
                Clear
              </button>
            </div>
          )}
          {mode === 'income' && lastIncome && (
            <button
              type="button"
              onClick={() => {
                entry.setExact(lastIncome.amount)
                if (lastIncome.note && !note) setNote(lastIncome.note)
                amountRef.current?.focus()
              }}
              className="mt-3 w-full rounded-xl bg-white/5 px-3 py-2.5 text-left text-sm ring-1 ring-white/10 hover:bg-white/10"
            >
              <span className="text-muted">Same as last time: </span>
              <span className="font-semibold text-white">
                {formatAmount(lastIncome.amount)} {CURRENCY_SUFFIX}
              </span>
              {lastIncome.note && <span className="text-muted"> · {lastIncome.note}</span>}
            </button>
          )}

          {mode === 'expense' && selected && (inThisMonth || isProjectPick) && (
            <div className="mt-3">
              <LimitPreview
                category={
                  isProjectPick ? { ...selected, budget_total: selected.monthly_limit } : selected
                }
                spent={spentByCategory[selected.id] ?? 0}
                amount={entry.amount}
                project={isProjectPick}
              />
            </div>
          )}

          <div className="mt-auto pt-4">
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="h-12 w-full rounded-2xl bg-slate-100 text-base font-bold text-ink transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-40"
            >
              {mode === 'expense' ? 'Save expense' : 'Save income'}
            </button>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted">
              <kbd className="rounded px-1 ring-1 ring-white/15">Enter</kbd> saves ·{' '}
              <kbd className="rounded px-1 ring-1 ring-white/15">Esc</kbd> clears
            </p>
          </div>
        </section>

        {/* ---------- what just happened ---------- */}
        <aside aria-label="Recent" className="hidden min-h-0 flex-col gap-4 wide:flex">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <h2 className="mb-2 px-1 text-base font-semibold text-white">Recent</h2>
            <RecentEntries
              entries={recent}
              categories={categoryById(everyCategory)}
              onOpen={actions.edit}
            />
          </div>
          <MonthCard
            categories={allCategories}
            expenses={expenses}
            left={left}
            daysLeft={daysLeft}
            hasLimit={monthLimit > 0}
          />
        </aside>
      </div>

      <EntryDialogs actions={actions} categories={everyCategory} />
      {goalsOpen && (
        <GoalPicker
          goals={goals.open}
          onClose={() => setGoalsOpen(false)}
          onPick={({ goal }) => pickGoal(goal)}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-30 flex justify-center pl-60">
          <div
            role="status"
            className="rounded-full bg-slate-50 px-5 py-2.5 text-sm font-semibold text-ink shadow-lg"
          >
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}

/** A goal whose category isn't there yet (before migration 0009), as a tile. */
function standIn(goal: Goal): Category {
  return {
    id: `goal:${goal.id}`,
    name: goal.name,
    color: goal.color,
    monthly_limit: goal.target_amount,
    sort_order: goal.sort_order,
    archived: false,
    show_in_chart: true,
    kind: 'project',
    budget_total: goal.target_amount || null,
    starts_on: null,
    ends_on: null,
    goal_id: goal.id,
    owner: null,
  }
}

function MonthCard({
  categories,
  expenses,
  left,
  daysLeft,
  hasLimit,
}: {
  categories: Category[]
  expenses: Parameters<typeof categorySlices>[0]
  left: number
  daysLeft: number
  hasLimit: boolean
}) {
  const slices = categorySlices(expenses, categories)
  return (
    <section
      className="shrink-0 rounded-3xl p-4 ring-1 ring-white/10"
      style={{ backgroundColor: CHART.surface }}
    >
      <h2 className="text-base font-semibold text-white">Where it goes</h2>
      {hasLimit && left > 0 && daysLeft > 0 && (
        <p className="mt-0.5 text-sm text-slate-300">
          About {formatMoneyWhole(Math.floor(left / daysLeft))} a day for the {daysLeft} days left.
        </p>
      )}
      {slices.length > 0 ? (
        <div className="mt-3">
          <SpendDonut slices={slices} />
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">Nothing spent yet this month.</p>
      )}
    </section>
  )
}
