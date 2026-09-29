import { useState, type FormEvent } from 'react'
import { t } from '../i18n'
import { rememberEmail } from '../lib/account'
import { supabase } from '../lib/supabaseClient'
import { LanguagePicker } from './LanguagePicker'
import { AppMark } from './Login'

const MIN_PASSWORD = 8

/**
 * A new install's first screen: make the account everyone in the budget signs
 * in with. /api/setup makes it (the server holds the key that can), then this
 * phone signs straight in and goes on to "Who's in this budget?". Shown only
 * while there's no account; after that the database refuses another one.
 */
export function Welcome({ onAccountExists }: { onAccountExists: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return
    setBusy(true)
    setError(null)
    const address = email.trim().toLowerCase()
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: address, password }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
      if (!res.ok) {
        // someone else got there first: the sign-in screen it is
        if (body.code === 'exists') return onAccountExists()
        setError(
          body.code === 'email'
            ? t('welcome.badEmail')
            : t('welcome.failed', { error: body.error ?? res.status }),
        )
        setBusy(false)
        return
      }
      rememberEmail(address)
      // the session swaps this screen out; should the sign-in fail, the
      // sign-in screen takes over, since the account is there now
      await supabase.auth.signInWithPassword({ email: address, password })
      onAccountExists()
    } catch (err) {
      setError(t('welcome.failed', { error: (err as Error).message }))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-between px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+3.5rem)]">
      <header>
        <div className="-mt-10 mb-4 flex justify-end">
          <LanguagePicker />
        </div>
        <AppMark />
        <h1 className="mt-8 text-4xl font-bold tracking-tight text-white">{t('welcome.title')}</h1>
        <p className="mt-2 max-w-[34ch] text-base leading-relaxed text-muted">
          {t('welcome.intro')}
        </p>
      </header>

      <form
        onSubmit={submit}
        className="mt-10 grid gap-4 motion-safe:animate-rise-in motion-safe:opacity-0 motion-safe:[animation-delay:200ms]"
      >
        <label className="grid gap-2">
          <span className="text-sm text-muted">{t('welcome.email')}</span>
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
            className="w-full rounded-2xl bg-white/5 px-4 py-3.5 text-base text-white outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-white/60"
          />
          <span className="text-xs text-muted">{t('welcome.emailHelp')}</span>
        </label>

        <div className="grid gap-2">
          <label htmlFor="welcome-password" className="text-sm text-muted">
            {t('welcome.password')}
          </label>
          <div className="relative">
            <input
              id="welcome-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              required
              minLength={MIN_PASSWORD}
              aria-describedby="welcome-password-help"
              className="w-full rounded-2xl bg-white/5 py-3.5 pl-4 pr-20 text-base text-white outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-white/60"
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
          <p
            id="welcome-password-help"
            className={`text-xs ${tooShort ? 'text-amber-200' : 'text-muted'}`}
          >
            {t('welcome.passwordHelp', { min: MIN_PASSWORD })}
          </p>
          <p role="alert" className="min-h-5 text-sm text-red-300">
            {error}
          </p>
        </div>

        <button
          type="submit"
          disabled={busy || !email.trim() || password.length < MIN_PASSWORD}
          className="h-16 rounded-3xl bg-slate-50 text-xl font-bold text-ink transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? t('welcome.creating') : t('welcome.create')}
        </button>
      </form>
    </div>
  )
}
