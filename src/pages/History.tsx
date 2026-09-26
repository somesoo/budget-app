import { CalendarDots, MagnifyingGlass, X } from '@phosphor-icons/react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { CalendarHeatmap } from '../components/CalendarHeatmap'
import { EntryEditor } from '../components/history/EntryEditor'
import { EntryRow } from '../components/history/EntryRow'
import { UndoToast } from '../components/history/UndoToast'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Screen } from '../components/Screen'
import { useCategories } from '../hooks/useCategories'
import {
  SEARCH_LIMIT,
  useDeleteExpense,
  useExpenses,
  useRestoreExpense,
  useSearchExpenses,
  useUpdateExpense,
} from '../hooks/useExpenses'
import {
  useDeleteIncome,
  useIncomesBetween,
  useRestoreIncome,
  useSearchIncomes,
  useUpdateIncome,
} from '../hooks/useIncomes'
import { PERSON_LABELS } from '../config'
import {
  categoryById,
  currentMonthKey,
  formatMoney,
  formatMoneyCompact,
  formatMonthName,
  monthRange,
  pluralize,
  roundMoney,
  withAlpha,
} from '../lib/calculations'
import {
  dayHeading,
  groupByDay,
  parseAmountQuery,
  sanitizeSearch,
  toEntries,
  totals,
  type Entry,
} from '../lib/history'
import { PERSONS, type Person } from '../types'

type Kind = 'all' | 'expense' | 'income'

/**
 * Every transaction of the month as one feed, grouped by day like a bank
 * statement: search across all months, narrow with chips, tap a row to edit it
 * in a sheet, delete with an undo.
 */
