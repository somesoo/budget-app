import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Tracks an element's content width so charts can lay out in real pixels
 * (label sizes, bar thickness) instead of scaling a fixed viewBox.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}
