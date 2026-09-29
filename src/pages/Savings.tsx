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
import { AskLink } from '../components/AskLink'
import { SettingsLink } from '../components/SettingsLink'
import { Screen } from '../components/Screen'
import { AccountSheet } from '../components/savings/AccountSheet'
import { AccountCard, GoalCard } from '../components/savings/cards'
import { LoansCard, SavingsAssistant } from '../components/savings/SavingsAssistant'
import { GoalSheet } from '../components/savings/GoalSheet'
import { MoneySheet, type MoneyMode } from '../components/savings/MoneySheet'
import { useGoalTrips } from '../hooks/useGoalTrips'
import { useTypicalSpending } from '../hooks/useTypicalSpending'
import { useSavingsOverview } from '../hooks/useSavings'
import { currentMonthKey, formatMoneyWhole, formatMonthName, shiftMonth } from '../lib/calculations'
import { monthsEndingAt } from '../lib/insights'
import { EMERGENCY_MONTHS, balanceHistory } from '../lib/savings'
import { t } from '../i18n'
import { Trans } from '../i18n/Trans'

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
  const [showHidden, setShowHidden] = useState(false)
  const trips = useGoalTrips()
  const spentFrom = (goalId: string) => trips.tripOf(goalId)?.spent ?? 0
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
      <Screen title={t('nav.savings')} wide action={<SettingsLink />}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="h-72 animate-pulse rounded-3xl bg-white/5" />
          <div className="h-72 animate-pulse rounded-3xl bg-white/5" />
        </div>
      </Screen>
    )
  }

  if (!s.available) {
    return (
      <Screen title={t('nav.savings')} wide action={<SettingsLink />}>
        <section className="max-w-xl rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
          <PiggyBank aria-hidden className="text-3xl text-accent-soft" />
          <h2 className="mt-3 text-lg font-semibold text-white">{t('savingsPage.setupTitle')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">
            <Trans
              k="savingsPage.setup"
              values={{ file: 'supabase/archive/0007_savings.sql' }}
              tags={{ code: (s) => <code className="rounded bg-white/10 px-1">{s}</code> }}
            />
          </p>
          {s.error && <p className="mt-2 text-sm text-red-300">{(s.error as Error).message}</p>}
        </section>
      </Screen>
    )
  }

  const planned = s.plannedThisMonth
  const toolbar: { mode: MoneyMode; label: string; icon: ReactNode }[] = [
    { mode: 'withdraw', label: t('savingsPage.takeOut'), icon: <ArrowUp aria-hidden /> },
    { mode: 'transfer', label: t('savingsPage.move'), icon: <ArrowsLeftRight aria-hidden /> },
    { mode: 'interest', label: t('movement.interest'), icon: <Coins aria-hidden /> },
    { mode: 'balance', label: t('savingsPage.updateBalance'), icon: <Scales aria-hidden /> },
  ]

  return (
    <Screen
      title={t('nav.savings')}
      wide
      action={
        <div className="flex items-center gap-1">
          <AskLink question={t('savingsPage.askQuestion')} />
          <SettingsLink />
        </div>
      }
    >
      {/* ---------- the totals ---------- */}
      <section
        data-tour="savings-totals"
        className="mb-6 grid gap-4 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 sm:grid-cols-3 lg:p-5"
      >
        <Figure label={t('savingsPage.total')} value={formatMoneyWhole(s.total)} big />
        <Figure
          label={t('savingsPage.putAside', { month: formatMonthName(month) })}
          value={formatMoneyWhole(s.savedThisMonth)}
          sub={
            planned !== null && planned > 0
              ? s.savedThisMonth >= planned
                ? t('savingsPage.planCovered', { amount: formatMoneyWhole(planned) })
                : t('savingsPage.planToGo', {
                    amount: formatMoneyWhole(planned - s.savedThisMonth),
                    planned: formatMoneyWhole(planned),
                  })
              : t('savingsPage.noPlan')
          }
        />
        <Figure
          label={t('savingsPage.unassigned')}
          value={formatMoneyWhole(s.unassigned)}
          sub={
            s.unassigned > 0.5 ? t('savingsPage.unassignedSome') : t('savingsPage.unassignedNone')
          }
          action={
            s.unassigned > 0.5 && openGoals.length > 0 ? (
              <button
                type="button"
                onClick={() => setSheet({ kind: 'money', mode: 'allocate' })}
                className="mt-1 text-sm font-semibold text-accent-soft hover:underline"
              >
                {t('savingsPage.assign')}
              </button>
            ) : null
          }
        />
      </section>

      <SavingsAssistant overview={s} />
      <LoansCard overview={s} />

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <button
          type="button"
          onClick={() => setSheet({ kind: 'money', mode: 'deposit' })}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-4 text-sm font-bold text-ink hover:bg-slate-50"
        >
          <Plus weight="bold" aria-hidden /> {t('money.title.deposit')}
        </button>
        {toolbar.map((tool) => (
          <button
            key={tool.mode}
            type="button"
            onClick={() => setSheet({ kind: 'money', mode: tool.mode })}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
          >
            {tool.icon} {tool.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        {/* ---------- goals ---------- */}
        <section aria-labelledby="goals" data-tour="savings-goals">
          <SectionHead
            id="goals"
            title={t('add.goals')}
            onAdd={() => setSheet({ kind: 'goal' })}
            addLabel={t('goalSheet.new')}
          />
          {openGoals.length === 0 ? (
            <Empty
              icon={<Target aria-hidden />}
              text={t('savingsPage.goalsEmpty')}
              cta={t('savingsPage.addGoal')}
              onClick={() => setSheet({ kind: 'goal' })}
            />
          ) : (
            <ul className="grid gap-3">
              {openGoals.map((g) => (
                <GoalCard
                  key={g.goal.id}
                  summary={g}
                  spent={spentFrom(g.goal.id)}
                  onSave={() => setSheet({ kind: 'money', mode: 'deposit', goalId: g.goal.id })}
                />
              ))}
            </ul>
          )}
          {s.neededPerMonth > 0 && (
            <p className="mt-3 text-sm leading-snug text-slate-300">
              {planned !== null
                ? t('savingsPage.neededPlanned', {
                    amount: formatMoneyWhole(s.neededPerMonth),
                    month: formatMonthName(month),
                    planned: formatMoneyWhole(planned),
                  })
                : t('savingsPage.needed', { amount: formatMoneyWhole(s.neededPerMonth) })}{' '}
              <Link to="/budget" className="font-semibold text-accent-soft hover:underline">
                {t('budget.planMonth', { month: formatMonthName(shiftMonth(month, 1)) })}
              </Link>
            </p>
          )}
          {closedGoals.length > 0 && (
            <Toggle
              open={showClosed}
              onClick={() => setShowClosed((v) => !v)}
              showLabel={t('savingsPage.showClosed', { count: closedGoals.length })}
              hideLabel={t('savingsPage.hideClosed', { count: closedGoals.length })}
            />
          )}
          {showClosed && (
            <ul className="mt-3 grid gap-3 opacity-70">
              {closedGoals.map((g) => (
                <GoalCard
                  key={g.goal.id}
                  summary={g}
                  spent={spentFrom(g.goal.id)}
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
            title={t('savingsPage.accounts')}
            onAdd={() => setSheet({ kind: 'account' })}
            addLabel={t('account.new')}
          />
          {openAccounts.length === 0 ? (
            <Empty
              icon={<Bank aria-hidden />}
              text={t('savingsPage.accountsEmpty')}
              cta={t('savingsPage.addAccount')}
              onClick={() => setSheet({ kind: 'account' })}
            />
          ) : (
            <ul className="grid gap-2">
              {openAccounts.map((a) => (
                <AccountCard key={a.account.id} summary={a} history={historyOf(a.account.id)} />
              ))}
            </ul>
          )}
          {hiddenAccounts.length > 0 && (
            <Toggle
              open={showHidden}
              onClick={() => setShowHidden((v) => !v)}
              showLabel={t('savingsPage.showHidden', { count: hiddenAccounts.length })}
              hideLabel={t('savingsPage.hideHidden', { count: hiddenAccounts.length })}
            />
          )}
          {hiddenAccounts.length > 0 && showHidden && (
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

/** EMERGENCY_MONTHS of typical monthly spending, rounded to 100 zł. */
function useEmergencyHint(): number | null {
  const typical = useTypicalSpending()
  return typical === null ? null : Math.round((typical * EMERGENCY_MONTHS) / 100) * 100
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
  showLabel,
  hideLabel,
}: {
  open: boolean
  onClick: () => void
  showLabel: string
  hideLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 text-sm font-medium text-muted hover:text-white"
    >
      {open ? hideLabel : showLabel}
    </button>
  )
}
