import { useState, type FormEvent } from 'react'
import { useSaveAccount, useSavingsActions, type SavingsOverview } from '../../hooks/useSavings'
import { formatMoneyCompact, roundMoney } from '../../lib/calculations'
import type { GoalSummary } from '../../lib/savings'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { Field, Select, SubmitRow, inputClass } from './fields'

const NEW_ACCOUNT = '__new__'

/**
 * Says how much a goal has, when the money is already there but the app
 * doesn't know it: say, on your everyday account. The difference is booked as
 * a balance correction on the account the money is on, not as a deposit, so
 * it's no part of this month's saving or spending.
 */
export function SetSavedSheet({
  summary,
  overview,
  onClose,
}: {
  summary: GoalSummary
  overview: SavingsOverview
  onClose: () => void
}) {
  const { setBalance, allocate } = useSavingsActions()
  const saveAccount = useSaveAccount()
  const open = overview.accounts.filter((a) => !a.account.archived)
  const { goal, saved } = summary

  const [amount, setAmount] = useState(saved)
  const [accountId, setAccountId] = useState(
    summary.funding[0]?.account.id ?? open[0]?.account.id ?? NEW_ACCOUNT,
  )
  const [newName, setNewName] = useState('Everyday account')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const diff = roundMoney(amount - saved)
  const account = open.find((a) => a.account.id === accountId)
  const shareHere = account?.byGoal[goal.id] ?? 0
  const tooMuchOff = diff < 0 && -diff > shareHere

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      let id = accountId
      let balance = account?.balance ?? 0
      if (accountId === NEW_ACCOUNT) {
        id = await saveAccount.mutateAsync({
          name: newName.trim(),
          kind: 'other',
          owner: 'joint',
          interest_rate: null,
          color: '#64748b',
        })
        balance = 0
      }
      const note = `${goal.name}: saved amount corrected`
      if (diff > 0) {
        // the money was there already: the account grows by it, and it's the goal's
        await setBalance.mutateAsync({ account: id, balance: roundMoney(balance + diff), note })
        await allocate.mutateAsync({ account: id, goal: goal.id, delta: diff })
      } else if (diff < 0) {
        await allocate.mutateAsync({ account: id, goal: goal.id, delta: diff })
        await setBalance.mutateAsync({ account: id, balance: roundMoney(balance + diff), note })
      }
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <BottomSheet title={`How much ${goal.name} has`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <p className="text-sm leading-snug text-slate-300">
          For money that’s already there but the app doesn’t know about. It’s booked as a
          correction of the account’s balance, not as saving or spending, so this month’s
          numbers stay as they are.
        </p>

        <Field label="Saved for it" help={`The app has ${formatMoneyCompact(saved)} now.`}>
          <MoneyInput value={amount} onChange={setAmount} label="Saved for it" size="lg" />
        </Field>

        <Field
          label="Where the money is"
          help={
            accountId === NEW_ACCOUNT
              ? 'Adds this account to Savings, holding only what you say is set aside.'
              : undefined
          }
        >
          <Select value={accountId} onChange={setAccountId}>
            {open.map((a) => (
              <option key={a.account.id} value={a.account.id}>
                {a.account.name} · {formatMoneyCompact(a.balance)}
              </option>
            ))}
            <option value={NEW_ACCOUNT}>Somewhere else, e.g. my everyday account…</option>
          </Select>
        </Field>
        {accountId === NEW_ACCOUNT && (
          <Field label="Call it">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={60}
              className={inputClass}
            />
          </Field>
        )}

        {diff !== 0 && !tooMuchOff && (
          <p className="rounded-xl bg-white/5 px-3 py-2.5 text-sm text-slate-300">
            {diff > 0
              ? `${formatMoneyCompact(diff)} more for ${goal.name}, on ${account?.account.name ?? newName.trim()}.`
              : `${formatMoneyCompact(-diff)} less for ${goal.name}, off ${account?.account.name}.`}
          </p>
        )}
        {tooMuchOff && (
          <p className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            {goal.name} only has {formatMoneyCompact(shareHere)} on this account. Pick the account
            its money is on.
          </p>
        )}

        <SubmitRow
          label="Save"
          disabled={
            diff === 0 || tooMuchOff || amount < 0 || (accountId === NEW_ACCOUNT && !newName.trim())
          }
          pending={pending}
          error={error}
        />
      </form>
    </BottomSheet>
  )
}
