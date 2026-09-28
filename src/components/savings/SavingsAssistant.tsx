import {
  ArrowsLeftRight,
  HandCoins,
  PiggyBank,
  SlidersHorizontal,
  Trash,
} from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { useDeviceUser } from '../../hooks/useDeviceUser'
import { useSavingsActions, type SavingsOverview } from '../../hooks/useSavings'
import { formatMoneyCompact } from '../../lib/calculations'
import { openLoans, type LoanSummary } from '../../lib/loans'
import type { AccountSummary } from '../../lib/savings'
import { BottomSheet } from '../history/BottomSheet'
import { AccountSheet } from './AccountSheet'
import { BorrowSheet } from './BorrowSheet'
import { MoneySheet } from './MoneySheet'
import { SaveMoreSheet } from './SaveMoreSheet'
import { SharesSheet } from './SharesSheet'

type Step =
  | { kind: 'save' }
  | { kind: 'borrow' }
  | { kind: 'move' }
  | { kind: 'pick'; then: 'shares' | 'close' }
  | { kind: 'shares'; account: AccountSummary }
  | { kind: 'close'; account: AccountSummary }
  | null

/**
 * "What do you want to do?": the common money moves as guided steps, each
 * saying what to do in the bank as well as booking it here.
 */
export function SavingsAssistant({ overview }: { overview: SavingsOverview }) {
  const [step, setStep] = useState<Step>(null)
  const open = overview.accounts.filter((a) => !a.account.archived)

  const pickAccount = (then: 'shares' | 'close') =>
    open.length === 1
      ? setStep({ kind: then, account: open[0] })
      : setStep({ kind: 'pick', then })

  return (
    <section aria-labelledby="assistant" className="mb-6">
      <h2 id="assistant" className="mb-2 text-base font-semibold text-white">
        What do you want to do?
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Action
          icon={<PiggyBank aria-hidden />}
          title="Save more"
          text="Put some of this month aside"
          onClick={() => setStep({ kind: 'save' })}
          primary
        />
        <Action
          icon={<HandCoins aria-hidden />}
          title="I need money"
          text="Borrow from savings, pay it back"
          onClick={() => setStep({ kind: 'borrow' })}
        />
        <Action
          icon={<ArrowsLeftRight aria-hidden />}
          title="Move money"
          text="From one account to another"
          onClick={() => setStep({ kind: 'move' })}
          disabled={open.length < 2}
        />
        <Action
          icon={<SlidersHorizontal aria-hidden />}
          title="Fix goal shares"
          text="Correct what each goal holds"
          onClick={() => pickAccount('shares')}
          disabled={open.length === 0}
        />
        <Action
          icon={<Trash aria-hidden />}
          title="Close an account"
          text="Move its money, then delete it"
          onClick={() => pickAccount('close')}
          disabled={open.length === 0}
        />
      </div>

      {step?.kind === 'save' && <SaveMoreSheet overview={overview} onClose={() => setStep(null)} />}
      {step?.kind === 'borrow' && <BorrowSheet overview={overview} onClose={() => setStep(null)} />}
      {step?.kind === 'move' && (
        <MoneySheet
          mode="transfer"
          accounts={overview.accounts}
          goals={overview.goals}
          onClose={() => setStep(null)}
        />
      )}
      {step?.kind === 'pick' && (
        <BottomSheet
          title={step.then === 'shares' ? 'Which account?' : 'Close which account?'}
          onClose={() => setStep(null)}
        >
          <ul className="grid gap-1.5 pb-2">
            {open.map((a) => (
              <li key={a.account.id}>
                <button
                  type="button"
                  onClick={() => setStep({ kind: step.then, account: a })}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-white/10 hover:bg-white/5"
                >
                  <span
                    aria-hidden
                    className="h-6 w-1.5 rounded-full"
                    style={{ backgroundColor: a.account.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-white">
                    {a.account.name}
                  </span>
                  <span className="text-sm tabular-nums text-slate-300">
                    {formatMoneyCompact(a.balance)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
      {step?.kind === 'shares' && (
        <SharesSheet summary={step.account} goals={overview.goals} onClose={() => setStep(null)} />
      )}
      {step?.kind === 'close' && (
        <AccountSheet account={step.account.account} onClose={() => setStep(null)} startDeleting />
      )}
    </section>
  )
}

function Action({
  icon,
  title,
  text,
  onClick,
  primary,
  disabled,
}: {
  icon: ReactNode
  title: string
  text: string
  onClick: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-start gap-1 rounded-2xl p-3 text-left ring-1 transition active:scale-[0.98] disabled:opacity-40 ${
        primary
          ? 'bg-accent/15 ring-accent/35 hover:bg-accent/20'
          : 'bg-white/5 ring-white/10 hover:bg-white/10'
      }`}
    >
      <span className="text-xl text-accent-soft">{icon}</span>
      <span className="text-sm font-semibold text-white">{title}</span>
      <span className="text-xs leading-snug text-muted">{text}</span>
    </button>
  )
}

/** Loans from savings still being paid back, each with a button to pay the next part now. */
export function LoansCard({ overview }: { overview: SavingsOverview }) {
  const loans = openLoans(overview.loans)
  if (loans.length === 0) return null
  const owed = loans.reduce((s, l) => s + l.remaining, 0)
  return (
    <section className="mb-6 rounded-3xl bg-amber-400/10 p-4 ring-1 ring-amber-300/25">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Borrowed from savings</h2>
        <span className="text-sm tabular-nums text-amber-200">
          {formatMoneyCompact(owed)} to pay back
        </span>
      </div>
      <ul className="divide-y divide-white/5">
        {loans.map((l) => (
          <LoanRow key={l.loan.id} summary={l} overview={overview} />
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Each month’s plan puts the instalment aside first; you can also pay a part back now.
      </p>
    </section>
  )
}

function LoanRow({ summary, overview }: { summary: LoanSummary; overview: SavingsOverview }) {
  const { repay } = useSavingsActions()
  const { person } = useDeviceUser()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { loan, repaid, remaining, nextInstalment } = summary
  const goal = loan.goal_id ? overview.goals.find((g) => g.goal.id === loan.goal_id) : undefined
  const account = overview.accounts.find((a) => a.account.id === loan.account_id)?.account

  const pay = () => {
    setError(null)
    repay.mutate(
      { loan, amount: nextInstalment, person },
      {
        onSuccess: () => setConfirming(false),
        onError: (e) => setError((e as Error).message),
      },
    )
  }

  return (
    <li className="py-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-white">{loan.note}</p>
          <p className="truncate text-xs tabular-nums text-muted">
            {formatMoneyCompact(repaid)} of {formatMoneyCompact(loan.amount)} back ·{' '}
            {formatMoneyCompact(loan.monthly)}/mo to {goal?.goal.name ?? account?.name ?? 'savings'}
          </p>
        </div>
        <button
          type="button"
          disabled={repay.isPending}
          onClick={() => (confirming ? pay() : setConfirming(true))}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ring-1 transition disabled:opacity-50 ${
            confirming
              ? 'bg-slate-50 text-ink ring-slate-50'
              : 'text-accent-soft ring-accent/35 hover:bg-accent/10'
          }`}
        >
          {confirming
            ? `Confirm ${formatMoneyCompact(nextInstalment)}`
            : `Pay back ${formatMoneyCompact(nextInstalment)}`}
        </button>
      </div>
      {confirming && account && (
        <p className="mt-1.5 text-xs text-slate-300">
          In the bank: transfer {formatMoneyCompact(nextInstalment)} from your everyday account to{' '}
          {account.name}. {formatMoneyCompact(remaining - nextInstalment)} will be left to pay back.
        </p>
      )}
      {error && <p className="mt-1 text-sm text-red-300">{error}</p>}
    </li>
  )
}
