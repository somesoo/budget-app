import { GraduationCap, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { StageLesson } from './StageLesson'
import { snoozeNextStage, useNextStage } from '../../hooks/useLearning'
import { t } from '../../i18n'

/**
 * A one-line nudge on the Add screen once the current stage's habit has
 * taken: two weeks of logging, a plan, a couple of months of saving. Opens
 * the next stage's lesson; "Not now" puts it off for two weeks.
 */
export function NextStageBanner() {
  const next = useNextStage()
  const [open, setOpen] = useState(false)
  if (next === null && !open) return null

  return (
    <>
      {next !== null && (
        <div className="mb-3 flex shrink-0 items-center gap-1 rounded-2xl bg-accent/10 ring-1 ring-accent/25">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('learn.nudgeLabel')}
            className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
          >
            <GraduationCap aria-hidden weight="fill" className="shrink-0 text-xl text-accent-soft" />
            <span className="min-w-0 truncate text-sm font-semibold text-white">
              {t('learn.nudge', { name: t(`learn.stage.${next}.name`) })}
            </span>
          </button>
          <button
            type="button"
            onClick={snoozeNextStage}
            aria-label={t('learn.dismiss')}
            title={t('learn.dismiss')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-white"
          >
            <X aria-hidden />
          </button>
        </div>
      )}
      {open && next !== null && (
        <StageLesson stage={next} offer onClose={() => setOpen(false)} />
      )}
    </>
  )
}
