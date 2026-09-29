import {
  ArrowClockwise,
  CaretDown,
  Coins,
  Lightbulb,
  PiggyBank,
  Receipt,
  Sparkle,
  Target,
  type Icon,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CURRENCY_SUFFIX } from '../config'
import { AdviceUnavailableError, useGenerateAdvice, useLatestAdvice } from '../hooks/useAdvice'
import { formatAmount, plainDashes } from '../lib/calculations'
import type { AdviceRequest } from '../lib/forecast'
import type { AdviceArea, Recommendation } from '../types'
import { CHART } from './charts/theme'

interface Props {
  month: string
  isCurrent: boolean
  /** Built lazily, only when someone actually asks. */
  buildRequest: () => AdviceRequest
}

const AREAS: Record<AdviceArea, { label: string; icon: Icon }> = {
  spending: { label: 'Spending', icon: Receipt },
  savings: { label: 'Savings', icon: PiggyBank },
  goals: { label: 'Goals', icon: Target },
  income: { label: 'Income', icon: Coins },
  other: { label: 'Tip', icon: Lightbulb },
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
 * Gemini-written recommendations about the month, the savings and the goals.
 * Generated only on request (it costs quota and takes a few seconds) and
 * stored, so the other phone sees the same advice without asking again.
 *
 * Laptop: a band across the page, the recommendations side by side, each
 * whole. Phone: a compact list of titles, each opening to its detail.
 */
export function AdviceCard({ month, isCurrent, buildRequest }: Props) {
  const { data: advice, isLoading } = useLatestAdvice(month)
  const generate = useGenerateAdvice(month)
  const [open, setOpen] = useState<number | null>(null)
  const [showWhatsSent, setShowWhatsSent] = useState(false)

  // a past month without stored advice has nothing to show or to ask for
  if (!isCurrent && !isLoading && !advice) return null

  const errorMessage =
    generate.error instanceof AdviceUnavailableError
      ? generate.error.message
      : generate.error
        ? `Couldn’t get recommendations: ${(generate.error as Error).message}`
        : null

  const recommendations = advice?.content.recommendations ?? []

  return (
    <section
      data-tour="insights-advice"
      aria-labelledby="advice-title"
      className="rounded-3xl p-4 ring-1 ring-white/10 lg:p-6"
      style={{ backgroundColor: CHART.surface }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="advice-title"
            className="flex items-center gap-1.5 text-base font-semibold text-white"
          >
            <Sparkle weight="fill" aria-hidden className="text-accent-soft" />
            Recommendations
          </h2>
          {advice && (
            <p className="mt-0.5 text-xs text-muted">
              {advice.content.model} · {timeAgo(advice.created_at)}
            </p>
          )}
        </div>
        {isCurrent && (
          <button
            type="button"
            onClick={() => {
              setOpen(null)
              generate.mutate(buildRequest())
            }}
            disabled={generate.isPending}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition disabled:opacity-50 ${
              advice
                ? 'text-slate-200 ring-1 ring-white/15 hover:bg-white/5'
                : 'bg-slate-100 text-ink hover:bg-slate-50'
            }`}
          >
            {advice && (
              <ArrowClockwise
                aria-hidden
                className={generate.isPending ? 'motion-safe:animate-spin' : ''}
              />
            )}
            {generate.isPending ? 'Thinking…' : advice ? 'Refresh' : 'Get recommendations'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-3 lg:gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/5 lg:h-32" />
          ))}
        </div>
      ) : advice ? (
        <>
          {advice.content.summary && (
            <p className="mt-3 max-w-3xl text-[15px] leading-snug text-slate-100 lg:text-lg lg:leading-snug">
              {plainDashes(advice.content.summary)}
            </p>
          )}
          <ol
            className={`mt-4 grid gap-2 lg:grid-cols-6 lg:gap-3 ${
              generate.isPending ? 'opacity-50 transition-opacity' : ''
            }`}
          >
            {recommendations.map((r, i) => (
              <RecommendationItem
                key={i}
                span={spanFor(i, recommendations.length)}
                rec={r}
                open={open === i}
                onToggle={() => setOpen(open === i ? null : i)}
              />
            ))}
          </ol>
        </>
      ) : (
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Gemini looks at this month, your savings and goals, and suggests where to adjust.
        </p>
      )}

      {errorMessage && (
        <p role="alert" className="mt-3 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">
          {errorMessage}
        </p>
      )}

      {isCurrent && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowWhatsSent((v) => !v)}
            aria-expanded={showWhatsSent}
            className="text-xs font-medium text-muted hover:text-white"
          >
            {showWhatsSent ? 'Hide what’s sent' : 'What gets sent to Gemini?'}
          </button>
          {showWhatsSent && (
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
              Income per person, spending per category with its limit and a typical month, the
              Bubs/Meow split, the app’s warnings, the month’s biggest expenses with their notes,
              savings accounts and goals, and trips. No email or account numbers. On Google’s free
              API tier, submitted data may be used to improve their products and read by human
              reviewers; the paid tier excludes that. Suggestions, not financial advice.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * Column span on the laptop's 6-column grid, so every row is full: 3 in a
 * row, 2 in a row, or 3 then 2 for five.
 */
function spanFor(i: number, n: number): string {
  if (n === 1) return 'lg:col-span-6'
  if (n === 2 || n === 4) return 'lg:col-span-3'
  if (n === 5) return i < 3 ? 'lg:col-span-2' : 'lg:col-span-3'
  return 'lg:col-span-2'
}

function RecommendationItem({
  rec,
  span,
  open,
  onToggle,
}: {
  rec: Recommendation
  span: string
  open: boolean
  onToggle: () => void
}) {
  const area = AREAS[rec.area ?? 'other'] ?? AREAS.other
  const title = plainDashes(rec.title)
  const impact =
    rec.monthlyImpact !== null && rec.monthlyImpact > 0 ? (
      <span className="shrink-0 rounded-full bg-positive/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-positive">
        ~{formatAmount(rec.monthlyImpact)} {CURRENCY_SUFFIX}/mo
      </span>
    ) : null

  return (
    <li
      className={`rounded-2xl bg-white/[0.04] ring-1 ring-white/10 lg:flex lg:flex-col lg:p-4 ${span}`}
    >
      {/* phone: the title is a toggle; laptop: everything is always open */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left lg:pointer-events-none lg:items-start lg:p-0"
      >
        <area.icon aria-hidden className="shrink-0 text-lg text-accent-soft lg:mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="hidden text-xs text-muted lg:block">{area.label}</span>
          <span className="line-clamp-2 text-sm font-semibold leading-snug text-white lg:line-clamp-none lg:text-[15px]">
            {title}
          </span>
        </span>
        <span className="lg:hidden">{impact}</span>
        <CaretDown
          aria-hidden
          className={`shrink-0 text-muted transition lg:hidden ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`${open ? 'block' : 'hidden'} px-3 pb-3 pl-10 lg:flex lg:flex-1 lg:flex-col lg:p-0 lg:pl-0`}
      >
        <p className="text-sm leading-snug text-slate-300 lg:mt-2">{plainDashes(rec.detail)}</p>
        <div className="mt-3 flex items-center justify-between gap-2 lg:mt-auto lg:pt-3">
          <span className="hidden lg:inline">{impact}</span>
          <Link
            to={`/ask?q=${encodeURIComponent(`Tell me more about this: ${title}`)}`}
            className="text-sm font-semibold text-accent-soft hover:underline"
          >
            Ask about it
          </Link>
        </div>
      </div>
    </li>
  )
}
