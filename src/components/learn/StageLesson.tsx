import { CheckCircle } from '@phosphor-icons/react'
import { BottomSheet } from '../history/BottomSheet'
import { featuresOf, type Stage } from '../../lib/features'
import { goToStage, snoozeNextStage } from '../../hooks/useLearning'
import { t } from '../../i18n'

/**
 * One stage, as a short lesson: why the habit matters, what it adds to the
 * app, three things to do. Offered as the next step, it can switch to it.
 */
export function StageLesson({
  stage,
  offer,
  onClose,
}: {
  stage: Stage
  /** Suggested as the next stage: show the buttons to take it or put it off. */
  offer?: boolean
  onClose: () => void
}) {
  const adds = featuresOf(stage)
  return (
    <BottomSheet
      title={`${t('learn.stageN', { n: stage })}: ${t(`learn.stage.${stage}.name`)}`}
      onClose={onClose}
    >
      <div className="grid gap-5 pb-2">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('learn.why')}
          </h3>
          <p className="mt-1 text-[15px] leading-relaxed text-slate-100">
            {t(`learn.stage.${stage}.why`)}
          </p>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('learn.adds')}
          </h3>
          {adds.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {adds.map((f) => (
                <li
                  key={f}
                  className="rounded-full bg-white/5 px-3 py-1 text-sm text-slate-200 ring-1 ring-white/10"
                >
                  {t(`learn.feature.${f}.label`)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-300">{t('learn.addsNothing')}</p>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('learn.toDo')}
          </h3>
          <ol className="mt-2 space-y-2">
            {(['do1', 'do2', 'do3'] as const).map((k) => (
              <li key={k} className="flex gap-2 text-[15px] leading-snug text-slate-100">
                <CheckCircle aria-hidden className="mt-0.5 shrink-0 text-accent-soft" />
                {t(`learn.stage.${stage}.${k}`)}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">{t(`learn.stage.${stage}.next`)}</p>
        </section>

        {offer && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                goToStage(stage)
                onClose()
              }}
              className="flex-1 rounded-2xl bg-slate-100 py-3 text-[15px] font-bold text-ink hover:bg-slate-50"
            >
              {t('learn.unlock', { n: stage, name: t(`learn.stage.${stage}.name`) })}
            </button>
            <button
              type="button"
              onClick={() => {
                snoozeNextStage()
                onClose()
              }}
              className="rounded-2xl px-4 py-3 text-[15px] font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
            >
              {t('learn.later')}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
