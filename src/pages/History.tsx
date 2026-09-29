import { CalendarDots, FunnelSimple, MagnifyingGlass, X } from '@phosphor-icons/react'
import { useMemo, useState, type ReactNode } from 'react'
import { CalendarHeatmap } from '../components/CalendarHeatmap'
import { BottomSheet } from '../components/history/BottomSheet'
import { EntryDialogs } from '../components/history/EntryDialogs'
import { EntryRow } from '../components/history/EntryRow'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Screen } from '../components/Screen'
import { Segments } from '../components/savings/fields'
import { PERSON_LABELS } from '../config'
import { useCategories } from '../hooks/useCategories'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { useEntryActions } from '../hooks/useEntryActions'
import { SEARCH_LIMIT, useExpenses, useSearchExpenses } from '../hooks/useExpenses'
import { useIncomesBetween, useSearchIncomes } from '../hooks/useIncomes'
import { LAPTOP, useMediaQuery } from '../hooks/useMediaQuery'
import {
  categoryById,
  currentMonthKey,
  formatMoney,
  formatMoneyWhole,
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
import { ownCategories, ownExpenses } from '../lib/allowance'
import { PERSONS, type Category, type Person } from '../types'

type Kind = 'all' | 'expense' | 'income'
type Sort = 'date' | 'amount'

interface Filters {
  kind: Kind
  person: Person | null
  categoryId: string | null
  sort: Sort
}

const NO_FILTERS: Filters = { kind: 'all', person: null, categoryId: null, sort: 'date' }

/** Categories listed in the breakdown before the rest fold into "and N more". */
const BREAKDOWN_ROWS = 8

/**
 * Every transaction of the month as one feed, grouped by day like a bank
 * statement: search across all months, filter and sort, tap a row to edit it,
 * delete with an undo. On a laptop the calendar, the filters and where the
 * money went sit beside the list; on the phone they fold into a sheet.
 */
export function History() {
  const laptop = useMediaQuery(LAPTOP)
  const { person: devicePerson } = useDeviceUser()
  const [month, setMonth] = useState(currentMonthKey())
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [day, setDay] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const changeMonth = (next: string) => {
    setMonth(next)
    setDay(null)
  }
  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }))

  const { from, to } = monthRange(month)
  const { data: categories = [] } = useCategories()
  const categoryMap = useMemo(() => categoryById(categories), [categories])

  const searching = sanitizeSearch(query).length >= 2 || parseAmountQuery(query) !== null
  const matchingCategoryIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q.length >= 2
      ? ownCategories(categories, devicePerson)
          .filter((c) => c.name.toLowerCase().includes(q))
          .map((c) => c.id)
      : []
  }, [categories, query, devicePerson])

  const monthExpenses = useExpenses(month)
  // History lists pay by the day it arrived
  const monthIncomes = useIncomesBetween(from, to, true)
  const foundExpenses = useSearchExpenses(query, matchingCategoryIds)
  const foundIncomes = useSearchIncomes(query)

  // the other one's allowance is theirs: not listed, not searchable, not editable
  const expenses = ownExpenses(
    (searching ? foundExpenses.data : monthExpenses.data) ?? [],
    categories,
    devicePerson,
  )
  const incomes = (searching ? foundIncomes.data : monthIncomes.data) ?? []
  const loading = searching
    ? foundExpenses.isLoading || foundIncomes.isLoading
    : monthExpenses.isLoading || monthIncomes.isLoading

  const actions = useEntryActions()

  // a category only exists on expenses, so picking one narrows to those
  const kind: Kind = filters.categoryId ? 'expense' : filters.kind
  const matching = toEntries(expenses, incomes).filter(
    (e) =>
      (kind === 'all' || e.kind === kind) &&
      (!filters.person || e.item.person === filters.person) &&
      (!filters.categoryId || (e.kind === 'expense' && e.item.category_id === filters.categoryId)),
  )
  // the calendar picks a day out of whatever the filters leave
  const calendarOn = !searching && (laptop || showCalendar)
  const entries = calendarOn && day ? matching.filter((e) => e.date === day) : matching
  const spentByDay: Record<string, number> = {}
  for (const e of matching) {
    if (e.kind === 'expense')
      spentByDay[e.date] = roundMoney((spentByDay[e.date] ?? 0) + e.item.amount)
  }
  const sum = totals(entries)
  const net = roundMoney(sum.earned - sum.spent)
  const byAmount = filters.sort === 'amount'
  const sorted = byAmount ? [...entries].sort((a, b) => b.item.amount - a.item.amount) : entries

  const activeCount =
    (filters.kind !== 'all' ? 1 : 0) +
    (filters.person ? 1 : 0) +
    (filters.categoryId ? 1 : 0) +
    (filters.sort !== 'date' ? 1 : 0)
  const anyFilter = activeCount > 0 || (calendarOn && day !== null)
  const clearAll = () => {
    setFilters(NO_FILTERS)
    setDay(null)
  }
  const pickCategory = (id: string) => patch({ categoryId: filters.categoryId === id ? null : id })

  const where = searching
    ? 'across all months'
    : calendarOn && day
      ? `on ${dayHeading(day).subtitle ?? dayHeading(day).title}`
      : `in ${formatMonthName(month)}`

  const controls = (
    <FilterControls
      filters={filters}
      kind={kind}
      categories={ownCategories(categories, devicePerson)}
      onChange={patch}
    />
  )

  return (
    <Screen
      title="History"
      wide
      action={searching ? null : <MonthSwitcher month={month} onChange={changeMonth} />}
    >
      {/* the status bar is translucent in the installed app; this strip keeps
          the list from showing through it above the sticky day headers */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-20 h-[env(safe-area-inset-top)] bg-ink" />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
        <div className="min-w-0">
          {/* ---------- search, filters, calendar ---------- */}
          <div data-tour="history-tools" className="mb-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, category or amount"
                aria-label="Search all transactions"
                enterKeyHint="search"
                className="w-full rounded-xl bg-white/5 py-2.5 pl-9 pr-10 text-white outline-none ring-1 ring-white/10 placeholder:text-muted focus:ring-white/40 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-muted hover:bg-white/10"
                >
                  <X />
                </button>
              )}
            </div>
            <IconButton
              label="Filters and sorting"
              active={activeCount > 0}
              onClick={() => setFiltersOpen(true)}
              badge={activeCount}
            >
              <FunnelSimple />
            </IconButton>
            {!searching && (
              <IconButton
                label="Calendar view"
                active={showCalendar}
                onClick={() => {
                  setShowCalendar((v) => !v)
                  setDay(null)
                }}
              >
                <CalendarDots />
              </IconButton>
            )}
          </div>

          {/* ---------- what's applied, removable one by one ---------- */}
          {anyFilter && (
            <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
              {filters.kind !== 'all' && !filters.categoryId && (
                <Applied onRemove={() => patch({ kind: 'all' })}>
                  {filters.kind === 'expense' ? 'Spent' : 'Income'}
                </Applied>
              )}
              {filters.person && (
                <Applied onRemove={() => patch({ person: null })}>
                  {PERSON_LABELS[filters.person]}
                </Applied>
              )}
              {filters.categoryId && (
                <Applied
                  onRemove={() => patch({ categoryId: null })}
                  color={categoryMap[filters.categoryId]?.color}
                >
                  {categoryMap[filters.categoryId]?.name ?? 'Category'}
                </Applied>
              )}
              {calendarOn && day && (
                <Applied onRemove={() => setDay(null)}>
                  {dayHeading(day).subtitle ?? dayHeading(day).title}
                </Applied>
              )}
              {byAmount && (
                <Applied onRemove={() => patch({ sort: 'date' })}>Biggest first</Applied>
              )}
              <button
                type="button"
                onClick={clearAll}
                className="shrink-0 px-2 text-sm font-semibold text-muted hover:text-white"
              >
                Clear all
              </button>
            </div>
          )}

          {/* ---------- the phone's calendar, on request ---------- */}
          {calendarOn && !laptop && (
            <div className="mb-3 rounded-3xl bg-white/[0.04] p-3 ring-1 ring-white/5">
              <CalendarHeatmap
                month={month}
                totalsByDay={spentByDay}
                monthTotal={totals(matching).spent}
                selectedDay={day}
                onSelectDay={setDay}
              />
            </div>
          )}

          {/* ---------- totals, in one line ---------- */}
          <p className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm tabular-nums">
            <span className="text-muted">
              Spent <span className="font-semibold text-white">{formatMoneyWhole(sum.spent)}</span>
            </span>
            <span className="text-muted">
              Income{' '}
              <span className="font-semibold text-positive">{formatMoneyWhole(sum.earned)}</span>
            </span>
            <span className="text-muted">
              Net{' '}
              <span className={`font-semibold ${net >= 0 ? 'text-positive' : 'text-red-300'}`}>
                {net >= 0 ? '+' : '−'}
                {formatMoneyWhole(Math.abs(net))}
              </span>
            </span>
            <span className="text-xs text-muted sm:ml-auto">
              {entries.length} {pluralize(entries.length, 'entry', 'entries')} {where}
              {searching && expenses.length >= SEARCH_LIMIT && `, newest ${SEARCH_LIMIT}`}
            </span>
          </p>

          {/* ---------- the feed ---------- */}
          {loading ? (
            <div className="space-y-2" aria-label="Loading">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted">
                {searching
                  ? `Nothing matches “${query.trim()}”`
                  : anyFilter
                    ? 'Nothing matches these filters'
                    : `Nothing logged in ${formatMonthName(month)} yet`}
              </p>
              {anyFilter && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="mt-3 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : byAmount ? (
            <EntryList entries={sorted} categories={categoryMap} onOpen={actions.edit} showDate />
          ) : (
            <div className="space-y-3">
              {groupByDay(sorted).map((group) => {
                const heading = dayHeading(group.date)
                return (
                  <section key={group.date} aria-label={heading.subtitle ?? heading.title}>
                    <header className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 flex items-baseline justify-between bg-ink/95 px-5 pb-1 pt-1.5 backdrop-blur lg:mx-0 lg:px-1">
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
                    <EntryList
                      entries={group.entries}
                      categories={categoryMap}
                      onOpen={actions.edit}
                    />
                  </section>
                )
              })}
            </div>
          )}
        </div>

        {/* ---------- laptop: calendar, filters and breakdown beside the list ---------- */}
        <aside className="no-scrollbar hidden space-y-4 lg:sticky lg:top-8 lg:block lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto">
          {!searching && (
            <Panel title="Calendar">
              <CalendarHeatmap
                month={month}
                totalsByDay={spentByDay}
                monthTotal={totals(matching).spent}
                selectedDay={day}
                onSelectDay={setDay}
              />
            </Panel>
          )}
          <Panel title="Filter and sort">
            <div className="space-y-4">{controls}</div>
          </Panel>
          <Panel title="Where it went">
            <Breakdown
              entries={matching}
              categories={categoryMap}
              selected={filters.categoryId}
              onPick={pickCategory}
            />
          </Panel>
        </aside>
      </div>

      {filtersOpen && (
        <BottomSheet title="Filters and sorting" onClose={() => setFiltersOpen(false)}>
          <div className="space-y-5 pb-2">
            {controls}
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="h-12 w-full rounded-2xl bg-slate-100 text-base font-bold text-ink hover:bg-slate-50"
            >
              Show {entries.length} {pluralize(entries.length, 'entry', 'entries')}
            </button>
          </div>
        </BottomSheet>
      )}

      <EntryDialogs actions={actions} categories={categories} />
    </Screen>
  )
}

