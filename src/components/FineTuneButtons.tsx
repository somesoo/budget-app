import { FINE_TUNE_STEPS } from '../config'

interface Props {
  onAdjust: (delta: number) => void
}

/** Nudge the amount up or down once it is set. */
export function FineTuneButtons({ onAdjust }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {FINE_TUNE_STEPS.map((step) => (
        <button
          key={step}
          type="button"
          onClick={() => onAdjust(step)}
          className="h-14 rounded-2xl bg-white/5 text-lg font-semibold tabular-nums text-slate-100 ring-1 ring-white/10 transition active:scale-95 active:bg-white/15"
        >
          {step > 0 ? `+${step}` : step}
        </button>
      ))}
    </div>
  )
}
