import { LANGUAGES, setLanguage, t, useLanguage, type Language } from '../i18n'

/** The app's language as a row of small pills, for screens before Settings is reachable. */
export function LanguagePicker() {
  const current = useLanguage()
  return (
    <div role="group" aria-label={t('settings.language.title')} className="flex gap-1">
      {(Object.keys(LANGUAGES) as Language[]).map((id) => (
        <button
          key={id}
          type="button"
          lang={id}
          onClick={() => setLanguage(id)}
          aria-pressed={current === id}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
            current === id ? 'bg-white/15 text-white' : 'text-muted hover:text-white'
          }`}
        >
          {LANGUAGES[id].name}
        </button>
      ))}
    </div>
  )
}
