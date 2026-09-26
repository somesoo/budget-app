import {
  AirplaneTilt,
  CaretRight,
  ChartDonut,
  DownloadSimple,
  Plus,
  SignOut,
  WifiHigh,
  WifiSlash,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MoneyInput } from '../components/budget/MoneyInput'
import { ProjectSheet } from '../components/projects/ProjectSheet'
import { Screen } from '../components/Screen'
import { Segments, Switch } from '../components/savings/fields'
import { CategorySheet } from '../components/settings/CategorySheet'
import { CardAction, SettingsCard } from '../components/settings/SettingsCard'
import { UserSwitcher } from '../components/UserSwitcher'
import { resetDismissedAlerts, useDismissedCount } from '../hooks/useBudgetAlerts'
import { useCategories } from '../hooks/useCategories'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { useMonthlyExpensesBetween } from '../hooks/useExpenses'
import { useGoal, useUpsertGoal } from '../hooks/useGoal'
import { DEFAULT_PREFS, setPrefs, usePrefs } from '../hooks/usePrefs'
import { useRealtimeStatus } from '../hooks/useRealtimeSync'
import { useSavingsOverview } from '../hooks/useSavings'
import { useSession } from '../hooks/useSession'
import {
  currentMonthKey,
  formatAmount,
  formatMoney,
  formatMoneyWhole,
  roundMoney,
  shiftMonth,
  sumByCategory,
} from '../lib/calculations'
import { downloadCsv } from '../lib/exportCsv'
import { monthsEndingAt, windowRange } from '../lib/insights'
import { supabase } from '../lib/supabaseClient'
import type { Category } from '../types'

/** Months averaged for the "typical" figure next to each limit. */
const TYPICAL_MONTHS = 3

type CategoryEdit = { category?: Category } | null

/**
 * Settings in compact cards. Shared settings (categories, trips) change both
 * phones; the ones marked "this device" stay on this one.
 */
