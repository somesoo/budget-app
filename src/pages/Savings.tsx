import {
  ArrowsLeftRight,
  ArrowUp,
  Bank,
  Coins,
  PiggyBank,
  Plus,
  Scales,
  Target,
} from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SettingsLink } from '../components/SettingsLink'
import { Screen } from '../components/Screen'
import { AccountSheet } from '../components/savings/AccountSheet'
import { AccountCard, GoalCard } from '../components/savings/cards'
import { GoalSheet } from '../components/savings/GoalSheet'
import { MoneySheet, type MoneyMode } from '../components/savings/MoneySheet'
import { useCategories } from '../hooks/useCategories'
import { useExpensesBetween } from '../hooks/useExpenses'
import { useSavingsOverview } from '../hooks/useSavings'
import { currentMonthKey, formatMoneyWhole, formatMonthName, shiftMonth } from '../lib/calculations'
import { monthsEndingAt, windowRange } from '../lib/insights'
import { EMERGENCY_MONTHS, balanceHistory } from '../lib/savings'

type Sheet =
  | { kind: 'money'; mode: MoneyMode; goalId?: string }
  | { kind: 'account' }
  | { kind: 'goal' }
  | null

/**
 * Where the savings are and what they're for: goals on one side, accounts on
 * the other, and this month's saving against the plan on top.
 */
