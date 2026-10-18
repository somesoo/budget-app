import { CaretRight, Plus, Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAddChapter, useChapters, useDeleteChapter } from '../../hooks/useChapters'
import { setPrefs, usePrefs } from '../../hooks/usePrefs'
import { formatDayLong, todayKey } from '../../lib/calculations'
import { EARLIER_ID, chapterSpans, currentChapter, type ChapterSpan } from '../../lib/chapters'
import { Field, Switch, inputClass } from '../savings/fields'
import { CardAction, SettingsCard } from './SettingsCard'
import { t } from '../../i18n'

/** The span's name: its own, or "Before <first chapter>" for the time before the first. */
export function spanName(span: ChapterSpan, spans: ChapterSpan[]): string {
  if (span.name) return span.name
  const first = spans.filter((s) => s.id !== null).at(-1)
  return t('chapters.before', { name: first?.name ?? '' })
}

export function spanDates(span: ChapterSpan): string {
  if (!span.from) return t('chapters.until', { date: formatDayLong(span.to!) })
  if (!span.to) return t('chapters.since', { date: formatDayLong(span.from) })
  return t('chapters.between', { from: formatDayLong(span.from), to: formatDayLong(span.to) })
}

/**
 * Chapters of the budget (lib/chapters): start a new one when life changes
 * (moving in together), see what an old one came to, and choose whether
 * this phone still shows the past and lets the planner learn from it.
 */
export function ChaptersCard() {
  const { data } = useChapters()
  const prefs = usePrefs()
  const add = useAddChapter()
  const remove = useDeleteChapter()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [startsOn, setStartsOn] = useState(todayKey())
  const [confirming, setConfirming] = useState<string | null>(null)

  if (!data) return null
  if (!data.available) {
    return (
      <SettingsCard title={t('chapters.title')} help={t('chapters.help')}>
        <p className="text-sm text-muted">
          {t('errors.migration', { file: '0021_chapters.sql', what: t('chapters.title') })}
        </p>
      </SettingsCard>
    )
  }

  const spans = chapterSpans(data.chapters)
  const current = currentChapter(data.chapters, todayKey())
  const hasPast = spans.some((s) => s.id !== current?.id)

  const save = () => {
    if (!name.trim()) return
    add.mutate(
      { name: name.trim(), starts_on: startsOn },
      {
        onSuccess: () => {
          setAdding(false)
          setName('')
        },
      },
    )
  }

  return (
    <SettingsCard
      title={t('chapters.title')}
      help={t('chapters.help')}
      action={
        !adding && (
          <CardAction onClick={() => setAdding(true)}>
            <Plus weight="bold" aria-hidden /> {t('chapters.new')}
          </CardAction>
        )
      }
    >
      {adding && (
        <div className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
          <Field label={t('chapters.nameLabel')} help={t('chapters.nameHelp')}>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('chapters.namePlaceholder')}
              autoFocus
            />
          </Field>
          <Field label={t('chapters.startsLabel')} help={t('chapters.startsHelp')}>
            <input
              type="date"
              className={inputClass}
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
            />
          </Field>
          {add.error && <p role="alert" className="text-xs text-red-300">{(add.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:bg-white/5"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!name.trim() || !startsOn || add.isPending}
              className="rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              {t('chapters.start')}
            </button>
          </div>
        </div>
      )}

      {spans.length === 0 ? (
        !adding && <p className="text-sm text-muted">{t('chapters.none')}</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {spans.map((span) => (
            <li key={span.id ?? EARLIER_ID} className="flex items-center gap-2 py-2.5">
              <Link
                to={`/chapter/${span.id ?? EARLIER_ID}`}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl hover:bg-white/5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-white">
                    {spanName(span, spans)}
                    {span.id !== null && span.id === current?.id && (
                      <span className="ml-2 text-xs font-semibold text-accent-soft">
                        {t('chapters.current')}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted">{spanDates(span)}</span>
                </span>
                <span className="text-xs font-semibold text-accent-soft">{t('chapters.summary')}</span>
                <CaretRight className="shrink-0 text-muted" aria-hidden />
              </Link>
              {span.id !== null &&
                (confirming === span.id ? (
                  <button
                    type="button"
                    onClick={() => remove.mutate(span.id!, { onSettled: () => setConfirming(null) })}
                    className="shrink-0 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/25"
                  >
                    {t('chapters.confirmDelete')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(span.id)}
                    aria-label={t('chapters.delete', { name: spanName(span, spans) })}
                    className="shrink-0 rounded-full p-2 text-muted hover:bg-white/5 hover:text-white"
                  >
                    <Trash aria-hidden />
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      {hasPast && (
        <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
          <Switch
            label={t('chapters.showPast')}
            help={t('chapters.showPastHelp')}
            checked={prefs.showPastChapters}
            onChange={(v) => setPrefs({ showPastChapters: v })}
          />
          <Switch
            label={t('chapters.inPlanner')}
            help={t('chapters.inPlannerHelp')}
            checked={prefs.pastChaptersInPlanner}
            onChange={(v) => setPrefs({ pastChaptersInPlanner: v })}
          />
        </div>
      )}
    </SettingsCard>
  )
}
