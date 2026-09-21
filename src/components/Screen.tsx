import type { ReactNode } from 'react'

interface Props {
  title: string
  action?: ReactNode
  children: ReactNode
}

/** Shared tab layout: header plus scrollable content above the bottom nav. */
export function Screen({ title, action, children }: Props) {
  return (
    <div className="mx-auto min-h-[100dvh] max-w-md px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="truncate text-2xl font-bold text-white">{title}</h1>
        {action}
      </header>
      {children}
    </div>
  )
}
