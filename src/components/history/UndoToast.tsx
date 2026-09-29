import { useEffect } from 'react'
import { t } from '../../i18n'

interface Props {
  message: string
  onUndo: () => void
  onDismiss: () => void
  /** How long the chance to undo lasts. */
  timeoutMs?: number
}

/**
 * "Deleted · Undo" above the bottom nav. Deleting is one tap and the undo is
 * the safety net — faster than an "Are you sure?" and it also catches the
 * mistakes you only notice a second later.
 */
export function UndoToast({ message, onUndo, onDismiss, timeoutMs = 6000 }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, timeoutMs)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss, timeoutMs])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 flex justify-center px-4 lg:bottom-8 lg:left-60">
      <div
        role="status"
        className="motion-safe:animate-sheet-up pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-50 py-2 pl-4 pr-2 text-ink shadow-lg"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{message}</span>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 rounded-xl px-3 py-2 text-sm font-bold text-accent-strong active:bg-accent/10"
        >
          {t('entry.undo')}
        </button>
      </div>
    </div>
  )
}
