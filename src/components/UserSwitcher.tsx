import { PERSON_LABELS } from '../config'
import { PERSONS, type Person } from '../types'

interface Props {
  value: Person
  onChange: (person: Person) => void
  size?: 'sm' | 'lg'
  label?: string
}

/** Bubs / Meow toggle — one tap switches the person. */
export function UserSwitcher({ value, onChange, size = 'sm', label }: Props) {
  const pad = size === 'lg' ? 'px-5 py-3 text-lg' : 'px-4 py-2 text-sm'

  return (
    <div>
      {label && <p className="mb-2 text-sm text-muted">{label}</p>}
      <div className="inline-flex rounded-full bg-white/5 p-1 ring-1 ring-white/10">
        {PERSONS.map((person) => {
          const active = person === value
          return (
            <button
              key={person}
              type="button"
              onClick={() => onChange(person)}
              aria-pressed={active}
              className={`${pad} rounded-full font-semibold transition ${
                active ? 'bg-slate-50 text-ink shadow' : 'text-muted active:bg-white/10'
              }`}
            >
              {PERSON_LABELS[person]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
