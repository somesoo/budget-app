import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CHART } from '../charts/theme'

export interface Widget {
  id: string
  label: string
  /** A count next to the label, like the number of warnings. */
  badge?: number
  content: ReactNode
}

const STORAGE_KEY = 'add-widget'

function remembered(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Small cards above the category tiles, one at a time: swipe left and right
 * (native scroll-snap), or tap a label. Remembers the last one on this phone.
 */
export function WidgetCarousel({ widgets }: { widgets: Widget[] }) {
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(() =>
    Math.max(
      widgets.findIndex((w) => w.id === remembered()),
      0,
    ),
  )

  // start on the remembered card without animating there
  useEffect(() => {
    const el = track.current
    if (el) el.scrollLeft = active * el.clientWidth
    // only on mount: afterwards the scroll position drives `active`
  }, [])

  const settle = (index: number) => {
    setActive(index)
    try {
      localStorage.setItem(STORAGE_KEY, widgets[index]?.id ?? '')
    } catch {
      // private mode: it just won't be remembered
    }
  }

  const goTo = (index: number) => {
    const el = track.current
    el?.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
    settle(index)
  }

  return (
    <section
      className="rounded-3xl pb-3 pt-3 ring-1 ring-white/10"
      style={{ backgroundColor: CHART.surface }}
    >
      <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto px-3">
        {widgets.map((w, i) => (
          <button
            key={w.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => goTo(i)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition ${
              i === active ? 'bg-white/10 text-white' : 'text-muted hover:text-white'
            }`}
          >
            {w.label}
            {!!w.badge && (
              <span
                className="min-w-[1.125rem] rounded-full px-1 text-center text-[11px] font-bold leading-[1.125rem] text-ink"
                style={{ backgroundColor: CHART.warning }}
              >
                {w.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget
          if (!el.clientWidth) return
          const index = Math.round(el.scrollLeft / el.clientWidth)
          if (index !== active) settle(index)
        }}
        className="no-scrollbar mt-3 grid snap-x snap-mandatory auto-cols-[100%] grid-flow-col overflow-x-auto overscroll-x-contain"
      >
        {widgets.map((w, i) => (
          <div
            key={w.id}
            role="tabpanel"
            aria-label={w.label}
            aria-hidden={i !== active}
            className="min-w-0 snap-start snap-always px-4"
          >
            {w.content}
          </div>
        ))}
      </div>
    </section>
  )
}
