import type { ReactNode } from 'react'

interface Props {
  title: string
  action?: ReactNode
  /**
   * Exactly one screen tall, never scrolling: the content becomes a flex
   * column and whichever child is `flex-1` takes what's left above the nav.
   */
  fill?: boolean
  /** On a laptop, use the width for columns instead of a phone-wide strip. */
  wide?: boolean
  children: ReactNode
}

/** Shared tab layout: header plus scrollable content above the bottom nav (beside the side nav on a laptop). */
export function Screen({ title, action, fill = false, wide = false, children }: Props) {
  const width = wide ? 'max-w-md lg:max-w-6xl lg:px-8' : 'max-w-md lg:max-w-2xl lg:px-8'
  const header = (
    <header className="mb-4 flex shrink-0 items-center justify-between gap-3 lg:mb-6">
      <h1 className="truncate text-2xl font-bold text-white lg:text-3xl lg:tracking-tight">{title}</h1>
      {action}
    </header>
  )

  if (fill) {
    return (
      // the bottom padding is the nav's height (see BottomNav) plus a little air
      <div
        className={`mx-auto flex h-[100dvh] flex-col overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+4rem)] pt-[calc(env(safe-area-inset-top)+1rem)] lg:pb-6 lg:pt-8 ${width}`}
      >
        {header}
        {children}
      </div>
    )
  }

  return (
    <div
      className={`mx-auto min-h-[100dvh] px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)] lg:pb-12 lg:pt-8 ${width}`}
    >
      {header}
      {children}
    </div>
  )
}
