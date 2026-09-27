import { useState, type FormEvent } from 'react'
import { useCategories, useUpdateCategory } from '../../hooks/useCategories'
import { useUpsertGoal } from '../../hooks/useGoal'
import { formatMoneyWhole, roundMoney, todayKey } from '../../lib/calculations'
import type { Goal } from '../../types'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { ColorChoice } from './ColorChoice'
import { Field, Segments, SubmitRow, inputClass } from './fields'

/**
 * New goal, or editing one. A goal can be open-ended (an emergency fund) or
 * have a target, with or without a date; the date is what turns it into a
 * monthly amount to put aside. Every goal can also be spent from, like a trip:
 * the target is then its budget, and it can have the dates of the trip.
 */
export function GoalSheet({
  goal,
  emergencyHint,
  onClose,
}: {
  goal?: Goal
  /** A sensible emergency fund: a few months of typical spending. */
  emergencyHint?: number
  onClose: () => void
}) {
  const upsert = useUpsertGoal()
  const updateCategory = useUpdateCategory()
  const { data: categories = [] } = useCategories()
  // where its spending goes (see useGoalTrips)
  const trip = goal
    ? categories.find((c) => c.kind === 'project' && c.goal_id === goal.id)
    : undefined
  const [name, setName] = useState(goal?.name ?? '')
  const [shape, setShape] = useState<'target' | 'open'>(
    goal && goal.target_amount === 0 ? 'open' : 'target',
  )
  const [target, setTarget] = useState(goal?.target_amount ?? 0)
  const [date, setDate] = useState(goal?.target_date ?? '')
  const [color, setColor] = useState(goal?.color ?? '#22c55e')
  const [note, setNote] = useState(goal?.note ?? '')
  const [starts, setStarts] = useState(trip?.starts_on ?? '')
  const [ends, setEnds] = useState(trip?.ends_on ?? '')
  const [error, setError] = useState<string | null>(null)

  const datesOk = !starts || !ends || starts <= ends

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const target_amount = shape === 'open' ? 0 : roundMoney(target)
    try {
      await upsert.mutateAsync({
        id: goal?.id,
        name: name.trim(),
        target_amount,
        target_date: shape === 'open' || !date ? null : date,
        color,
        note: note.trim() || null,
      })
      // migration 0009 carries name, colour and target over too; the dates are only here
      if (trip) {
        await updateCategory.mutateAsync({
          id: trip.id,
          name: name.trim(),
          color,
          budget_total: target_amount > 0 ? target_amount : null,
          starts_on: starts || null,
          ends_on: ends || null,
        })
      }
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const archive = async () => {
    if (!goal) return
    await upsert.mutateAsync({ ...goal, archived: !goal.archived })
    if (trip) await updateCategory.mutateAsync({ id: trip.id, archived: !goal.archived })
    onClose()
  }

  return (
    <BottomSheet title={goal ? `Edit ${goal.name}` : 'New goal'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <Field label="What it's for">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Japan 2027, Emergency fund"
            className={inputClass}
            autoFocus={!goal}
          />
        </Field>
        <Segments
          value={shape}
          onChange={setShape}
          options={[
            { value: 'target', label: 'Has a target' },
            { value: 'open', label: 'Keeps growing' },
          ]}
        />
        {shape === 'target' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Target"
              help={
                emergencyHint && /emergency|cushion|poduszk/i.test(name)
                  ? `${formatMoneyWhole(emergencyHint)} is 3 months of your typical spending.`
                  : undefined
              }
            >
              <MoneyInput value={target} onChange={setTarget} label="Target" size="lg" />
            </Field>
            <Field label="By (optional)">
              <input
                type="date"
                value={date}
                min={todayKey()}
                onChange={(e) => setDate(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </Field>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No finish line: good for an emergency fund or a general cushion.
          </p>
        )}
        {trip && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trip from (optional)">
              <input
                type="date"
                value={starts}
                onChange={(e) => setStarts(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </Field>
            <Field
              label="Until (optional)"
              help={datesOk ? undefined : 'Ends before it starts'}
            >
              <input
                type="date"
                value={ends}
                onChange={(e) => setEnds(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </Field>
          </div>
        )}
        <Field label="Note (optional)">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            className={inputClass}
          />
        </Field>
        <Field label="Color">
          <ColorChoice value={color} onChange={setColor} />
        </Field>
        <SubmitRow
          label={goal ? 'Save changes' : 'Add goal'}
          disabled={!name.trim() || (shape === 'target' && target <= 0) || !datesOk}
          pending={upsert.isPending || updateCategory.isPending}
          error={error}
        />
        {goal && (
          <button
            type="button"
            onClick={archive}
            className="rounded-2xl py-2.5 text-sm font-semibold text-muted ring-1 ring-white/10 hover:bg-white/5"
          >
            {goal.archived ? 'Bring it back' : 'Close this goal'}
          </button>
        )}
      </form>
    </BottomSheet>
  )
}
