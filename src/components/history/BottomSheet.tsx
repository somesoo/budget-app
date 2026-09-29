import { X } from '@phosphor-icons/react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { t } from '../../i18n'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * Panel sliding up from the bottom, over a dimmed page. Editing happens here
 * instead of inline, so the list never jumps around under your thumb and the
 * form gets the whole width. Backdrop tap and Escape close it.
 */
export function BottomSheet({ title, onClose, children }: Props) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    // the page behind shouldn't scroll along with the sheet
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-center lg:p-8">
      <div aria-hidden className="motion-safe:animate-fade-in absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="motion-safe:animate-sheet-up lg:motion-safe:animate-fade-in relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 lg:max-h-[85dvh] lg:rounded-3xl lg:px-6 lg:pb-6 lg:pt-5 outline-none ring-1 ring-white/10"
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 lg:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-xl text-muted active:bg-white/10"
          >
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
