import { useSyncExternalStore } from 'react'

/**
 * Whether a media query matches, kept in sync as the window resizes. For the
 * few screens that are a different component on a laptop, not just a
 * different layout of the same one.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Tailwind's `lg`: the laptop layouts. */
export const LAPTOP = '(min-width: 1024px)'
