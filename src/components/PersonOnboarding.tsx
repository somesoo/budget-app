import { type Person } from '../types'
import { personIds, personLabel } from '../lib/people'

interface Props {
  onPick: (person: Person) => void
}

/**
 * First launch on a given phone: "Who's using this phone?".
 * The answer is stored in this device's localStorage, never in the database.
 */
export function PersonOnboarding({ onPick }: Props) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Who's using this phone?</h1>
        <p className="mt-2 text-sm text-muted">
          We'll remember it on this device. You can change it any time with one tap.
        </p>
      </div>
      <div className="grid gap-3">
        {personIds().map((person) => (
          <button
            key={person}
            type="button"
            onClick={() => onPick(person)}
            className="h-20 rounded-3xl bg-slate-50 text-2xl font-bold text-ink transition active:scale-[0.98]"
          >
            {personLabel(person)}
          </button>
        ))}
      </div>
    </div>
  )
}
