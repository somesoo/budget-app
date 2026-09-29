import { useState, type FormEvent } from 'react'
import { AUTH_EMAIL } from '../config'
import { rememberEmail, rememberedEmail } from '../lib/account'
import { t } from '../i18n'
import { supabase } from '../lib/supabaseClient'
import { LanguagePicker } from './LanguagePicker'

/** The four tiles from public/icon.svg, drawn large as the screen's mark. */
const MARK_TILES = ['#22c55e', '#f97316', '#38bdf8', '#a855f7']

export function AppMark() {
  return (
    <div aria-hidden className="grid w-20 grid-cols-2 gap-1.5">
      {MARK_TILES.map((color, i) => (
        <span
          key={color}
          className="aspect-square rounded-[0.6rem] motion-safe:animate-tile-in motion-safe:opacity-0"
          style={{ backgroundColor: color, animationDelay: `${i * 70}ms` }}
        />
      ))}
    </div>
  )
}

/**
 * One shared account for the household. The form is a real <form> with a
 * username field, so the browser's password manager offers to save the
 * password; after that the Supabase session lives in localStorage and this
 * screen stays away. The email is asked for only until it has signed in here
 * once (or never, when VITE_AUTH_EMAIL sets it).
 */
export function Login() {
  const [email, setEmail] = useState(rememberedEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (authError) {
      setError(describeError(authError.message))
      setBusy(false)
    } else {
      rememberEmail(email.trim())
    }
    // on success onAuthStateChange swaps this screen out
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-between px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+3.5rem)]">
      <header>
        <div className="-mt-10 mb-4 flex justify-end">
          <LanguagePicker />
        </div>
        <AppMark />

        <h1 className="mt-8 text-4xl font-bold tracking-tight text-white">{t('common.appName')}</h1>
        <p className="mt-2 max-w-[28ch] text-base leading-relaxed text-muted">
          {t('login.intro')}
        </p>
      </header>

      <form
        onSubmit={submit}
        className="mt-12 grid gap-4 motion-safe:animate-rise-in motion-safe:opacity-0 motion-safe:[animation-delay:200ms]"
      >
        <label className="grid gap-2">
          <span className="text-sm text-muted">{t('login.account')}</span>
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={Boolean(AUTH_EMAIL)}
            autoFocus={!email}
            required
            className="w-full rounded-2xl bg-white/5 px-4 py-3.5 text-base text-white outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-white/60 read-only:bg-transparent read-only:text-slate-300"
          />
        </label>

        <div className="grid gap-2">
          <label htmlFor="login-password" className="text-sm text-muted">
            {t('login.password')}
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              autoFocus={Boolean(email)}
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              className={`w-full rounded-2xl bg-white/5 py-3.5 pl-4 pr-20 text-base text-white outline-none ring-1 transition focus:ring-2 ${
                error ? 'ring-red-400/60 focus:ring-red-400' : 'ring-white/10 focus:ring-white/60'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              className="absolute inset-y-1.5 right-1.5 rounded-xl px-3 text-sm font-medium text-slate-300 active:bg-white/10"
            >
              {showPassword ? t('login.hidePassword') : t('login.showPassword')}
            </button>
          </div>
          <p id="login-error" role="alert" className="min-h-5 text-sm text-red-300">
            {error}
          </p>
        </div>

        <button
          type="submit"
          disabled={busy || !password}
          className="h-16 rounded-3xl bg-slate-50 text-xl font-bold text-ink transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? t('login.signingIn') : t('login.signIn')}
        </button>
      </form>
    </div>
  )
}

function describeError(message: string): string {
  if (message === 'Invalid login credentials') return t('login.wrongPassword')
  if (/fetch|network/i.test(message)) return t('login.offline')
  return message
}