export function Settings() {
  const { data: categories = [] } = useCategories()
  const savings = useSavingsOverview()
  const [editing, setEditing] = useState<CategoryEdit>(null)
  const [projectSheet, setProjectSheet] = useState<Category | 'new' | null>(null)

  // what each category has actually cost lately, next to its limit
  const months = monthsEndingAt(shiftMonth(currentMonthKey(), -1), TYPICAL_MONTHS)
  const { from, to } = windowRange(months)
  const { data: recent } = useMonthlyExpensesBetween(from, to)
  const typicalOf = (id: string) =>
    recent ? roundMoney((sumByCategory(recent)[id] ?? 0) / TYPICAL_MONTHS) : undefined

  const monthly = categories.filter((c) => c.kind !== 'project')
  const active = monthly.filter((c) => !c.archived)
  const projects = categories.filter((c) => c.kind === 'project')

  return (
    <Screen title="Settings" wide>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="space-y-4">
          <DeviceCard />
          <CategoriesCard
            categories={monthly}
            typicalOf={typicalOf}
            onEdit={(category) => setEditing({ category })}
            onNew={() => setEditing({})}
          />
          {savings.available && (
            <ProjectsSettings
              projects={projects}
              onEdit={setProjectSheet}
              onNew={() => setProjectSheet('new')}
            />
          )}
        </div>
        <div className="space-y-4">
          <AddScreenCard />
          <WarningsCard />
          <SavingsSettings
            available={savings.available}
            accounts={savings.accounts.length}
            goals={savings.goals.length}
          />
          <DataCard categories={categories} />
          <AccountCard />
        </div>
      </div>

      {editing && (
        <CategorySheet
          category={editing.category}
          typical={editing.category ? typicalOf(editing.category.id) : undefined}
          neighbours={
            editing.category
              ? {
                  up: active[active.findIndex((c) => c.id === editing.category!.id) - 1],
                  down: active[active.findIndex((c) => c.id === editing.category!.id) + 1],
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}
      {projectSheet && (
        <ProjectSheet
          project={projectSheet === 'new' ? undefined : projectSheet}
          onClose={() => setProjectSheet(null)}
        />
      )}
    </Screen>
  )
}

/* ---------- this device ---------- */

function DeviceCard() {
  const { person, setPerson } = useDeviceUser()
  const status = useRealtimeStatus()
  const live = status === 'live'
  return (
    <SettingsCard title="This device" help="Who uses it. Kept on the phone, not in the database.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {person && <UserSwitcher value={person} onChange={setPerson} />}
        <span
          className={`flex items-center gap-1.5 text-sm ${live ? 'text-positive' : 'text-amber-300'}`}
        >
          {live ? <WifiHigh aria-hidden /> : <WifiSlash aria-hidden />}
          {live ? 'Syncing live' : status === 'connecting' ? 'Connecting…' : 'Offline'}
        </span>
      </div>
    </SettingsCard>
  )
}

/* ---------- categories ---------- */

function CategoriesCard({
  categories,
  typicalOf,
  onEdit,
  onNew,
}: {
  categories: Category[]
  typicalOf: (id: string) => number | undefined
  onEdit: (c: Category) => void
  onNew: () => void
}) {
  const [showHidden, setShowHidden] = useState(false)
  const active = categories.filter((c) => !c.archived)
  const hidden = categories.filter((c) => c.archived)
  const totalLimit = active.reduce((a, c) => a + c.monthly_limit, 0)
  const totalTypical = active.reduce((a, c) => a + (typicalOf(c.id) ?? 0), 0)
  const hasTypical = active.some((c) => typicalOf(c.id) !== undefined)

  const row = (c: Category) => {
    const typical = typicalOf(c.id)
    const over = typical !== undefined && c.monthly_limit > 0 && typical > c.monthly_limit
    return (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => onEdit(c)}
          className={`group grid w-full grid-cols-[auto_minmax(0,1fr)_4.5rem_5rem_auto] items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/5 ${
            c.archived ? 'opacity-50' : ''
          }`}
        >
          <span aria-hidden className="h-3 w-3 rounded" style={{ backgroundColor: c.color }} />
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] text-white">{c.name}</span>
            {!c.show_in_chart && (
              <ChartDonut
                aria-label="Left out of the chart"
                className="shrink-0 text-sm text-muted"
              />
            )}
          </span>
          <span
            className={`text-right text-sm tabular-nums ${over ? 'text-amber-200' : 'text-muted'}`}
            title={over ? 'Usually costs more than its limit' : undefined}
          >
            {typical === undefined ? '' : formatAmount(Math.round(typical))}
          </span>
          <span className="text-right text-[15px] font-semibold tabular-nums text-white">
            {formatAmount(c.monthly_limit)}
          </span>
          <CaretRight aria-hidden className="text-muted transition group-hover:translate-x-0.5" />
        </button>
      </li>
    )
  }

  return (
    <SettingsCard
      title="Categories"
      help="Default limits: a month you plan in Budget uses its own."
      action={
        <CardAction onClick={onNew}>
          <Plus weight="bold" aria-hidden /> New
        </CardAction>
      }
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_4.5rem_5rem_auto] gap-3 px-2 pb-1 text-xs text-muted">
        <span className="w-3" />
        <span>Name</span>
        <span className="text-right">{hasTypical ? 'Usually' : ''}</span>
        <span className="text-right">Limit</span>
        <span className="w-4" />
      </div>
      <ul className="divide-y divide-white/5">{active.map(row)}</ul>
      <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)_4.5rem_5rem_auto] gap-3 border-t border-white/10 px-2 pt-2.5 text-sm">
        <span className="w-3" />
        <span className="text-muted">A month</span>
        <span className="text-right tabular-nums text-muted">
          {hasTypical ? formatAmount(Math.round(totalTypical)) : ''}
        </span>
        <span className="text-right font-semibold tabular-nums text-white">
          {formatAmount(totalLimit)}
        </span>
        <span className="w-4" />
      </div>
      <p className="mt-3 text-xs leading-snug text-muted">
        “Usually” is the average of the last {TYPICAL_MONTHS} complete months; amber when it runs
        over the limit. <ChartDonut aria-hidden className="inline align-[-0.15em]" /> marks
        categories left out of the Home chart.
      </p>
      {hidden.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            aria-expanded={showHidden}
            className="mt-3 text-sm font-medium text-muted hover:text-white"
          >
            {showHidden ? 'Hide' : 'Show'} {hidden.length} hidden
          </button>
          {showHidden && <ul className="mt-1 divide-y divide-white/5">{hidden.map(row)}</ul>}
        </>
      )}
    </SettingsCard>
  )
}

