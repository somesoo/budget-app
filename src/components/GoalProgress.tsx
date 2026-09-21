import { useState } from 'react'
import { CURRENCY_SUFFIX, GOAL_QUICK_AMOUNTS } from '../config'
import { formatMoney, roundMoney } from '../lib/calculations'
import type { Goal } from '../types'

interface Props {
  goal: Goal
  onAdd: (delta: number) => void
  pending: boolean
}

/**
 * Savings goal with a way to actually pay into it: pick a quick amount or type
 * one, then confirm. A leading minus takes money back out.
 */
export function GoalProgress({ goal, onAdd, pending }: Props) {
  const [open, setOpen] = useState(false)
  const [amountText, setAmountText] = useState('')

  const delta = roundMoney(Number.parseFloat(amountText.replace(',', '.')) || 0)
  const remaining = Math.max(goal.target_amount - goal.current_amount, 0)
  const progress =
    goal.target_amount > 0
      ? Math.min(goal.current_amount / goal.target_amount, 1) * 100
      : 0

  const commit = () => {
    if (delta === 0) return
    onAdd(delta)
    setAmountText('')
    setOpen(false)
  }

  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-white">{formatMoney(goal.current_amount)}</span>
        <span className="text-muted">of {formatMoney(goal.target_amount)}</span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400 transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-muted">
        {remaining > 0 ? `${formatMoney(remaining)} to go` : 'Goal reached 🎉'}
      </p>

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {GOAL_QUICK_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setAmountText(String(amount))}
                className={`h-12 rounded-xl text-sm font-semibold tabular-nums ring-1 ring-white/10 transition active:scale-95 ${
                  delta === amount ? 'bg-emerald-400 text-ink' : 'bg-white/5 text-slate-100'
                }`}
              >
                {amount}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 ring-1 ring-white/10">
            <input
              value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,-]/g, ''))}
              inputMode="decimal"
              placeholder="0"
              aria-label="Amount to add"
              className="w-full bg-transparent py-2.5 text-lg font-semibold tabular-nums text-white outline-none placeholder:text-white/25"
            />
            <span className="text-sm text-muted">{CURRENCY_SUFFIX}</span>
          </div>

          <p className="text-xs text-muted">Put a minus in front to take money back out.</p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setAmountText('')
              }}
              className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-semibold text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={delta === 0 || pending}
              className="flex-1 rounded-xl bg-emerald-400 py-2.5 text-sm font-bold text-ink disabled:opacity-40"
            >
              {delta < 0 ? `Take out ${Math.abs(delta)}` : `Add ${delta || ''}`}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-xl bg-emerald-400/15 py-2.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30 active:bg-emerald-400/25"
        >
          Add money
        </button>
      )}
    </div>
  )
}
