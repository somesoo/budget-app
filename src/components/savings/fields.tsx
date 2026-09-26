import type { ReactNode } from 'react'

/** Label above, the control, optional help below: the form pattern of the savings sheets. */
export function Field({
  label,
  help,
  children,
}: {
  label: string
  help?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
      {help && <span className="text-xs leading-snug text-muted">{help}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl bg-white/5 px-3 py-2.5 text-[15px] text-white outline-none ring-1 ring-white/10 placeholder:text-muted focus:ring-white/40'

export function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} appearance-none bg-[length:12px] bg-[right_0.9rem_center] bg-no-repeat pr-9`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%2394a3b8' stroke-width='1.6'/%3E%3C/svg%3E\")",
      }}
    >
      {children}
    </select>
  )
}

/** Segmented choice between a few options. */
export function Segments<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col rounded-full bg-white/5 p-1 ring-1 ring-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
            value === o.value ? 'bg-slate-50 text-ink' : 'text-muted hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SubmitRow({
  label,
  disabled,
  pending,
  error,
}: {
  label: string
  disabled: boolean
  pending: boolean
  error: string | null
}) {
  return (
    <div className="grid gap-2 pt-1">
      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={disabled || pending}
        className="h-12 rounded-2xl bg-slate-100 text-base font-bold text-ink transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-40"
      >
        {pending ? 'Saving…' : label}
      </button>
    </div>
  )
}
