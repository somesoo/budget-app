import { formatDayShort, todayKey, yesterdayKey } from '../lib/calculations'

interface Props {
  value: string
  onChange: (dateKey: string) => void
}

/**
 * Date for the expense being added. Today is preselected, so the fast path
 * stays three taps; the chips cover "I forgot to log yesterday's coffee" and
 * the picker covers everything older.
 */
export function DatePicker({ value, onChange }: Props) {
  const today = todayKey()
  const yesterday = yesterdayKey()
  const isOther = value !== today && value !== yesterday

  const chip = (active: boolean) =>
    `rounded-full px-3 py-2 text-sm font-semibold transition ${
      active ? 'bg-white text-ink shadow' : 'text-muted active:bg-white/10'
    }`

  return (
    <div className="inline-flex items-center rounded-full bg-white/5 p-1 ring-1 ring-white/10">
      <button type="button" onClick={() => onChange(today)} className={chip(value === today)}>
        Today
      </button>
      <button
        type="button"
        onClick={() => onChange(yesterday)}
        className={chip(value === yesterday)}
      >
        Yest.
      </button>

      <label className={`relative cursor-pointer ${chip(isOther)}`}>
        <span className="sr-only">Pick a date</span>
        <span aria-hidden>{isOther ? formatDayShort(value) : '📅'}</span>
        <input
          type="date"
          value={value}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}