export function Savings() {
  const s = useSavingsOverview()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [showClosed, setShowClosed] = useState(false)
  const emergency = useEmergencyHint()

  const month = currentMonthKey()
  const openGoals = s.goals.filter((g) => !g.goal.archived)
  const closedGoals = s.goals.filter((g) => g.goal.archived)
  const openAccounts = s.accounts.filter((a) => !a.account.archived)
  const hiddenAccounts = s.accounts.filter((a) => a.account.archived)
  const months = monthsEndingAt(month, 12)
  const historyOf = (accountId: string) =>
    balanceHistory(
      s.movements.filter((m) => m.account_id === accountId),
      months,
    ).map((p) => p.balance)

  if (s.isLoading) {
    return (
      <Screen title="Savings" wide action={<SettingsLink />}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="h-72 animate-pulse rounded-3xl bg-white/5" />
          <div className="h-72 animate-pulse rounded-3xl bg-white/5" />
        </div>
      </Screen>
    )
  }

  if (!s.available) {
    return (
      <Screen title="Savings" wide action={<SettingsLink />}>
        <section className="max-w-xl rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
          <PiggyBank aria-hidden className="text-3xl text-accent-soft" />
          <h2 className="mt-3 text-lg font-semibold text-white">One step in Supabase first</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">
            Savings accounts need the tables from{' '}
            <code className="rounded bg-white/10 px-1">supabase/migrations/0007_savings.sql</code>.
            Paste it into the SQL Editor and run it, as with the earlier ones. Your current goal and
            what's saved toward it move onto an account called “Savings”.
          </p>
          {s.error && <p className="mt-2 text-sm text-red-300">{(s.error as Error).message}</p>}
        </section>
      </Screen>
    )
  }

  const planned = s.plannedThisMonth
  const toolbar: { mode: MoneyMode; label: string; icon: ReactNode }[] = [
    { mode: 'withdraw', label: 'Take out', icon: <ArrowUp aria-hidden /> },
    { mode: 'transfer', label: 'Move', icon: <ArrowsLeftRight aria-hidden /> },
    { mode: 'interest', label: 'Interest', icon: <Coins aria-hidden /> },
    { mode: 'balance', label: 'Update balance', icon: <Scales aria-hidden /> },
  ]

  return (
    <Screen title="Savings" wide action={<SettingsLink />}>
      {/* ---------- the totals ---------- */}
      <section className="mb-6 grid gap-4 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 sm:grid-cols-3 lg:p-5">
        <Figure label="Saved in all" value={formatMoneyWhole(s.total)} big />
        <Figure
          label={`Put aside in ${formatMonthName(month)}`}
          value={formatMoneyWhole(s.savedThisMonth)}
          sub={
            planned !== null && planned > 0
              ? s.savedThisMonth >= planned
                ? `The plan's ${formatMoneyWhole(planned)} is covered`
                : `${formatMoneyWhole(planned - s.savedThisMonth)} to go of the plan's ${formatMoneyWhole(planned)}`
              : 'No savings amount planned this month'
          }
        />
        <Figure
          label="Unassigned"
          value={formatMoneyWhole(s.unassigned)}
          sub={s.unassigned > 0.5 ? 'Not set aside for any goal yet' : 'Every złoty has a goal'}
          action={
            s.unassigned > 0.5 && openGoals.length > 0 ? (
              <button
                type="button"
                onClick={() => setSheet({ kind: 'money', mode: 'allocate' })}
                className="mt-1 text-sm font-semibold text-accent-soft hover:underline"
              >
                Assign it
              </button>
            ) : null
          }
        />
      </section>

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <button
          type="button"
          onClick={() => setSheet({ kind: 'money', mode: 'deposit' })}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-4 text-sm font-bold text-ink hover:bg-slate-50"
        >
          <Plus weight="bold" aria-hidden /> Save money
        </button>
        {toolbar.map((t) => (
          <button
            key={t.mode}
            type="button"
            onClick={() => setSheet({ kind: 'money', mode: t.mode })}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        {/* ---------- goals ---------- */}
        <section aria-labelledby="goals">
          <SectionHead
            id="goals"
            title="Goals"
            onAdd={() => setSheet({ kind: 'goal' })}
            addLabel="New goal"
          />
          {openGoals.length === 0 ? (
            <Empty
              icon={<Target aria-hidden />}
              text="A goal is what the money is for: a trip, an emergency fund, a car."
              cta="Add a goal"
              onClick={() => setSheet({ kind: 'goal' })}
            />
          ) : (
            <ul className="grid gap-3">
              {openGoals.map((g) => (
                <GoalCard
                  key={g.goal.id}
                  summary={g}
                  onSave={() => setSheet({ kind: 'money', mode: 'deposit', goalId: g.goal.id })}
                />
              ))}
            </ul>
          )}
          {s.neededPerMonth > 0 && (
            <p className="mt-3 text-sm leading-snug text-slate-300">
              The dated goals need {formatMoneyWhole(s.neededPerMonth)} a month together
              {planned !== null
                ? `; ${formatMonthName(month)}'s plan puts aside ${formatMoneyWhole(planned)}.`
                : '.'}{' '}
              <Link to="/budget" className="font-semibold text-accent-soft hover:underline">
                Plan {formatMonthName(shiftMonth(month, 1))}
              </Link>
            </p>
          )}
          {closedGoals.length > 0 && (
            <Toggle
              open={showClosed}
              onClick={() => setShowClosed((v) => !v)}
              count={closedGoals.length}
              what="closed goal"
            />
          )}
          {showClosed && (
            <ul className="mt-3 grid gap-3 opacity-70">
              {closedGoals.map((g) => (
                <GoalCard
                  key={g.goal.id}
                  summary={g}
                  onSave={() => setSheet({ kind: 'money', mode: 'deposit', goalId: g.goal.id })}
                />
              ))}
            </ul>
          )}
        </section>

        {/* ---------- accounts ---------- */}
        <section aria-labelledby="accounts">
          <SectionHead
            id="accounts"
            title="Accounts"
            onAdd={() => setSheet({ kind: 'account' })}
            addLabel="New account"
          />
          {openAccounts.length === 0 ? (
            <Empty
              icon={<Bank aria-hidden />}
              text="An account is where the money is: a savings account, a deposit, cash."
              cta="Add an account"
              onClick={() => setSheet({ kind: 'account' })}
            />
          ) : (
            <ul className="grid gap-2">
              {openAccounts.map((a) => (
                <AccountCard key={a.account.id} summary={a} history={historyOf(a.account.id)} />
              ))}
            </ul>
          )}
          {hiddenAccounts.length > 0 && showClosed && (
            <ul className="mt-2 grid gap-2 opacity-70">
              {hiddenAccounts.map((a) => (
                <AccountCard key={a.account.id} summary={a} history={historyOf(a.account.id)} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {sheet?.kind === 'money' && (
        <MoneySheet
          mode={sheet.mode}
          accounts={s.accounts}
          goals={s.goals}
          goalId={sheet.goalId}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'account' && <AccountSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === 'goal' && (
        <GoalSheet emergencyHint={emergency ?? undefined} onClose={() => setSheet(null)} />
      )}
    </Screen>
  )
}

/** EMERGENCY_MONTHS of typical monthly spending (monthly categories, last 3 complete months). */
function useEmergencyHint(): number | null {
  const months = monthsEndingAt(shiftMonth(currentMonthKey(), -1), 3)
  const { from, to } = windowRange(months)
  const { data: expenses } = useExpensesBetween(from, to)
  const { data: categories } = useCategories()
  if (!expenses || !categories) return null
  const monthly = new Set(categories.filter((c) => c.kind === 'monthly').map((c) => c.id))
  const total = expenses.filter((e) => monthly.has(e.category_id)).reduce((s, e) => s + e.amount, 0)
  return total > 0 ? Math.round(((total / months.length) * EMERGENCY_MONTHS) / 100) * 100 : null
}

function Figure({
  label,
  value,
  sub,
  big,
  action,
}: {
  label: string
  value: string
  sub?: string
  big?: boolean
  action?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted">{label}</p>
      <p className={`font-bold tabular-nums text-white ${big ? 'text-3xl' : 'text-2xl'}`}>
        {value}
      </p>
      {sub && <p className="text-sm leading-snug text-slate-300">{sub}</p>}
      {action}
    </div>
  )
}

function SectionHead({
  id,
  title,
  onAdd,
  addLabel,
}: {
  id: string
  title: string
  onAdd: () => void
  addLabel: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-base font-semibold text-white">
        {title}
      </h2>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-accent-soft hover:bg-accent/10"
      >
        <Plus weight="bold" aria-hidden /> {addLabel}
      </button>
    </div>
  )
}

function Empty({
  icon,
  text,
  cta,
  onClick,
}: {
  icon: ReactNode
  text: string
  cta: string
  onClick: () => void
}) {
  return (
    <div className="rounded-3xl bg-white/[0.03] p-6 text-center ring-1 ring-dashed ring-white/10">
      <span className="text-2xl text-muted">{icon}</span>
      <p className="mx-auto mt-2 max-w-xs text-sm text-slate-300">{text}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-3 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-ink hover:bg-slate-50"
      >
        {cta}
      </button>
    </div>
  )
}

function Toggle({
  open,
  onClick,
  count,
  what,
}: {
  open: boolean
  onClick: () => void
  count: number
  what: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 text-sm font-medium text-muted hover:text-white"
    >
      {open ? 'Hide' : 'Show'} {count} {what}
      {count === 1 ? '' : 's'}
    </button>
  )
}
