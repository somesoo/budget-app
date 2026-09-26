import { ArrowsLeftRight, CalendarBlank } from '@phosphor-icons/react'
import { PERSON_LABELS } from '../config'
import { formatDayShort, todayKey, yesterdayKey } from '../lib/calculations'
import { PERSONS, type Person } from '../types'

const pillBase =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1'
const pill = `${pillBase} bg-white/5 text-white ring-white/10 active:bg-white/10`
/** Highlighted when the value differs from the default, so a backdated entry is obvious. */
const pillActive = `${pillBase} bg-slate-50 text-ink ring-white`

/**
 * Who paid, as a single pill: with two people one tap flips it, so it fits in
 * a header where a two-segment switcher wouldn't.
 */
export function PersonToggle({
  value,
  onChange,
}: {
  value: Person
  onChange: (person: Person) => void
}) {
  const next = PERSONS[(PERSONS.indexOf(value) + 1) % PERSONS.length]
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={`Paid by ${PERSON_LABELS[value]}. Tap for ${PERSON_LABELS[next]}`}
      className={pill}
    >
      <span aria-hidden className="text-muted">
        <ArrowsLeftRight />
      </span>
      {PERSON_LABELS[value]}
    </button>
  )
}

/** The expense date as a pill; tapping opens the phone's own date picker. */
export function DateChip({
  value,
  onChange,
}: {
  value: string
  onChange: (dateKey: string) => void
}) {
  const today = todayKey()
  const label = value === today ? 'Today' : value === yesterdayKey() ? 'Yest.' : formatDayShort(value)
  const changed = value !== today

  return (
    <label className={`relative cursor-pointer ${changed ? pillActive : pill}`}>
      <CalendarBlank aria-hidden className="text-[1.1em]" />
      <span>{label}</span>
      <input
        type="date"
        value={value}
        max={today}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label="Expense date"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )
}
