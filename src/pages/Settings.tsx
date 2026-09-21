import { useState } from 'react'
import { Screen } from '../components/Screen'
import { UserSwitcher } from '../components/UserSwitcher'
import { useCategories, useUpdateCategory } from '../hooks/useCategories'
import { useGoal, useUpsertGoal } from '../hooks/useGoal'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { useRealtimeStatus } from '../hooks/useRealtimeSync'
import { CURRENCY_SUFFIX } from '../config'
import { formatMoney, roundMoney } from '../lib/calculations'
import type { Category } from '../types'

export function Settings() {
  const { person, setPerson } = useDeviceUser()
  const { data: categories = [] } = useCategories()
  const updateCategory = useUpdateCategory()
  const { data: goal } = useGoal()
  const upsertGoal = useUpsertGoal()
  const status = useRealtimeStatus()

  return (
    <Screen title="Settings">
      <section className="mb-6 rounded-2xl bg-white/5 p-4">
        <p className="mb-3 text-sm text-muted">
          This phone is <span className="text-xs">(stored locally, not in the database)</span>
        </p>
        {person && <UserSwitcher value={person} onChange={setPerson} size="lg" />}
        <p className="mt-3 text-xs text-muted">
          Sync:{' '}
          <span className={status === 'live' ? 'text-emerald-400' : 'text-amber-400'}>
            {status === 'live' ? 'live' : status === 'connecting' ? 'connecting…' : 'offline'}
          </span>
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Categories and limits
        </h2>
        <ul className="space-y-2">
          {categories.map((category) => (
            <li key={category.id}>
              <CategoryRow
                category={category}
                onSave={(patch) => updateCategory.mutate({ id: category.id, ...patch })}
              />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Limits total: {formatMoney(categories.reduce((acc, c) => acc + c.monthly_limit, 0))} /
          month
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Shared savings goal
        </h2>
        <GoalEditor
          goal={goal ?? null}
          onSave={(next) => upsertGoal.mutate({ id: goal?.id, ...next })}
        />
      </section>
    </Screen>
  )
}

interface RowProps {
  category: Category
  onSave: (patch: Partial<Category>) => void
}

function CategoryRow({ category, onSave }: RowProps) {
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
          className="h-full rounded-full bg-emerald-400 transition-[width] duration-500"
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
        className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-ink"
      >
        {goal ? 'Save goal' : 'Create goal'}
      </button>
    </div>
  )
}
