import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** How long to wait for the element: the screen may still be loading its data. */
const WAIT_MS = 4000
const FLASH_MS = 2600

/** Navigations already handled, so going back to one doesn't flash again. */
const handled = new Set<string>()

/**
 * After the guide's "Show me": scrolls to the element the step is about (by
 * its data-tour name, passed in the navigation state) and makes it pulse for
 * a moment.
 */
export function GuideHighlight() {
  const location = useLocation()
  const target = (location.state as { highlight?: string } | null)?.highlight

  useEffect(() => {
    if (!target || handled.has(location.key)) return
    handled.add(location.key)
    const started = Date.now()
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`)
      if (!el) {
        if (Date.now() - started < WAIT_MS) window.setTimeout(find, 150)
        return
      }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add('guide-flash')
      window.setTimeout(() => el.classList.remove('guide-flash'), FLASH_MS)
    }
    window.setTimeout(find, 100)
  }, [location.key, target])

  return null
}
