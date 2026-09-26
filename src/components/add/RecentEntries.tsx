import { formatMoney } from '../../lib/calculations'
import { dayHeading, groupByDay, type Entry } from '../../lib/history'
import type { Category } from '../../types'
import { EntryRow } from '../history/EntryRow'

interface Props {
  entries: Entry[]
  categories: Record<string, Category>
  onOpen: (entry: Entry) => void
}

/** The last few things logged, so a slip shows up at once and is one click from fixing. */
export function RecentEntries({ entries, categories, onOpen }: Props) {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Nothing logged this month yet.</p>
  }
  return (
    <div className="space-y-3">
      {groupByDay(entries).map((group) => {
        const heading = dayHeading(group.date)
        return (
          <section key={group.date}>
            <header className="flex items-baseline justify-between px-1 pb-1">
              <h3 className="text-sm font-semibold text-white">
                {heading.title}
                {heading.subtitle && (
                  <span className="ml-1.5 font-normal text-muted">{heading.subtitle}</span>
                )}
              </h3>
              {group.spent > 0 && (
                <span className="text-xs tabular-nums text-muted">{formatMoney(group.spent)}</span>
              )}
            </header>
            <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/5">
              {group.entries.map((entry) => (
                <li key={`${entry.kind}-${entry.id}`}>
                  <EntryRow
                    entry={entry}
                    categories={categories}
                    onOpen={entry.id.startsWith('optimistic-') ? undefined : () => onOpen(entry)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
