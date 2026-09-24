import type { ReactNode } from 'react'

interface Props {
  title: string
  action?: ReactNode
  /**
   * Exactly one screen tall, never scrolling: the content becomes a flex
   * column and whichever child is `flex-1` takes what's left above the nav.
   */
  fill?: boolean
  children: ReactNode
}

/** Shared tab layout: header plus scrollable content above the bottom nav. */
export function Screen({ title, action, fill = false, children }: Props) {
  const header = (
    <header className="mb-4 flex shrink-0 items-center justify-between gap-3">
      <h1 className="truncate text-2xl font-bold text-white">{title}</h1>
      {action}
    </header>
  )

  if (fill) {
    return (
      // the bottom padding is the nav's height (see BottomNav) plus a little air
      <div className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+4rem)] pt-[calc(env(safe-area-inset-top)+1rem)]">
        {header}
        {children}
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)]">
      {header}
      {children}
    </div>
  )
}
