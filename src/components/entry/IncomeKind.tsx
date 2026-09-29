import { t } from '../../i18n'

/**
 * Pay or one-off: pay repeats, so the planner and the forecast count on it;
 * a one-off (a returned deposit, something sold) is only this month's.
 */
export function IncomeKind({
  oneOff,
  onChange,
}: {
  oneOff: boolean
  onChange: (oneOff: boolean) => void
}) {
  return (
    <div className="inline-flex rounded-full bg-white/5 p-1 ring-1 ring-white/10">
      {([false, true] as const).map((value) => (
        <button
          key={String(value)}
          type="button"
          aria-pressed={oneOff === value}
          onClick={() => onChange(value)}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
            oneOff === value ? 'bg-slate-50 text-ink' : 'text-muted'
          }`}
        >
          {value ? t('entry.oneOff') : t('entry.pay')}
        </button>
      ))}
    </div>
  )
}

export const oneOffHelp = () => t('entry.oneOffHelp')