/* ---------- parts ---------- */

function EntryList({
  entries,
  categories,
  onOpen,
  showDate,
}: {
  entries: Entry[]
  categories: Record<string, Category>
  onOpen: (e: Entry) => void
  showDate?: boolean
}) {
  return (
    <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/5">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`}>
          <EntryRow
            entry={entry}
            categories={categories}
            dense
            showDate={showDate}
            onOpen={entry.id.startsWith('optimistic-') ? undefined : () => onOpen(entry)}
          />
        </li>
      ))}
    </ul>
  )
}

function FilterControls({
  filters,
  kind,
  categories,
  onChange,
}: {
  filters: Filters
  kind: Kind
  categories: Category[]
  onChange: (p: Partial<Filters>) => void
}) {
  const shown = categories.filter((c) => !c.archived || c.id === filters.categoryId)
  return (
    <>
      <Group label="Show">
        <Segments
          value={kind}
          onChange={(v) => onChange({ kind: v, ...(v === 'income' ? { categoryId: null } : {}) })}
          options={[
            { value: 'all', label: 'All' },
            { value: 'expense', label: 'Spent' },
            { value: 'income', label: 'Income' },
          ]}
        />
      </Group>
      <Group label="Who">
        <Segments
          value={filters.person ?? 'both'}
          onChange={(v) => onChange({ person: v === 'both' ? null : (v as Person) })}
          options={[
            { value: 'both', label: 'Both' },
            ...PERSONS.map((p) => ({ value: p, label: PERSON_LABELS[p] })),
          ]}
        />
      </Group>
      <Group label="Order">
        <Segments
          value={filters.sort}
          onChange={(v) => onChange({ sort: v })}
          options={[
            { value: 'date', label: 'Newest first' },
            { value: 'amount', label: 'Biggest first' },
          ]}
        />
      </Group>
      {kind !== 'income' && (
        <Group label="Category">
          <div className="flex flex-wrap gap-1.5">
            {shown.map((c) => {
              const active = filters.categoryId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange({ categoryId: active ? null : c.id })}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
                    active
                      ? 'text-white ring-white/60'
                      : 'text-slate-300 ring-white/10 hover:bg-white/5'
                  }`}
                  style={active ? { backgroundColor: withAlpha(c.color, 0.3) } : undefined}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.name}
                </button>
              )
            })}
          </div>
        </Group>
      )}
    </>
  )
}

/** What the filtered expenses went on, biggest first; a row filters to its category. */
function Breakdown({
  entries,
  categories,
  selected,
  onPick,
}: {
  entries: Entry[]
  categories: Record<string, Category>
  selected: string | null
  onPick: (id: string) => void
}) {
  const by = new Map<string, number>()
  for (const e of entries) {
    if (e.kind === 'expense')
      by.set(e.item.category_id, (by.get(e.item.category_id) ?? 0) + e.item.amount)
  }
  const rows = [...by.entries()].sort((a, b) => b[1] - a[1])
  if (rows.length === 0) return <p className="text-sm text-muted">No spending in this view.</p>
  const max = rows[0][1]
  const shown = rows.slice(0, BREAKDOWN_ROWS)
  return (
    <>
      <ul className="grid gap-0.5">
        {shown.map(([id, amount]) => {
          const c = categories[id]
          const active = selected === id
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onPick(id)}
                aria-pressed={active}
                className={`w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5 ${active ? 'bg-white/10' : ''}`}
              >
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-slate-200">{c?.name ?? 'Other'}</span>
                  <span className="shrink-0 tabular-nums text-white">
                    {formatMoneyWhole(amount)}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="mt-1 block h-1.5 rounded-full"
                  style={{
                    width: `${Math.max((amount / max) * 100, 2)}%`,
                    backgroundColor: c?.color ?? '#64748b',
                  }}
                />
              </button>
            </li>
          )
        })}
      </ul>
      {rows.length > shown.length && (
        <p className="mt-1 px-2 text-xs text-muted">and {rows.length - shown.length} more</p>
      )}
    </>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <h2 className="mb-3 text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-muted">{label}</p>
      {children}
    </div>
  )
}

function Applied({
  onRemove,
  color,
  children,
}: {
  onRemove: () => void
  color?: string
  children: ReactNode
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm font-medium text-white ring-1 ring-white/30"
      style={{ backgroundColor: color ? withAlpha(color, 0.25) : 'rgba(255,255,255,0.1)' }}
    >
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${typeof children === 'string' ? children : ''}`}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-white"
      >
        <X aria-hidden />
      </button>
    </span>
  )
}

function IconButton({
  label,
  active,
  onClick,
  badge,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  badge?: number
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`relative flex w-11 shrink-0 items-center justify-center rounded-xl text-lg ring-1 transition lg:hidden ${
        active
          ? 'bg-slate-50 text-ink ring-white'
          : 'bg-white/5 text-muted ring-white/10 hover:bg-white/10'
      }`}
    >
      {children}
      {badge ? (
        <span className="absolute -right-1.5 -top-1.5 min-w-[1.125rem] rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-[1.125rem] text-ink">
          {badge}
        </span>
      ) : null}
    </button>
  )
}
