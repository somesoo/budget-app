import { useState, type FormEvent } from 'react'
import { useCategories } from '../../hooks/useCategories'
import { useDeleteRecurring, useSaveRecurring } from '../../hooks/useRecurring'
import { todayKey } from '../../lib/calculations'
import { getPeople } from '../../lib/people'
import type { RecurringCost } from '../../types'
import { MoneyInput } from '../budget/MoneyInput'
import { BottomSheet } from '../history/BottomSheet'
import { Field, Segments, Select, SubmitRow, inputClass } from '../savings/fields'
import { t } from '../../i18n'

const EVERY: RecurringCost['every_months'][] = [1, 2, 3, 6, 12]

export const everyLabel = (n: RecurringCost['every_months']) => t(`regular.every.${n}`)

/** A new subscription or bill, or editing one. */
export function RecurringSheet({
  cost,
  kind: startKind = 'subscription',
  onClose,
}: {
  cost?: RecurringCost
  kind?: RecurringCost['kind']
  onClose: () => void
}) {
  const save = useSaveRecurring()
  const remove = useDeleteRecurring()
  const { data: categories = [] } = useCategories()
  const [kind, setKind] = useState<RecurringCost['kind']>(cost?.kind ?? startKind)
  const [name, setName] = useState(cost?.name ?? '')
  const [amount, setAmount] = useState(cost?.amount ?? 0)
  const [every, setEvery] = useState<RecurringCost['every_months']>(
    cost?.every_months ?? (startKind === 'bill' ? 12 : 1),
  )
  const [due, setDue] = useState(cost?.due_on ?? todayKey())
  const [category, setCategory] = useState(cost?.category_id ?? '')
  const [owner, setOwner] = useState(cost?.owner ?? '')
  const [error, setError] = useState<string | null>(null)
  const monthly = categories.filter((c) => c.kind === 'monthly' && !c.archived)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await save.mutateAsync({
        id: cost?.id,
        name: name.trim(),
        kind,
        amount,
        every_months: every,
        due_on: due,
        category_id: category || null,
        owner: owner || null,
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const cancel = async () => {
    if (!cost) return
    await save.mutateAsync({ ...cost, archived: !cost.archived })
    onClose()
  }

  return (
    <BottomSheet title={cost ? t('project.edit', { name: cost.name }) : t('regular.new')} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 pb-2">
        <Segments
          value={kind}
          onChange={setKind}
          options={[
            { value: 'subscription', label: t('regular.subscription') },
            { value: 'bill', label: t('regular.bill') },
          ]}
        />
        <Field label={t('settings.categories.name')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder={kind === 'subscription' ? t('regular.subPlaceholder') : t('regular.billPlaceholder')}
            className={inputClass}
            autoFocus={!cost}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('regular.amount')}>
            <MoneyInput value={amount} onChange={setAmount} label={t('regular.amount')} size="lg" />
          </Field>
          <Field label={t('regular.how')}>
            <Select value={String(every)} onChange={(v) => setEvery(Number(v) as RecurringCost['every_months'])}>
              {EVERY.map((n) => (
                <option key={n} value={n}>
                  {everyLabel(n)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t('regular.due')} help={t('regular.dueHelp')}>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value || todayKey())}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('regular.category')}>
            <Select value={category} onChange={setCategory}>
              <option value="">{t('regular.noCategory')}</option>
              {monthly.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('categorySheet.whose')}>
            <Select value={owner} onChange={setOwner}>
              <option value="">{t('account.joint')}</option>
              {getPeople().map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <SubmitRow
          label={cost ? t('entry.saveChanges') : t('regular.add')}
          disabled={!name.trim() || amount <= 0}
          pending={save.isPending}
          error={error}
        />
        {cost && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={cancel}
              className="rounded-2xl py-2.5 text-sm font-semibold text-muted ring-1 ring-white/10 hover:bg-white/5"
            >
              {cost.archived ? t('regular.restore') : t('regular.cancelIt')}
            </button>
            <button
              type="button"
              onClick={async () => {
                await remove.mutateAsync(cost.id)
                onClose()
              }}
              className="rounded-2xl py-2.5 text-sm font-semibold text-red-400 ring-1 ring-red-400/30 hover:bg-red-500/10"
            >
              {remove.isPending ? t('common.deleting') : t('common.delete')}
            </button>
          </div>
        )}
      </form>
    </BottomSheet>
  )
}
