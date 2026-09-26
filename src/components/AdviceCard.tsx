import { useState } from 'react'
import { ChartCard } from './charts/ChartCard'
import { CURRENCY_SUFFIX } from '../config'
import { AdviceUnavailableError, useGenerateAdvice, useLatestAdvice } from '../hooks/useAdvice'
import { formatAmount, plainDashes } from '../lib/calculations'
import type { AdviceRequest } from '../lib/forecast'

interface Props {
  month: string
  isCurrent: boolean
  /** Built lazily — only when someone actually asks. */
  buildRequest: () => AdviceRequest
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

/**
 * Gemini-written recommendations about the numbers above. Generated only on
 * request (it costs quota and takes a few seconds) and stored, so the other
 * phone sees the same advice without asking again.
 */
export function AdviceCard({ month, isCurrent, buildRequest }: Props) {
  const { data: advice, isLoading } = useLatestAdvice(month)
  const generate = useGenerateAdvice(month)
  const [showWhatsSent, setShowWhatsSent] = useState(false)

  const errorMessage =
    generate.error instanceof AdviceUnavailableError
      ? generate.error.message
      : generate.error
        ? `Couldn’t get recommendations: ${(generate.error as Error).message}`
        : null

  const button = isCurrent && (
    <button
      type="button"
      onClick={() => generate.mutate(buildRequest())}
      disabled={generate.isPending}
      className="w-full rounded-2xl bg-slate-50 py-3 text-sm font-bold text-ink transition active:scale-[0.99] disabled:opacity-50"
    >
      {generate.isPending ? 'Thinking…' : advice ? 'Refresh recommendations' : 'Get recommendations'}
    </button>
  )

  return (
    <ChartCard title="Recommendations">
      {isLoading ? (
        <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
      ) : advice ? (
        <div className="space-y-3">
          {advice.content.summary && (
            <p className="text-[15px] leading-snug text-white">{plainDashes(advice.content.summary)}</p>
          )}
          <ol className="space-y-2">
            {advice.content.recommendations.map((r, i) => (
              <li key={i} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{plainDashes(r.title)}</p>
                  {r.monthlyImpact !== null && r.monthlyImpact > 0 && (
                    <span className="shrink-0 rounded-full bg-positive/15 px-2 py-0.5 text-xs font-semibold text-positive">
                      ~{formatAmount(r.monthlyImpact)} {CURRENCY_SUFFIX}/mo
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-snug text-slate-300">{plainDashes(r.detail)}</p>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted">
            Written by {advice.content.model} · {timeAgo(advice.created_at)} · based on the numbers
            at that moment. Suggestions, not financial advice.
          </p>
          {button}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {isCurrent
              ? 'Gemini looks at this month’s numbers and suggests where to adjust.'
              : 'Recommendations are made for the month in progress.'}
          </p>
          {button}
        </div>
      )}

      {errorMessage && (
        <p className="mt-3 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{errorMessage}</p>
      )}

      {isCurrent && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowWhatsSent((v) => !v)}
            aria-expanded={showWhatsSent}
            className="text-xs font-medium text-muted active:text-white"
          >
            {showWhatsSent ? 'Hide what’s sent' : 'What gets sent to Gemini?'}
          </button>
          {showWhatsSent && (
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Totals only: income per person, spending per category with its limit and a typical
              month, the Bubs/Meow split, and the savings goal. No notes, no individual expenses,
              no email. On Google’s free API tier, submitted data may be used to improve their
              products and read by human reviewers; the paid tier excludes that.
            </p>
          )}
        </div>
      )}
    </ChartCard>
  )
}
