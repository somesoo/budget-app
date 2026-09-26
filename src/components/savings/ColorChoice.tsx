import { Check } from '@phosphor-icons/react'

/** Colors for accounts and goals: tell them apart in lists, never the only cue. */
export const SAVINGS_COLORS = [
  '#3987e5',
  '#22c55e',
  '#14b8a6',
  '#eab308',
  '#f97316',
  '#ec4899',
  '#a855f7',
  '#64748b',
]

export function ColorChoice({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {SAVINGS_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className="flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-card transition"
          style={{
            backgroundColor: c,
            ['--tw-ring-color' as string]: value === c ? '#f8fafc' : 'transparent',
          }}
        >
          {value === c && <Check weight="bold" className="text-ink" />}
        </button>
      ))}
    </div>
  )
}