/* ---------- trips ---------- */

function ProjectsSettings({
  projects,
  onEdit,
  onNew,
}: {
  projects: Category[]
  onEdit: (p: Category) => void
  onNew: () => void
}) {
  return (
    <SettingsCard
      title="Trips and projects"
      help="Their own budget for the whole of it, outside the monthly limits."
      action={
        <CardAction onClick={onNew}>
          <Plus weight="bold" aria-hidden /> New
        </CardAction>
      }
    >
      {projects.length === 0 ? (
        <p className="text-sm text-muted">None yet. A trip is a good first one.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onEdit(p)}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/5 ${
                  p.archived ? 'opacity-50' : ''
                }`}
              >
                <AirplaneTilt weight="fill" aria-hidden style={{ color: p.color }} />
                <span className="min-w-0 flex-1 truncate text-[15px] text-white">{p.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted">
                  {p.archived
                    ? 'Finished'
                    : p.budget_total
                      ? formatMoneyWhole(p.budget_total)
                      : 'No budget'}
                </span>
                <CaretRight aria-hidden className="shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  )
}

/* ---------- this device: Add screen and warnings ---------- */

function AddScreenCard() {
  const prefs = usePrefs()
  const set = (i: number, v: number) => {
    const next = [...prefs.quickAmounts]
    next[i] = v
    if (next.every((n) => n > 0)) setPrefs({ quickAmounts: next })
  }
  const custom = prefs.quickAmounts.some((n, i) => n !== DEFAULT_PREFS.quickAmounts[i])
  return (
    <SettingsCard
      title="Quick amounts"
      help="The four one-tap amounts on Add; tapping them adds up. This device only."
      action={
        custom ? (
          <CardAction onClick={() => setPrefs({ quickAmounts: DEFAULT_PREFS.quickAmounts })}>
            Reset
          </CardAction>
        ) : undefined
      }
    >
      <div className="grid grid-cols-4 gap-2">
        {prefs.quickAmounts.map((n, i) => (
          <MoneyInput
            key={i}
            value={n}
            onChange={(v) => set(i, v)}
            label={`Quick amount ${i + 1}`}
          />
        ))}
      </div>
    </SettingsCard>
  )
}

function WarningsCard() {
  const prefs = usePrefs()
  const dismissed = useDismissedCount()
  return (
    <SettingsCard
      title="Warnings"
      help="When the app says a category needs watching. This device only."
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[15px] text-white">Warn when a category reaches</p>
          <Segments
            value={String(prefs.nearRatio)}
            onChange={(v) => setPrefs({ nearRatio: Number(v) })}
            options={[
              { value: '0.7', label: '70%' },
              { value: '0.8', label: '80%' },
              { value: '0.9', label: '90%' },
            ]}
          />
        </div>
        <Switch
          label="Warn about the pace"
          help="When spending so far would take a category over by the month's end."
          checked={prefs.paceWarnings}
          onChange={(v) => setPrefs({ paceWarnings: v })}
        />
        {dismissed > 0 && (
          <button
            type="button"
            onClick={resetDismissedAlerts}
            className="text-sm font-semibold text-accent-soft hover:underline"
          >
            Bring back {dismissed} dismissed {dismissed === 1 ? 'warning' : 'warnings'}
          </button>
        )}
      </div>
    </SettingsCard>
  )
}

/* ---------- savings ---------- */

function SavingsSettings({
  available,
  accounts,
  goals,
}: {
  available: boolean
  accounts: number
  goals: number
}) {
  const { data: goal, isLoading } = useGoal()
  const upsertGoal = useUpsertGoal()
  if (available) {
    return (
      <Link
        to="/savings"
        className="group flex items-center gap-3 rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10 hover:bg-white/[0.07] lg:p-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-white">Savings</span>
          <span className="block text-xs text-muted">
            {accounts} {accounts === 1 ? 'account' : 'accounts'}, {goals}{' '}
            {goals === 1 ? 'goal' : 'goals'}: managed in the Savings tab
          </span>
        </span>
        <CaretRight aria-hidden className="text-muted transition group-hover:translate-x-0.5" />
      </Link>
    )
  }
  return (
    <SettingsCard title="Savings goal" help="Run migration 0007 for accounts and several goals.">
      {/* keyed so the fields fill in once the goal has loaded, rather than
          keeping empty defaults that "Save goal" would write over it */}
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <GoalEditor
          key={goal?.id ?? 'new'}
          goal={goal ?? null}
          onSave={(next) => upsertGoal.mutate({ id: goal?.id, ...next })}
        />
      )}
    </SettingsCard>
  )
}

/* ---------- data and account ---------- */

function DataCard({ categories }: { categories: Category[] }) {
  const [state, setState] = useState<{ busy: boolean; message: string | null }>({
    busy: false,
    message: null,
  })
  const run = async () => {
    setState({ busy: true, message: null })
    try {
      const count = await downloadCsv(categories)
      setState({ busy: false, message: `Downloaded ${formatAmount(count)} entries.` })
    } catch (err) {
      setState({ busy: false, message: `Couldn’t export: ${(err as Error).message}` })
    }
  }
  return (
    <SettingsCard title="Your data" help="Every expense and income, as a spreadsheet (CSV).">
      <button
        type="button"
        onClick={run}
        disabled={state.busy}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5 disabled:opacity-50"
      >
        <DownloadSimple aria-hidden />
        {state.busy ? 'Preparing…' : 'Download CSV'}
      </button>
      {state.message && <p className="mt-2 text-xs text-muted">{state.message}</p>}
    </SettingsCard>
  )
}

function AccountCard() {
  const { session } = useSession()
  return (
    <SettingsCard
      title="Account"
      help={session?.user.email ? `Signed in as ${session.user.email}` : undefined}
    >
      <button
        type="button"
        onClick={() => void supabase.auth.signOut()}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
      >
        <SignOut aria-hidden /> Sign out of this device
      </button>
    </SettingsCard>
  )
}

/* ---------- before migration 0007: the single goal ---------- */

interface GoalProps {
  goal: { id: string; name: string; target_amount: number; current_amount: number } | null
  onSave: (goal: { name: string; target_amount: number; current_amount: number }) => void
}

function GoalEditor({ goal, onSave }: GoalProps) {
  const [name, setName] = useState(goal?.name ?? 'Holiday')
  const [target, setTarget] = useState(String(goal?.target_amount ?? 0))
  const [current, setCurrent] = useState(String(goal?.current_amount ?? 0))

  const num = (v: string) => roundMoney(Number.parseFloat(v.replace(',', '.')) || 0)
  const progress = num(target) > 0 ? Math.min(num(current) / num(target), 1) * 100 : 0

  return (
    <div className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Goal name"
        aria-label="Goal name"
        className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-[15px] font-medium text-white outline-none ring-1 ring-white/10"
      />
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs text-muted">Saved</span>
          <input
            value={current}
            onChange={(e) => setCurrent(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-[15px] tabular-nums text-white outline-none ring-1 ring-white/10"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs text-muted">Target</span>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-[15px] tabular-nums text-white outline-none ring-1 ring-white/10"
          />
        </label>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted">
        {formatMoney(num(current))} of {formatMoney(num(target))} · {Math.round(progress)}%
      </p>

      <button
        type="button"
        onClick={() =>
          onSave({
            name: name.trim() || 'Goal',
            target_amount: num(target),
            current_amount: num(current),
          })
        }
        className="w-full rounded-xl bg-slate-50 py-2.5 text-sm font-semibold text-ink"
      >
        {goal ? 'Save goal' : 'Create goal'}
      </button>
    </div>
  )
}
