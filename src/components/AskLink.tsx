import { Sparkle } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { t } from '../i18n'

/**
 * Opens the Ask tab with a question ready to send (not sent: it can be
 * edited first). On the phone this is how Ask is reached.
 */
export function AskLink({ question, label = t('ask.link') }: { question?: string; label?: string }) {
  return (
    <Link
      aria-label={label}
      to={question ? `/ask?q=${encodeURIComponent(question)}` : '/ask'}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent/10 px-3 text-sm font-semibold text-accent-soft ring-1 ring-accent/25 hover:bg-accent/20"
    >
      <Sparkle weight="fill" aria-hidden />
      {/* icon only on narrow phones, where headers are tight */}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )
}
