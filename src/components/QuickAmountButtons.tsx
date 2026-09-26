import { CURRENCY_SUFFIX } from '../config'
import { usePrefs } from '../hooks/usePrefs'

interface Props {
  /** Adds the tapped amount to what's there. */
  onAdd: (amount: number) => void
  onClear: () => void
  /** The amount so far; "Clear" shows once there's something to clear. */
  amount: number
}

/**
 * The four big quick amounts (set per device in Settings). They add up, so
 * 35 zł is 20 + 10 + 5 without typing; "Clear" starts over.
 */
export function QuickAmountButtons({ onAdd, onClear, amount }: Props) {
  const { quickAmounts } = usePrefs()
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {quickAmounts.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onAdd(value)}
            aria-label={`Add ${value} ${CURRENCY_SUFFIX}`}
            className="h-20 rounded-3xl bg-white/[0.06] text-3xl font-bold tabular-nums text-slate-100 ring-1 ring-white/10 transition active:scale-[0.96] active:bg-white/15"
          >
            +{value} <span className="text-xl font-semibold text-muted">{CURRENCY_SUFFIX}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex h-9 items-center justify-between px-1">
        <span className="text-xs text-muted">Tap again to add more</span>
        {amount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-300 ring-1 ring-white/15 active:bg-white/10"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
