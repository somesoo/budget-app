import { ArrowDown, ArrowUp, Trash } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import {
  useAddCategory,
  useCategories,
  useCategoryExpenseCount,
  useDeleteCategory,
  useUpdateCategory,
} from '../../hooks/useCategories'
import { formatMoneyWhole, roundMoney } from '../../lib/calculations'
import { roundUpPlan } from '../../lib/planning'
import { PERSON_LABELS } from '../../config'
import type { Category, Person } from '../../types'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { ColorChoice } from '../savings/ColorChoice'
import { Field, Select, SubmitRow, Switch, inputClass } from '../savings/fields'

/**
 * A monthly category: its name, color, default limit (months without a plan
 * use it), whether it's in the Home chart, its place in the list, hiding or
 * deleting it.
 */
export function CategorySheet({
  category,
  typical,
  neighbours,
  onClose,
}: {
  category?: Category
  /** Average of the last complete months, to set the limit from. */
  typical?: number
  /** The categories above and below, for moving it. */
  neighbours?: { up?: Category; down?: Category }
  onClose: () => void
}) {
  const add = useAddCategory()
  const update = useUpdateCategory()
  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState(category?.color ?? '#3987e5')
  const [limit, setLimit] = useState(category?.monthly_limit ?? 0)
  const [inChart, setInChart] = useState(category?.show_in_chart ?? true)
  const [owner, setOwner] = useState<Person | ''>(category?.owner ?? '')
  // only sent when it's someone's: the column arrives with migration 0013
  const ownerField =
    (owner || null) !== (category?.owner ?? null) ? { owner: (owner || null) as Person | null } : {}
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      if (category) {
        await update.mutateAsync({
          id: category.id,
          name: name.trim(),
          color,
          monthly_limit: roundMoney(limit),
          show_in_chart: inChart,
          ...ownerField,
        })
      } else {
        await add.mutateAsync({
          name: name.trim(),
          color,
          monthly_limit: roundMoney(limit),
          ...ownerField,
        })
      }
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // swapping places with a neighbour is two writes of sort_order
  const move = async (other: Category | undefined) => {
    if (!category || !other) return
    await Promise.all([
      update.mutateAsync({ id: category.id, sort_order: other.sort_order }),
      update.mutateAsync({ id: other.id, sort_order: category.sort_order }),
    ])
    onClose()
  }

  const toggleHidden = async () => {
    if (!category) return
    await update.mutateAsync({ id: category.id, archived: !category.archived })
    onClose()
  }

  return (
    <BottomSheet title={category ? `Edit ${category.name}` : 'New category'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="e.g. Gifts"
            className={inputClass}
            autoFocus={!category}
          />
        </Field>
        <Field
          label="Default monthly limit"
          help={
            typical ? (
              <>
                Months without a plan use it. The last 3 months averaged{' '}
                <button
                  type="button"
                  onClick={() => setLimit(roundUpPlan(typical))}
                  className="font-semibold text-accent-soft hover:underline"
                >
                  {formatMoneyWhole(typical)}
                </button>
                .
              </>
            ) : (
              'Months without a plan use it.'
            )
          }
        >
          <MoneyInput value={limit} onChange={setLimit} label="Default monthly limit" size="lg" />
        </Field>
        <Switch
          label="In the “Where it goes” chart"
          help="Turn off for fixed costs like rent; they still count everywhere else."
          checked={inChart}
          onChange={setInChart}
        />
        <Field
          label="Whose"
          help={
            owner
              ? `${PERSON_LABELS[owner]}'s allowance: money nobody has to explain. Both of you can log and fix its expenses, but only ${PERSON_LABELS[owner]} sees the notes. It still counts in the plan and every total.`
              : 'Shared by both of you. Make it one person’s to use it as their allowance.'
          }
        >
          <Select value={owner} onChange={(v) => setOwner(v as Person | '')}>
            <option value="">Shared</option>
            <option value="bubs">{PERSON_LABELS.bubs}'s allowance</option>
            <option value="meow">{PERSON_LABELS.meow}'s allowance</option>
          </Select>
        </Field>
        <Field label="Color">
          <ColorChoice value={color} onChange={setColor} />
        </Field>
        <SubmitRow
          label={category ? 'Save changes' : 'Add category'}
          disabled={!name.trim()}
          pending={add.isPending || update.isPending}
          error={error}
        />
        {category && (
          <div className="flex flex-wrap gap-2">
            {!category.archived && (
              <>
                <button
                  type="button"
                  onClick={() => move(neighbours?.up)}
                  disabled={!neighbours?.up}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5 disabled:opacity-30"
                >
                  <ArrowUp aria-hidden /> Move up
                </button>
                <button
                  type="button"
                  onClick={() => move(neighbours?.down)}
                  disabled={!neighbours?.down}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5 disabled:opacity-30"
                >
                  <ArrowDown aria-hidden /> Move down
                </button>
              </>
            )}
            <button
              type="button"
              onClick={toggleHidden}
              className="ml-auto rounded-full px-3 py-2 text-sm font-semibold text-muted ring-1 ring-white/10 hover:bg-white/5"
            >
              {category.archived ? 'Show it again' : 'Hide it'}
            </button>
          </div>
        )}
        {category && !category.archived && (
          <p className="-mt-2 text-xs text-muted">
            Hiding takes it off the Add screen and out of planning; old expenses keep it.
          </p>
        )}
        {category && <DeleteCategory category={category} onDone={onClose} />}
      </form>
    </BottomSheet>
  )
}

/**
 * Deleting for good. A category with expenses hands them to another one
 * first, so nothing ends up without a category.
 */
function DeleteCategory({ category, onDone }: { category: Category; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const { data: categories = [] } = useCategories()
  const { data: count, isLoading } = useCategoryExpenseCount(open ? category.id : undefined)
  const remove = useDeleteCategory()
  const others = categories.filter((c) => c.id !== category.id && c.kind === 'monthly')
  const [moveTo, setMoveTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const target = moveTo || others.find((c) => !c.archived)?.id || ''

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-semibold text-red-300 ring-1 ring-red-400/30 hover:bg-red-500/10"
      >
        <Trash aria-hidden /> Delete category
      </button>
    )
  }

  const hasExpenses = (count ?? 0) > 0
  const confirm = async () => {
    setError(null)
    try {
      await remove.mutateAsync({ id: category.id, moveTo: hasExpenses ? target : undefined })
      onDone()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="grid gap-3 rounded-2xl bg-red-500/10 p-3.5 ring-1 ring-red-400/30">
      {isLoading ? (
        <p className="text-sm text-slate-300">Checking its expenses…</p>
      ) : hasExpenses ? (
        <Field
          label={`${count} ${count === 1 ? 'expense is' : 'expenses are'} in ${category.name}. Move ${count === 1 ? 'it' : 'them'} to`}
        >
          <Select value={target} onChange={setMoveTo}>
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.archived ? ' (hidden)' : ''}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="text-sm text-slate-200">
          No expenses in {category.name}. Delete it for good?
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
        >
          Keep it
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={isLoading || remove.isPending || (hasExpenses && !target)}
          className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-40"
        >
          {remove.isPending ? 'Deleting…' : hasExpenses ? 'Move and delete' : 'Delete'}
        </button>
      </div>
      {error && <p className="text-sm text-red-300">Not deleted: {error}</p>}
    </div>
  )
}
