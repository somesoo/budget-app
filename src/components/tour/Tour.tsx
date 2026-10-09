import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { tourSteps, tourStore } from '../../lib/tour'
import { usePrefs } from '../../hooks/usePrefs'
import { isOn } from '../../lib/features'
import { t } from '../../i18n'

/** Room around the element the spotlight picks out. */
const PAD = 8
/** How long a step waits for its element to render before showing without it. */
const WAIT_MS = 1500
/** The card fading out, and in again. */
const FADE_MS = 220
/** The spotlight gliding to the next element, or closing before another screen opens. */
const MOVE_MS = 520
/** The whole overlay fading in at the start and out at the end. */
const OPEN_MS = 320
/** Quick to start, gentle to land. */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DIM = '0 0 0 9999px rgba(2, 6, 23, 0.74)'

interface Box {
  top: number
  left: number
  width: number
  height: number
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/** A hole of no size in the middle of a box: the spotlight closed, the whole page dimmed. */
const pointOf = (b: Box): Box => ({ top: b.top + b.height / 2, left: b.left + b.width / 2, width: 0, height: 0 })
const screenMiddle = (): Box => pointOf({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight })
const sameBox = (a: Box, b: Box) =>
  Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5

/** The first match that is actually on screen: the bottom bar and the side nav both have the tabs. */
function findTarget(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

/** The element once the screen has rendered it (data may still be loading), or null if it doesn't in time. */
async function waitForTarget(selector: string, alive: () => boolean): Promise<HTMLElement | null> {
  const started = performance.now()
  while (alive()) {
    const el = findTarget(selector)
    if (el) return el
    if (performance.now() - started > WAIT_MS) return null
    await frame()
  }
  return null
}

/** Until the element stops moving: the smooth scroll to it is over, or wasn't needed. */
async function settle(el: HTMLElement, alive: () => boolean) {
  const started = performance.now()
  let lastTop = Number.NaN
  let still = 0
  while (alive() && performance.now() - started < 1200) {
    await frame()
    const top = el.getBoundingClientRect().top
    still = Math.abs(top - lastTop) < 0.5 ? still + 1 : 0
    lastTop = top
    if (still >= 5) return
  }
}

/** The spotlight around an element; a section taller than the room beside the card gets the part that fits. */
function spotFor(el: HTMLElement, card: DOMRect | null, cardBelow: boolean): Box {
  const r = el.getBoundingClientRect()
  const box = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
  if (!card || card.height === 0) return box
  if (cardBelow && box.top + box.height > card.top - PAD) {
    return { ...box, height: Math.max(card.top - PAD - box.top, 40) }
  }
  if (!cardBelow && box.top < card.bottom + PAD) {
    const top = card.bottom + PAD
    return { ...box, top, height: Math.max(box.top + box.height - top, 40) }
  }
  return box
}

/**
 * The guided tour, over whatever screen it's on: dims the page, cuts a hole
 * around the step's element, and explains it in a card. Next, Back, and Skip
 * everywhere; the arrow keys and Escape work too.
 *
 * Moving on is choreographed so nothing jumps: the card fades out, the
 * spotlight closes if another screen opens, the page scrolls smoothly to the
 * next element, then the spotlight glides onto it and the card fades back in,
 * already in its new place.
 */
export function Tour() {
  const { step, from } = useSyncExternalStore(tourStore.subscribe, tourStore.get, tourStore.get)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const prefs = usePrefs()
  // only what this phone shows (Settings → What the app shows)
  const TOUR_STEPS = useMemo(
    () => tourSteps((f) => isOn({ stage: prefs.stage, overrides: prefs.featureOverrides }, f)),
    [prefs.stage, prefs.featureOverrides],
  )

  /** The step the card is showing; it lags `step` while moving there. */
  const [shown, setShown] = useState<number | null>(null)
  /** Where the card sits: below the spotlight, above it, or (null) in the middle. */
  const [cardBelow, setCardBelow] = useState<boolean | null>(null)
  const [spot, setSpot] = useState<Box>(screenMiddle)
  const [ring, setRing] = useState(false)
  /** Spotlight moves animate while gliding; while following a scroll they don't, so it doesn't lag. */
  const [glide, setGlide] = useState(false)
  const [cardIn, setCardIn] = useState(false)
  const [open, setOpen] = useState(false)

  const pathRef = useRef(pathname)
  pathRef.current = pathname
  const shownRef = useRef<number | null>(null)
  shownRef.current = shown
  const closing = useRef(false)
  /** What the spotlight follows once it has landed. */
  const following = useRef<{ el: HTMLElement; selector: string; cardBelow: boolean } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextButton = useRef<HTMLButtonElement>(null)

  const calm = reducedMotion()
  const ms = (n: number) => (calm ? 0 : n)
  const cardBox = () => cardRef.current?.getBoundingClientRect() ?? null
  const last = step === TOUR_STEPS.length - 1

  const finish = async () => {
    if (closing.current) return
    closing.current = true
    following.current = null
    setCardIn(false)
    setRing(false)
    setGlide(true)
    setSpot((s) => pointOf(s))
    await wait(ms(FADE_MS))
    // back where it started while the page is still dimmed, then let it go
    navigate(from)
    await frame()
    setOpen(false)
    await wait(ms(OPEN_MS))
    tourStore.end()
  }

  // move to the step: out, (another screen), scroll, glide, in
  useEffect(() => {
    if (step === null) {
      closing.current = false
      following.current = null
      setShown(null)
      setCardBelow(null)
      setSpot(screenMiddle())
      setRing(false)
      setGlide(false)
      setCardIn(false)
      setOpen(false)
      return
    }
    let live = true
    const alive = () => live && !closing.current
    const next = TOUR_STEPS[step]

    void (async () => {
      following.current = null
      const otherScreen = pathRef.current !== next.route

      if (shownRef.current === null) {
        // starting: the overlay fades in over the page
        await frame()
        setOpen(true)
      } else {
        setCardIn(false)
        if (otherScreen || !next.target) {
          // close the spotlight so the screen changes under an even dim
          setGlide(true)
          setRing(false)
          setSpot((s) => pointOf(s))
          await wait(ms(MOVE_MS * 0.7))
        } else {
          await wait(ms(FADE_MS))
        }
      }
      if (!alive()) return

      if (otherScreen) {
        navigate(next.route)
        await frame()
        await frame()
      }

      let el: HTMLElement | null = null
      if (next.target) el = await waitForTarget(next.target, alive)
      if (!alive()) return
      if (el) {
        // near the top, so the card has the room below it
        const margin = el.style.scrollMarginTop
        el.style.scrollMarginTop = `calc(env(safe-area-inset-top) + ${PAD * 3}px)`
        el.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })
        el.style.scrollMarginTop = margin
        await settle(el, alive)
      } else {
        window.scrollTo({ top: 0, behavior: calm || otherScreen ? 'auto' : 'smooth' })
      }
      if (!alive()) return

      // the new card, still invisible, in its new place, so the spotlight can make room for it
      let below: boolean | null = null
      if (el) {
        const r = el.getBoundingClientRect()
        below = r.top + r.height / 2 < window.innerHeight / 2
      }
      setShown(step)
      setCardBelow(below)
      await frame()
      await frame()
      if (!alive()) return

      setGlide(true)
      if (el && below !== null) {
        setSpot(spotFor(el, cardBox(), below))
        setRing(true)
      } else {
        setSpot((s) => pointOf(s))
        setRing(false)
      }
      setCardIn(true)
      await wait(ms(MOVE_MS))
      if (!alive()) return
      setGlide(false)
      if (el && below !== null && next.target) following.current = { el, selector: next.target, cardBelow: below }
    })()

    return () => {
      live = false
    }
  }, [step])

