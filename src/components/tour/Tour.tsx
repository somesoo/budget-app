import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TOUR_STEPS, tourStore } from '../../lib/tour'

/** Room around the element the spotlight picks out. */
const PAD = 8
/** How long a step waits for its element to render before showing without it. */
const WAIT_MS = 1500

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/** The first match that is actually on screen: the bottom bar and the side nav both have the tabs. */
function findTarget(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

/**
 * The guided tour, over whatever screen it's on: dims the page, cuts a hole
 * around the step's element, and explains it in a card. Next, Back, and Skip
 * everywhere; the arrow keys and Escape work too.
 */
export function Tour() {
  const { step, from } = useSyncExternalStore(tourStore.subscribe, tourStore.get, tourStore.get)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [box, setBox] = useState<Box | null>(null)
  const [ready, setReady] = useState(false)
  const target = useRef<HTMLElement | null>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const current = step === null ? null : TOUR_STEPS[step]
  const last = step === TOUR_STEPS.length - 1

  const finish = () => {
    tourStore.end()
    navigate(from)
  }

  // open the step's screen
  useEffect(() => {
    if (current && pathname !== current.route) navigate(current.route)
  }, [current, pathname, navigate])

  // find its element once the screen has rendered it (data may still be loading)
  useEffect(() => {
    setReady(false)
    setBox(null)
    target.current = null
    if (!current || pathname !== current.route) return
    if (!current.target) {
      window.scrollTo({ top: 0 })
      setReady(true)
      return
    }
    const selector = current.target
    const started = Date.now()
    const id = window.setInterval(() => {
      const el = findTarget(selector)
      if (el || Date.now() - started > WAIT_MS) {
        window.clearInterval(id)
        target.current = el
        if (el) {
          // near the top, so the card has the room below it
          const margin = el.style.scrollMarginTop
          el.style.scrollMarginTop = `calc(env(safe-area-inset-top) + ${PAD * 3}px)`
          el.scrollIntoView({ block: 'start' })
          el.style.scrollMarginTop = margin
        }
        setReady(true)
      }
    }, 80)
    return () => window.clearInterval(id)
  }, [current, pathname])

  // follow it as the page scrolls, resizes or finishes loading
  useLayoutEffect(() => {
    if (!ready) return
    const measure = () => {
      const el = target.current
      if (!el || !el.isConnected) return setBox(null)
      const r = el.getBoundingClientRect()
      setBox({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      })
    }
    measure()
    const id = window.setInterval(measure, 250)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [ready])

  // keyboard, and the focus on Next so Enter moves on
  useEffect(() => {
    if (step === null) return
    nextButton.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') last ? finish() : tourStore.go(step + 1)
      else if (e.key === 'ArrowLeft' && step > 0) tourStore.go(step - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, ready])

  if (!current || step === null) return null

  // the card goes wherever the spotlight isn't
  const viewport = window.innerHeight
  const below = box ? box.top + box.height / 2 < viewport / 2 : false
  const cardPlace = !box
    ? 'top-1/2 -translate-y-1/2'
    : below
      ? 'bottom-[calc(env(safe-area-inset-bottom)+1rem)]'
      : 'top-[calc(env(safe-area-inset-top)+1rem)]'
  // a section taller than the room beside the card: light up the part that fits
  let spot = box
  const card = cardRef.current?.getBoundingClientRect()
  if (box && card && card.height > 0) {
    if (below && box.top + box.height > card.top - PAD) {
      spot = { ...box, height: Math.max(card.top - PAD - box.top, 40) }
    } else if (!below && box.top < card.bottom + PAD) {
      const top = card.bottom + PAD
      spot = { ...box, top, height: Math.max(box.top + box.height - top, 40) }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      {/* the page stays visible but can't be tapped: the tour decides where to go */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {spot ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-2 ring-accent-soft transition-all duration-300"
          style={{ ...spot, boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.74)' }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-slate-950/75" />
      )}

      <div
        className={`absolute inset-x-4 mx-auto max-w-sm transition-opacity duration-200 lg:left-60 ${cardPlace} ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div ref={cardRef} className="rounded-3xl bg-slate-800 p-5 shadow-2xl ring-1 ring-white/15">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-soft">
              {step + 1} of {TOUR_STEPS.length}
            </p>
            {!last && (
              <button
                type="button"
                onClick={finish}
                className="-mr-2 rounded-full px-2 py-1 text-sm text-muted hover:bg-white/5 hover:text-white"
              >
                Skip tour
              </button>
            )}
          </div>
          <div aria-hidden className="mb-4 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-accent-soft transition-[width] duration-300"
              style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          <h2 id="tour-title" className="text-lg font-bold text-white">
            {current.title}
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-slate-200">{current.body}</p>
          {current.tip && (
            <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm leading-snug text-slate-300">
              {current.tip}
            </p>
          )}

          <div className="mt-5 flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => tourStore.go(step - 1)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
              >
                Back
              </button>
            )}
            <button
              ref={nextButton}
              type="button"
              onClick={() => (last ? finish() : tourStore.go(step + 1))}
              className="flex-1 rounded-xl bg-slate-50 py-3 text-sm font-bold text-ink hover:bg-white"
            >
              {step === 0 ? 'Show me around' : last ? 'Start using it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
