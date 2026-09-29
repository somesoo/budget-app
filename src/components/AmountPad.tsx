import { ArrowLeft } from '@phosphor-icons/react'
import { AmountField } from './entry/AmountField'
import { LimitPreview } from './entry/LimitPreview'
import { useAmountEntry } from './entry/useAmountEntry'
import { QuickAmountButtons } from './QuickAmountButtons'
import { DateChip, PersonToggle } from './HeaderControls'
import { useState } from 'react'
import { currentMonthKey, monthKeyOfDate, readableTextColor, todayKey } from '../lib/calculations'
import type { Category, Person } from '../types'
import { t } from '../i18n'

interface Props {
  category: Category
  /** Already spent in the category this month (for a project: in all), for the preview. */
  spent: number
  person: Person
  onPersonChange: (person: Person) => void
  onCancel: () => void
  onSave: (input: { amount: number; person: Person; note: string | null; date: string }) => void
  saving: boolean
}

/**
 * Amount screen: quick amounts (they add up) or a typed amount, then save.
 * The date defaults to today and the person comes from this phone's cache, so
 * the common case is still three taps; both sit in the header, one tap away.
 * The title goes above the amount, where the number keyboard can't cover it.
 */
export function AmountPad({
  category,
  spent,
  person,
  onPersonChange,
  onCancel,
  onSave,
  saving,
}: Props) {
  const entry = useAmountEntry()
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayKey())
  const { amount } = entry
  const canSave = amount > 0 && !saving

  return (
    // full-screen overlay — covers the bottom navigation too
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col overflow-y-auto bg-ink">
      <header className="flex items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button
          type="button"
          onClick={onCancel}
          className="-ml-2 shrink-0 rounded-full px-2 py-2 text-2xl leading-none text-muted active:bg-white/10"
          aria-label={t('entry.backToCategories')}
        >
          <ArrowLeft />
        </button>
        <span className="min-w-0 flex-1">
          <span
            className="inline-block max-w-full truncate rounded-full px-3 py-1.5 align-middle text-sm font-semibold"
            style={{ backgroundColor: category.color, color: readableTextColor(category.color) }}
          >
            {category.name}
          </span>
        </span>
        <PersonToggle value={person} onChange={onPersonChange} />
        <DateChip value={date} onChange={setDate} />
      </header>

      <div className="flex-1 space-y-5 px-4 pb-6">
        {/* above the amount: the number keyboard would otherwise cover it */}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('entry.titlePlaceholder')}
          aria-label={t('entry.title')}
          maxLength={120}
          className="w-full rounded-2xl bg-white/5 px-4 py-3.5 text-base text-white outline-none ring-1 ring-white/10 placeholder:text-muted focus:ring-white/30"
        />

        <AmountField value={entry.text} onChange={entry.type} label={t('entry.amount')} />

        <QuickAmountButtons onAdd={entry.add} onClear={entry.reset} amount={amount} />

        {/* only this month's spending is on screen to compare with */}
        {category.kind === 'project' ? (
          <LimitPreview category={category} spent={spent} amount={amount} project />
        ) : (
          monthKeyOfDate(date) === currentMonthKey() && (
            <LimitPreview category={category} spent={spent} amount={amount} />
          )
        )}
      </div>

      <div className="sticky bottom-0 border-t border-white/10 bg-ink/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSave({ amount, person, note: note.trim() ? note.trim() : null, date })}
          className="h-16 w-full rounded-3xl text-xl font-bold transition active:scale-[0.99] disabled:opacity-40"
          style={{ backgroundColor: category.color, color: readableTextColor(category.color) }}
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  )
}
