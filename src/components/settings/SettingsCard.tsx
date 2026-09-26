import type { ReactNode } from 'react'

/** One group of settings: a title, what it's for in a line, and its rows. */
export function SettingsCard({
  title,
  help,
  action,
  children,
}: {
  title: string
  help?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      className="rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10 lg:p-5"
      aria-label={title}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {help && <p className="mt-0.5 text-xs leading-snug text-muted">{help}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** A small text button for a card's corner ("New", "Edit"). */
export function CardAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-accent-soft hover:bg-accent/10"
    >
      {children}
    </button>
  )
}
