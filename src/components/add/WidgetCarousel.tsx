import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CHART } from '../charts/theme'
import { t } from '../../i18n'

export interface Widget {
  id: string
  /** Not shown, only read out: the cards speak for themselves. */
  label: string
  /** Something needs a look (warnings): its dot is coloured. */
  badge?: number
  content: ReactNode
}

const STORAGE_KEY = 'add-widget'

/**
 * One height for every card, the donut's: the panel doesn't grow to the
 * tallest card (the forecast, a long list of goals) and leaves the room to the
 * category tiles. A taller card scrolls inside it.
 */
const CARD_HEIGHT = 200

const FADE = {
  maskImage: 'linear-gradient(to bottom, #000 calc(100% - 16px), transparent)',
  WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 16px), transparent)',
}

function remembered(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Small cards above the category tiles, one at a time: swipe left and right
 * (native scroll-snap), dots underneath. Remembers the last one on this phone.
 */
export function WidgetCarousel({ widgets }: { widgets: Widget[] }) {
  const track = useRef<HTMLDivElement>(null)
  const [picked, setActive] = useState(() =>
    Math.max(
      widgets.findIndex((w) => w.id === remembered()),
      0,
    ),
  )

  // which cards don't fit the panel, measured as they render (text size, data)
  const [tall, setTall] = useState<string[]>([])
  useEffect(() => {
    const el = track.current
    if (!el) return
    const measure = () => {
      const slides = [...el.querySelectorAll<HTMLElement>('[data-widget-slide]')]
      const next = slides
        .map((slide, i) => (slide.scrollHeight > slide.clientHeight + 1 ? widgets[i]?.id : null))
        .filter((id): id is string => !!id)
      setTall((prev) => (prev.join() === next.join() ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    for (const slide of el.querySelectorAll('[data-widget-slide] > *')) observer.observe(slide)
    return () => observer.disconnect()
  }, [widgets])

  // one switched off in Settings can leave the index past the end
  const active = Math.min(picked, widgets.length - 1)

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
      className="rounded-3xl pb-1 pt-3 ring-1 ring-white/10"
      style={{ backgroundColor: CHART.surface }}
    >
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget
          if (!el.clientWidth) return
          const index = Math.round(el.scrollLeft / el.clientWidth)
          if (index !== active) settle(index)
        }}
        className="no-scrollbar grid snap-x snap-mandatory auto-cols-[100%] grid-flow-col overflow-x-auto overscroll-x-contain"
        style={{ height: CARD_HEIGHT }}
      >
        {widgets.map((w, i) => (
          <div
            key={w.id}
            role="group"
            aria-roledescription="slide"
            aria-label={t('add.widgetSlide', { label: w.label, n: i + 1, total: widgets.length })}
            aria-hidden={i !== active}
            data-widget-slide
            className="no-scrollbar min-w-0 snap-start snap-always overflow-y-auto overscroll-y-contain px-4"
            // a card taller than the panel fades out at the bottom: there's more below
            style={tall.includes(w.id) ? FADE : undefined}
          >
            {w.content}
          </div>
        ))}
      </div>
      {widgets.length > 1 && (
        <div className="flex justify-center">
          {widgets.map((w, i) => (
            <button
              key={w.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={w.label}
              aria-current={i === active}
              className="flex h-6 w-5 items-center justify-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  i === active ? 'w-4' : 'w-1.5'
                }`}
                style={{
                  backgroundColor: w.badge
                    ? CHART.warning
                    : i === active
                      ? '#f8fafc'
                      : 'rgba(255,255,255,0.3)',
                }}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
