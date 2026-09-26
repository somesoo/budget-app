import { CaretRight, ChartDonut, EyeSlash } from '@phosphor-icons/react'
import { useState } from 'react'
import { Screen } from '../components/Screen'
import { UserSwitcher } from '../components/UserSwitcher'
import { useAddCategory, useCategories, useUpdateCategory } from '../hooks/useCategories'
import { useGoal, useUpsertGoal } from '../hooks/useGoal'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { useRealtimeStatus } from '../hooks/useRealtimeSync'
import { useSavings } from '../hooks/useSavings'
import { Link } from 'react-router-dom'
import { CURRENCY_SUFFIX } from '../config'
import { supabase } from '../lib/supabaseClient'
import { formatMoney, roundMoney } from '../lib/calculations'
import type { Category } from '../types'

export function Settings() {
  const { person, setPerson } = useDeviceUser()
  const { data: categories = [] } = useCategories()
  const updateCategory = useUpdateCategory()
  const addCategory = useAddCategory()
  const [showHidden, setShowHidden] = useState(false)
  const active = categories.filter((c) => !c.archived)
  const hidden = categories.filter((c) => c.archived)
  const { data: goal, isLoading: goalLoading } = useGoal()
  const upsertGoal = useUpsertGoal()
  const status = useRealtimeStatus()
  const savingsReady = useSavings().data?.available ?? false

  return (
    <Screen title="Settings">
      <section className="mb-6 rounded-2xl bg-white/5 p-4">
        <p className="mb-3 text-sm text-muted">
          This phone is <span className="text-xs">(stored locally, not in the database)</span>
        </p>
        {person && <UserSwitcher value={person} onChange={setPerson} size="lg" />}
        <p className="mt-3 text-xs text-muted">
          Sync:{' '}
          <span className={status === 'live' ? 'text-positive' : 'text-amber-400'}>
            {status === 'live' ? 'live' : status === 'connecting' ? 'connecting…' : 'offline'}
          </span>
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-1 text-base font-semibold text-white">Categories and default limits</h2>
        <p className="mb-3 text-xs text-muted">
          A month you plan in the Budget tab uses its own limits; these apply to months without a
          plan.
        </p>
        <ul className="space-y-2">
          {active.map((category) => (
            <li key={category.id}>
              <CategoryRow
                category={category}
                onSave={(patch) => updateCategory.mutate({ id: category.id, ...patch })}
                onHide={() => updateCategory.mutate({ id: category.id, archived: true })}
                onToggleChart={() =>
                  updateCategory.mutate({ id: category.id, show_in_chart: !category.show_in_chart })
                }
              />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Default limits total: {formatMoney(active.reduce((acc, c) => acc + c.monthly_limit, 0))} /
          month
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted">
          <ChartIcon on /> in the “Where it goes” chart, <ChartIcon on={false} /> left out. Tap to
          leave out fixed costs like rent, which still count everywhere else.{' '}
          <EyeSlash aria-hidden className="text-sm" /> hides the category.
        </p>

        <NewCategory
          pending={addCategory.isPending}
          error={addCategory.error ? (addCategory.error as Error).message : null}
          onAdd={(c, done) => addCategory.mutate(c, { onSuccess: done })}
        />

        {hidden.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              aria-expanded={showHidden}
              className="text-sm font-medium text-muted active:text-white"
            >
              {showHidden ? 'Hide' : 'Show'} hidden categories ({hidden.length})
            </button>
            {showHidden && (
              <ul className="mt-2 space-y-2">
                {hidden.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-2.5"
                  >
                    <span
                      aria-hidden
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="flex-1 text-[15px] text-muted">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => updateCategory.mutate({ id: c.id, archived: false })}
                      className="rounded-xl px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 active:bg-white/10"
                    >
                      Show again
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">
              Hidden categories are gone from the Add screen and planning; their old expenses keep
              them.
            </p>
          </div>
        )}
      </section>

      {savingsReady ? (
        <section className="mb-6">
          <h2 className="mb-2 text-base font-semibold text-white">Savings goals</h2>
          <Link
            to="/savings"
            className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/10 hover:bg-white/10"
          >
            Goals and accounts are in the Savings tab
            <CaretRight aria-hidden className="text-muted" />
          </Link>
        </section>
      ) : (
        <section className="mb-6">
          <h2 className="mb-3 text-base font-semibold text-white">Shared savings goal</h2>
          {/* keyed so the fields fill in once the goal has loaded — otherwise they'd
            keep the empty defaults and "Save goal" would write zeros over it */}
          {goalLoading ? (
            <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
          ) : (
            <GoalEditor
              key={goal?.id ?? 'new'}
              goal={goal ?? null}
              onSave={(next) => upsertGoal.mutate({ id: goal?.id, ...next })}
            />
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => void supabase.auth.signOut()}
        className="w-full rounded-2xl bg-white/5 py-3 text-sm font-semibold text-muted active:bg-white/10"
      >
        Sign out of this device
      </button>
    </Screen>
  )
}

interface RowProps {
  category: Category
  onSave: (patch: Partial<Category>) => void
  onHide: () => void
  onToggleChart: () => void
}

function CategoryRow({ category, onSave, onHide, onToggleChart }: RowProps) {
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)
  const [limit, setLimit] = useState(String(category.monthly_limit))

  const commitName = () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === category.name) {
      setName(category.name)
      return
    }
    onSave({ name: trimmed })
  }

  const commitLimit = () => {
    const parsed = roundMoney(Number.parseFloat(limit.replace(',', '.')) || 0)
    if (parsed < 0 || parsed === category.monthly_limit) {
      setLimit(String(category.monthly_limit))
      return
    }
    onSave({ monthly_limit: parsed })
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/5">
      <label className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/20">
        <span className="sr-only">Color for {category.name}</span>
        <span aria-hidden className="block h-full w-full" style={{ backgroundColor: color }} />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          onBlur={() => {
            if (color !== category.color) onSave({ color })
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        aria-label="Category name"
        className="min-w-0 flex-1 rounded-xl bg-transparent px-2 py-2 text-[15px] font-medium text-white outline-none focus:bg-white/5"
      />

      <div className="flex shrink-0 items-center gap-1 rounded-xl bg-white/5 px-2">
        <input
          value={limit}
          onChange={(e) => setLimit(e.target.value.replace(/[^\d.,]/g, ''))}
          onBlur={commitLimit}
          inputMode="decimal"
          aria-label={`Monthly limit for ${category.name}`}
          className="w-16 bg-transparent py-2 text-right text-[15px] tabular-nums text-white outline-none"
        />
        <span className="text-xs text-muted">{CURRENCY_SUFFIX}</span>
      </div>

      <button
        type="button"
        onClick={onToggleChart}
        aria-pressed={category.show_in_chart}
        aria-label={`Show ${category.name} in the spending chart`}
        title={category.show_in_chart ? 'In the chart' : 'Left out of the chart'}
        className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl active:bg-white/10"
      >
        <ChartIcon on={category.show_in_chart} />
      </button>

      <button
        type="button"
        onClick={onHide}
        aria-label={`Hide ${category.name}`}
        title="Hide"
        className="-mr-1 flex h-9 w-8 shrink-0 items-center justify-center rounded-xl text-muted active:bg-white/10"
      >
        <EyeSlash aria-hidden className="text-lg" />
      </button>
    </div>
  )
}

const NEW_CATEGORY_COLORS = [
  '#f59e0b',
  '#ef4444',
  '#84cc16',
  '#06b6d4',
  '#8b5cf6',
  '#f43f5e',
  '#10b981',
  '#eab308',
]

function NewCategory({
  pending,
  error,
  onAdd,
}: {
  pending: boolean
  error: string | null
  onAdd: (
    category: { name: string; color: string; monthly_limit: number },
    done: () => void,
  ) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [limit, setLimit] = useState('')
  const [color, setColor] = useState(NEW_CATEGORY_COLORS[0])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-2xl border border-dashed border-white/20 py-3 text-sm font-semibold text-muted active:bg-white/5"
      >
        + Add a category
      </button>
    )
  }

  const submit = () => {
    if (!name.trim()) return
    onAdd(
      {
        name: name.trim(),
        color,
        monthly_limit: roundMoney(Number.parseFloat(limit.replace(',', '.')) || 0),
      },
      () => {
        setName('')
        setLimit('')
        setOpen(false)
      },
    )
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, e.g. Gifts"
          aria-label="New category name"
          maxLength={40}
          autoFocus
          className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-white outline-none ring-1 ring-white/10 placeholder:text-muted/60"
        />
        <div className="flex w-28 shrink-0 items-center gap-1 rounded-xl bg-white/5 px-2 ring-1 ring-white/10">
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder="Limit"
            aria-label="Default monthly limit"
            className="w-full bg-transparent py-2 text-right tabular-nums text-white outline-none placeholder:text-muted/60"
          />
          <span className="text-xs text-muted">{CURRENCY_SUFFIX}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
        {NEW_CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            onClick={() => setColor(c)}
            className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-card' : ''}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      {error && <p className="text-sm text-red-300">Not added: {error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-semibold text-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || pending}
          className="flex-1 rounded-xl bg-slate-50 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
        >
          Add category
        </button>
      </div>
    </div>
  )
}

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
    <div className="space-y-3 rounded-2xl bg-white/5 p-4">
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

/** A filled donut when the category is in the chart; an outline, dimmed, when it's left out. */
function ChartIcon({ on }: { on: boolean }) {
  return (
    <ChartDonut
      aria-hidden
      weight={on ? 'fill' : 'regular'}
      className={`text-lg ${on ? 'text-accent-soft' : 'text-white/30'}`}
    />
  )
}
