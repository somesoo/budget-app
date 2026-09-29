import { type Person } from '../types'
import { personIds, personLabel } from '../lib/people'

interface Props {
  value: Person
  onChange: (person: Person) => void
  size?: 'sm' | 'lg'
  label?: string
}

/**
 * Who it is, one tap per person. Nothing to pick with one person in the
 * budget; with three or four the segments get tighter and scroll if the
 * names are long.
 */
export function UserSwitcher({ value, onChange, size = 'sm', label }: Props) {
  const people = personIds()
  if (people.length < 2) return null
  const many = people.length > 2
  const pad =
    size === 'lg'
      ? many
        ? 'px-4 py-3 text-base'
        : 'px-5 py-3 text-lg'
      : many
        ? 'px-3 py-2 text-sm'
        : 'px-4 py-2 text-sm'

  return (
    <div className="min-w-0 max-w-full">
      {label && <p className="mb-2 text-sm text-muted">{label}</p>}
      {/* two fit side by side in one pill; more wrap as separate chips */}
      <div
        className={
          many
            ? 'flex flex-wrap gap-1.5'
            : 'inline-flex max-w-full rounded-full bg-white/5 p-1 ring-1 ring-white/10'
        }
      >
        {people.map((person) => {
          const active = person === value
          return (
            <button
              key={person}
              type="button"
              onClick={() => onChange(person)}
              aria-pressed={active}
              className={`${pad} min-w-0 max-w-[10rem] truncate rounded-full font-semibold transition ${
                active
                  ? 'bg-slate-50 text-ink shadow'
                  : many
                    ? 'bg-white/5 text-slate-300 ring-1 ring-white/10 active:bg-white/10'
                    : 'text-muted active:bg-white/10'
              }`}
            >
              {personLabel(person)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
