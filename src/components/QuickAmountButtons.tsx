import { CURRENCY_SUFFIX } from '../config'
import { usePrefs } from '../hooks/usePrefs'
import { readableTextColor } from '../lib/calculations'

interface Props {
  onPick: (amount: number) => void
  selected: number | null
  accent: string
}

/** The four big one-tap amounts (set per device in Settings). */
export function QuickAmountButtons({ onPick, selected, accent }: Props) {
  const { quickAmounts } = usePrefs()
  return (
    <div className="grid grid-cols-2 gap-3">
      {quickAmounts.map((amount) => {
        const active = selected === amount
        return (
          <button
            key={amount}
            type="button"
            onClick={() => onPick(amount)}
            className="h-24 rounded-3xl text-3xl font-bold tabular-nums ring-1 ring-white/10 transition active:scale-[0.97]"
            style={
              active
                ? { backgroundColor: accent, color: readableTextColor(accent) }
                : { backgroundColor: 'rgba(255,255,255,0.06)', color: '#e2e8f0' }
            }
          >
            {amount} {CURRENCY_SUFFIX}
          </button>
        )
      })}
    </div>
  )
}
