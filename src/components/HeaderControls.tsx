import { ArrowsLeftRight, CalendarBlank } from '@phosphor-icons/react'
import { formatDayShort, todayKey, yesterdayKey } from '../lib/calculations'
import { type Person } from '../types'
import { personIds, personLabel } from '../lib/people'

const pillBase =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1'
const pill = `${pillBase} bg-white/5 text-white ring-white/10 active:bg-white/10`
/** Highlighted when the value differs from the default, so a backdated entry is obvious. */
const pillActive = `${pillBase} bg-slate-50 text-ink ring-white`

/**
 * Who paid, as a single pill: each tap moves to the next person, so it fits
 * in a header where a switcher with everyone wouldn't.
 */
export function PersonToggle({
  value,
  onChange,
}: {
  value: Person
  onChange: (person: Person) => void
}) {
  const people = personIds()
  // nobody to switch to
  if (people.length < 2) return null
  const next = people[(people.indexOf(value) + 1) % people.length]
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={`Paid by ${personLabel(value)}. Tap for ${personLabel(next)}`}
      className={pill}
    >
      <span aria-hidden className="text-muted">
        <ArrowsLeftRight />
      </span>
      {personLabel(value)}
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