  // follow the element as the page scrolls, resizes or finishes loading
  const running = step !== null
  useEffect(() => {
    if (!running) return
    let id = 0
    const follow = () => {
      const f = following.current
      if (f) {
        if (!f.el.isConnected) {
          // the screen re-rendered it
          const again = findTarget(f.selector)
          if (again) f.el = again
        }
        if (f.el.isConnected) {
          const next = spotFor(f.el, cardBox(), f.cardBelow)
          setSpot((prev) => (sameBox(prev, next) ? prev : next))
        }
      }
      id = requestAnimationFrame(follow)
    }
    id = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(id)
  }, [running])

  // keyboard, and the focus on Next so Enter moves on
  useEffect(() => {
    if (step === null) return
    if (cardIn) nextButton.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (closing.current) return
      if (e.key === 'Escape') void finish()
      else if (e.key === 'ArrowRight') last ? void finish() : tourStore.go(step + 1)
      else if (e.key === 'ArrowLeft' && step > 0) tourStore.go(step - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, cardIn])

  if (step === null) return null
  const content = shown === null ? null : TOUR_STEPS[shown]

  // the card goes wherever the spotlight isn't
  const cardPlace =
    cardBelow === null
      ? 'top-1/2 -translate-y-1/2'
      : cardBelow
        ? 'bottom-[calc(env(safe-area-inset-bottom)+1rem)]'
        : 'top-[calc(env(safe-area-inset-top)+1rem)]'
  const move = (prop: string) => `${prop} ${ms(MOVE_MS)}ms ${EASE}`

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      style={{ opacity: open ? 1 : 0, transition: `opacity ${ms(OPEN_MS)}ms ease` }}
    >
      {/* the page stays visible but can't be tapped: the tour decides where to go */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        aria-hidden
        className="pointer-events-none absolute rounded-2xl"
        style={{
          ...spot,
          boxShadow: DIM,
          transition: glide ? ['top', 'left', 'width', 'height'].map(move).join(', ') : 'none',
          willChange: 'top, left, width, height',
        }}
      >
        <div
          className="absolute inset-0 rounded-2xl ring-2 ring-accent-soft"
          style={{ opacity: ring ? 1 : 0, transition: `opacity ${ms(FADE_MS)}ms ease` }}
        />
      </div>

      {content && shown !== null && (
        <div ref={cardRef} className={`absolute inset-x-4 mx-auto max-w-sm lg:left-60 ${cardPlace}`}>
          <div
            className="rounded-3xl bg-slate-800 p-5 shadow-2xl ring-1 ring-white/15"
            style={{
              opacity: cardIn ? 1 : 0,
              transform: cardIn ? 'none' : 'translateY(10px) scale(0.98)',
              transition: `opacity ${ms(FADE_MS)}ms ease, transform ${ms(FADE_MS + 120)}ms ${EASE}`,
              // in: after the spotlight has set off; out: straight away
              transitionDelay: cardIn ? `${ms(MOVE_MS * 0.35)}ms` : '0ms',
              pointerEvents: cardIn ? 'auto' : 'none',
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-soft">
                {t('tour.ui.progress', { step: shown + 1, total: TOUR_STEPS.length })}
              </p>
              {shown !== TOUR_STEPS.length - 1 && (
                <button
                  type="button"
                  onClick={() => void finish()}
                  className="-mr-2 rounded-full px-2 py-1 text-sm text-muted hover:bg-white/5 hover:text-white"
                >
                  {t('tour.ui.skip')}
                </button>
              )}
            </div>
            <div aria-hidden className="mb-4 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent-soft"
                style={{
                  width: `${((step + 1) / TOUR_STEPS.length) * 100}%`,
                  transition: `width ${ms(MOVE_MS)}ms ${EASE}`,
                }}
              />
            </div>

            <h2 id="tour-title" className="text-lg font-bold text-white">
              {t(content.title)}
            </h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-200">{t(content.body)}</p>
            {content.tip && (
              <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm leading-snug text-slate-300">
                {t(content.tip)}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              {shown > 0 && (
                <button
                  type="button"
                  onClick={() => tourStore.go(step - 1)}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
                >
                  {t('common.back')}
                </button>
              )}
              <button
                ref={nextButton}
                type="button"
                onClick={() => (last ? void finish() : tourStore.go(step + 1))}
                className="flex-1 rounded-xl bg-slate-50 py-3 text-sm font-bold text-ink hover:bg-white"
              >
                {shown === 0
                  ? t('tour.ui.start')
                  : shown === TOUR_STEPS.length - 1
                    ? t('tour.ui.finish')
                    : t('common.next')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
