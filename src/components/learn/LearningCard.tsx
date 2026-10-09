import { useState } from 'react'
import { SettingsCard } from '../settings/SettingsCard'
import { Switch } from '../savings/fields'
import { StageLesson } from './StageLesson'
import { setPrefs, usePrefs } from '../../hooks/usePrefs'
import { goToStage } from '../../hooks/useLearning'
import { FEATURES, STAGES, featuresOf, isOn, type FeatureId, type Stage } from '../../lib/features'
import { t } from '../../i18n'

/**
 * Settings → What the app shows: the four stages, each with its lesson, and
 * a switch per feature for whoever wants something earlier or later.
 */
export function LearningCard() {
  const prefs = usePrefs()
  const [lesson, setLesson] = useState<Stage | null>(null)
  const [custom, setCustom] = useState(false)
  const choice = { stage: prefs.stage, overrides: prefs.featureOverrides }
  const adjusted = Object.keys(prefs.featureOverrides).length > 0

  const toggle = (id: FeatureId, on: boolean) => {
    const { [id]: _, ...rest } = prefs.featureOverrides
    // back to what the stage says: no need to remember it
    const byStage = isOn({ stage: prefs.stage, overrides: {} }, id)
    setPrefs({ featureOverrides: on === byStage ? rest : { ...rest, [id]: on } })
  }

  return (
    <SettingsCard title={t('learn.title')} help={t('learn.help')} tour="settings-learn">
      <ol className="grid gap-2">
        {STAGES.map((stage) => {
          const current = stage === prefs.stage
          const adds = featuresOf(stage)
          return (
            <li
              key={stage}
              className={`rounded-2xl p-3 ring-1 ${current ? 'bg-accent/10 ring-accent/40' : 'ring-white/10'}`}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    stage <= prefs.stage ? 'bg-accent text-white' : 'bg-white/10 text-muted'
                  }`}
                >
                  {stage}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[15px] font-semibold text-white">
                      {t(`learn.stage.${stage}.name`)}
                    </span>
                    {current && (
                      <span className="text-xs font-semibold text-accent-soft">
                        {t('learn.current')}
                        {adjusted && `, ${t('learn.custom')}`}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-muted">
                    {adds.length > 0
                      ? `${t('learn.adds')}: ${adds.map((f) => t(`learn.feature.${f}.label`)).join(', ')}`
                      : t('learn.addsNothing')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setLesson(stage)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/5"
                    >
                      {t('learn.readLesson')}
                    </button>
                    {!current && (
                      <button
                        type="button"
                        onClick={() => goToStage(stage)}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-ink hover:bg-slate-50"
                      >
                        {t('learn.choose')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={() => setCustom((v) => !v)}
          aria-expanded={custom}
          className="text-sm font-semibold text-accent-soft hover:underline"
        >
          {custom ? t('learn.customizeHide') : t('learn.customize')}
        </button>
        {adjusted && (
          <button
            type="button"
            onClick={() => setPrefs({ featureOverrides: {} })}
            className="text-sm font-semibold text-muted hover:text-white"
          >
            {t('learn.reset')}
          </button>
        )}
      </div>

      {custom && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          {FEATURES.map((f) => (
            <Switch
              key={f.id}
              label={`${t(`learn.feature.${f.id}.label`)} · ${t('learn.stageN', { n: f.stage })}`}
              help={t(`learn.feature.${f.id}.help`)}
              checked={isOn(choice, f.id)}
              onChange={(on) => toggle(f.id, on)}
            />
          ))}
        </div>
      )}

      {lesson !== null && (
        <StageLesson
          stage={lesson}
          offer={lesson === prefs.stage + 1}
          onClose={() => setLesson(null)}
        />
      )}
    </SettingsCard>
  )
}
