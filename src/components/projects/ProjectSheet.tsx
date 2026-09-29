import { useState, type FormEvent } from 'react'
import { useAddCategory, useUpdateCategory } from '../../hooks/useCategories'
import { useGoals } from '../../hooks/useGoal'
import { roundMoney } from '../../lib/calculations'
import type { Category } from '../../types'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { ColorChoice } from '../savings/ColorChoice'
import { Field, Select, SubmitRow, inputClass } from '../savings/fields'
import { t } from '../../i18n'

/**
 * A trip or other project: a category with a budget for the whole of it and,
 * optionally, dates and the savings goal that pays for it.
 */
export function ProjectSheet({ project, onClose }: { project?: Category; onClose: () => void }) {
  const add = useAddCategory()
  const update = useUpdateCategory()
  const { data: goals = [] } = useGoals()
  const [name, setName] = useState(project?.name ?? '')
  const [budget, setBudget] = useState(project?.budget_total ?? 0)
  const [starts, setStarts] = useState(project?.starts_on ?? '')
  const [ends, setEnds] = useState(project?.ends_on ?? '')
  const [goal, setGoal] = useState(project?.goal_id ?? '')
  const [color, setColor] = useState(project?.color ?? '#ec4899')
  const [error, setError] = useState<string | null>(null)

  const datesOk = !starts || !ends || starts <= ends

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const fields = {
      name: name.trim(),
      color,
      budget_total: budget > 0 ? roundMoney(budget) : null,
      starts_on: starts || null,
      ends_on: ends || null,
      goal_id: goal || null,
    }
    try {
      if (project) await update.mutateAsync({ id: project.id, ...fields })
      else await add.mutateAsync({ ...fields, kind: 'project', monthly_limit: 0 })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const finish = async () => {
    if (!project) return
    await update.mutateAsync({ id: project.id, archived: !project.archived })
    onClose()
  }

  return (
    <BottomSheet
      title={project ? t('project.edit', { name: project.name }) : t('project.new')}
      onClose={onClose}
    >
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <Field label={t('settings.categories.name')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder={t('project.namePlaceholder')}
            className={inputClass}
            autoFocus={!project}
          />
        </Field>
        <Field label={t('project.budgetLabel')}>
          <MoneyInput value={budget} onChange={setBudget} label={t('project.budget')} size="lg" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('project.from')}>
            <input
              type="date"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </Field>
          <Field label={t('project.until')} help={datesOk ? undefined : t('project.badDates')}>
            <input
              type="date"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </Field>
        </div>
        <Field
          label={t('project.goal')}
          help={t('project.goalHelp')}
        >
          <Select value={goal} onChange={setGoal}>
            <option value="">{t('category.none')}</option>
            {goals
              .filter((g) => !g.archived || g.id === goal)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label={t('common.color')}>
          <ColorChoice value={color} onChange={setColor} />
        </Field>
        <SubmitRow
          label={project ? t('entry.saveChanges') : t('common.add')}
          disabled={!name.trim() || !datesOk}
          pending={add.isPending || update.isPending}
          error={error}
        />
        {project && (
          <button
            type="button"
            onClick={finish}
            className="rounded-2xl py-2.5 text-sm font-semibold text-muted ring-1 ring-white/10 hover:bg-white/5"
          >
            {project.archived ? t('project.unarchive') : t('project.archive')}
          </button>
        )}
      </form>
    </BottomSheet>
  )
}