export function History() {
  const [month, setMonth] = useState(currentMonthKey())
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind>('all')
  const [person, setPerson] = useState<Person | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [deleted, setDeleted] = useState<Entry | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [day, setDay] = useState<string | null>(null)

  const changeMonth = (next: string) => {
    setMonth(next)
    setDay(null)
  }

  const { from, to } = monthRange(month)
  const { data: categories = [] } = useCategories()
  const categoryMap = useMemo(() => categoryById(categories), [categories])

  const searching = sanitizeSearch(query).length >= 2 || parseAmountQuery(query) !== null
  const matchingCategoryIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q.length >= 2
      ? categories.filter((c) => c.name.toLowerCase().includes(q)).map((c) => c.id)
      : []
  }, [categories, query])

  const monthExpenses = useExpenses(month)
  const monthIncomes = useIncomesBetween(from, to)
  const foundExpenses = useSearchExpenses(query, matchingCategoryIds)
  const foundIncomes = useSearchIncomes(query)

  const expenses = (searching ? foundExpenses.data : monthExpenses.data) ?? []
  const incomes = (searching ? foundIncomes.data : monthIncomes.data) ?? []
  const loading = searching
    ? foundExpenses.isLoading || foundIncomes.isLoading
    : monthExpenses.isLoading || monthIncomes.isLoading

  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const restoreExpense = useRestoreExpense()
  const updateIncome = useUpdateIncome()
  const deleteIncome = useDeleteIncome()
  const restoreIncome = useRestoreIncome()

  // a category only exists on expenses, so picking one narrows to those
  const effectiveKind: Kind = categoryId ? 'expense' : kind
  const matching = toEntries(expenses, incomes).filter(
    (e) =>
      (effectiveKind === 'all' || e.kind === effectiveKind) &&
      (!person || e.item.person === person) &&
      (!categoryId || (e.kind === 'expense' && e.item.category_id === categoryId)),
  )
  // the calendar picks a day out of whatever the filters leave
  const calendarOn = showCalendar && !searching
  const entries = calendarOn && day ? matching.filter((e) => e.date === day) : matching
  const spentByDay: Record<string, number> = {}
  for (const e of matching) {
    if (e.kind === 'expense')
      spentByDay[e.date] = roundMoney((spentByDay[e.date] ?? 0) + e.item.amount)
  }
  const groups = groupByDay(entries)
  const sum = totals(entries)
  const net = roundMoney(sum.earned - sum.spent)
  const filtered = kind !== 'all' || person !== null || categoryId !== null

  const clearFilters = () => {
    setKind('all')
    setPerson(null)
    setCategoryId(null)
  }

  const remove = (entry: Entry) => {
    if (entry.kind === 'expense') deleteExpense.mutate(entry.id)
    else deleteIncome.mutate(entry.id)
    setDeleted(entry)
  }

  const undo = () => {
    if (!deleted) return
    if (deleted.kind === 'expense') restoreExpense.mutate(deleted.item)
    else restoreIncome.mutate(deleted.item)
    setDeleted(null)
  }

  const dismissUndo = useCallback(() => setDeleted(null), [])

  return (
    <Screen
      title="History"
      action={searching ? null : <MonthSwitcher month={month} onChange={changeMonth} />}
    >
      {/* the status bar is translucent in the installed app; this strip keeps
          the list from showing through it above the sticky day headers */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-20 h-[env(safe-area-inset-top)] bg-ink" />

      {/* ---------- search, and the calendar view beside it ---------- */}
      <div className="mb-3 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          >
            <MagnifyingGlass />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, category or amount"
            aria-label="Search all transactions"
            enterKeyHint="search"
            className="w-full rounded-xl bg-white/5 py-2.5 pl-9 pr-10 text-white outline-none ring-1 ring-white/10 placeholder:text-muted/70 focus:ring-white/40 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-muted active:bg-white/10"
            >
              <X />
            </button>
          )}
        </div>
        {!searching && (
          <button
            type="button"
            onClick={() => {
              setShowCalendar((v) => !v)
              setDay(null)
            }}
            aria-pressed={showCalendar}
            aria-label="Calendar view"
            title="Calendar view"
            className={`flex w-11 shrink-0 items-center justify-center rounded-xl text-lg ring-1 transition ${
              showCalendar
                ? 'bg-slate-50 text-ink ring-white'
                : 'bg-white/5 text-muted ring-white/10 active:bg-white/10'
            }`}
          >
            <CalendarDots />
          </button>
        )}
      </div>

      {/* ---------- filters ---------- */}
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 lg:-mx-8 lg:px-8">
        <div className="inline-flex shrink-0 rounded-full bg-white/5 p-0.5 ring-1 ring-white/10">
          {(
            [
              ['all', 'All'],
              ['expense', 'Spent'],
              ['income', 'Income'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setKind(value)
                if (value === 'income') setCategoryId(null)
              }}
              aria-pressed={effectiveKind === value}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                effectiveKind === value ? 'bg-slate-50 text-ink' : 'text-muted active:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {PERSONS.map((p) => (
          <Chip key={p} active={person === p} onClick={() => setPerson(person === p ? null : p)}>
            {PERSON_LABELS[p]}
          </Chip>
        ))}
      </div>

      {effectiveKind !== 'income' && categories.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          {categories
            .filter((c) => !c.archived || c.id === categoryId)
            .map((c) => (
              <Chip
                key={c.id}
                active={categoryId === c.id}
                color={c.color}
                onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
              >
                {c.name}
              </Chip>
            ))}
        </div>
      )}

      {calendarOn && (
        <div className="mb-4 rounded-3xl bg-white/[0.04] p-3 ring-1 ring-white/5">
          <CalendarHeatmap
            month={month}
            totalsByDay={spentByDay}
            monthTotal={totals(matching).spent}
            selectedDay={day}
            onSelectDay={setDay}
          />
          <p className="mt-2 text-center text-xs text-muted">
            {day
              ? 'Tap the day again to see the whole month'
              : 'Darker = more spent than an average day · tap a day'}
          </p>
        </div>
      )}

      {/* ---------- totals ---------- */}
      <div className="mb-2 grid grid-cols-3 gap-2">
        {/* compact amounts: a third of a phone can't fit "+12,345.00 zł" */}
        <Stat label="Spent" value={formatMoneyCompact(sum.spent)} />
        <Stat label="Income" value={formatMoneyCompact(sum.earned)} tone="positive" />
        <Stat
          label="Net"
          value={`${net >= 0 ? '+' : '−'}${formatMoneyCompact(Math.abs(net))}`}
          tone={net >= 0 ? 'positive' : 'negative'}
        />
      </div>
      <p className="mb-4 flex items-center justify-between text-xs text-muted">
        <span>
          {entries.length} {pluralize(entries.length, 'transaction', 'transactions')}
          {searching
            ? ' across all months'
            : calendarOn && day
              ? ` on ${dayHeading(day).subtitle ?? dayHeading(day).title}`
              : ` in ${formatMonthName(month)}`}
          {searching && expenses.length >= SEARCH_LIMIT && ` · showing the newest ${SEARCH_LIMIT}`}
        </span>
        {filtered && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-white active:opacity-60"
          >
            Clear filters
          </button>
        )}
      </p>

      {/* ---------- feed ---------- */}
      {loading ? (
        <div className="space-y-2" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted">
            {searching
              ? `Nothing matches “${query.trim()}”`
              : filtered
                ? 'Nothing matches these filters'
                : `Nothing logged in ${formatMonthName(month)} yet`}
          </p>
          {filtered && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white active:bg-white/20"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const heading = dayHeading(group.date)
            return (
              <section key={group.date} aria-label={heading.subtitle ?? heading.title}>
                <header className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 flex items-baseline justify-between bg-ink/95 px-5 pb-1.5 pt-2 backdrop-blur lg:-mx-8 lg:px-9">
                  <h2 className="text-sm font-semibold text-white">
                    {heading.title}
                    {heading.subtitle && (
                      <span className="ml-1.5 font-normal text-muted">{heading.subtitle}</span>
                    )}
                  </h2>
                  <span className="text-xs tabular-nums text-muted">
                    {group.spent > 0 && formatMoney(group.spent)}
                    {group.spent > 0 && group.earned > 0 && ' · '}
                    {group.earned > 0 && (
                      <span className="text-positive">+{formatMoney(group.earned)}</span>
                    )}
                  </span>
                </header>
                <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/5">
                  {group.entries.map((entry) => (
                    <li key={`${entry.kind}-${entry.id}`}>
                      <EntryRow
                        entry={entry}
                        categories={categoryMap}
                        onOpen={
                          entry.id.startsWith('optimistic-') ? undefined : () => setEditing(entry)
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {editing && (
        <EntryEditor
          entry={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaveExpense={(id, patch) => updateExpense.mutate({ id, ...patch })}
          onSaveIncome={(id, patch) => updateIncome.mutate({ id, ...patch })}
          onDelete={remove}
        />
      )}

      {deleted && (
        <UndoToast
          key={`${deleted.kind}-${deleted.id}`}
          message={`${deleted.kind === 'expense' ? 'Expense' : 'Income'} deleted · ${formatMoney(deleted.item.amount)}`}
          onUndo={undo}
          onDismiss={dismissUndo}
        />
      )}
    </Screen>
  )
}

function Chip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean
  color?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
        active
          ? 'text-white ring-white/60'
          : 'bg-white/5 text-slate-300 ring-white/10 active:bg-white/10'
      }`}
      style={
        active
          ? { backgroundColor: color ? withAlpha(color, 0.3) : 'rgba(255,255,255,0.18)' }
          : undefined
      }
    >
      {color && (
        <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {children}
    </button>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'positive' | 'negative'
}) {
  const color =
    tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-red-300' : 'text-white'
  return (
    <div className="min-w-0 rounded-2xl bg-white/5 px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`truncate text-sm font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
