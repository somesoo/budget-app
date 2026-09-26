import { useState, type FormEvent } from 'react'
import { APP_NAME, AUTH_EMAIL } from '../config'
import { supabase } from '../lib/supabaseClient'

/** The four tiles from public/icon.svg, drawn large as the screen's mark. */
const MARK_TILES = ['#22c55e', '#f97316', '#38bdf8', '#a855f7']

/**
 * One shared account for both phones. The form is a real <form> with a username
 * field, so the browser's password manager offers to save the password; after
 * that the Supabase session lives in localStorage and this screen stays away.
 */
export function Login() {
  const [email, setEmail] = useState(AUTH_EMAIL)
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
    }
    // on success onAuthStateChange swaps this screen out
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-between px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+3.5rem)]">
      <header>
        <div aria-hidden className="grid w-20 grid-cols-2 gap-1.5">
          {MARK_TILES.map((color, i) => (
            <span
              key={color}
              className="aspect-square rounded-[0.6rem] motion-safe:animate-tile-in motion-safe:opacity-0"
              style={{ backgroundColor: color, animationDelay: `${i * 70}ms` }}
            />
          ))}
        </div>

        <h1 className="mt-8 text-4xl font-bold tracking-tight text-white">{APP_NAME}</h1>
        <p className="mt-2 max-w-[28ch] text-base leading-relaxed text-muted">
          Sign in once. This phone stays signed in after that.
        </p>
      </header>

      <form
        onSubmit={submit}
        className="mt-12 grid gap-4 motion-safe:animate-rise-in motion-safe:opacity-0 motion-safe:[animation-delay:200ms]"
      >
        <label className="grid gap-2">
          <span className="text-sm text-muted">Account</span>
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={Boolean(AUTH_EMAIL)}
            required
            className="w-full rounded-2xl bg-white/5 px-4 py-3.5 text-base text-white outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-white/60 read-only:bg-transparent read-only:text-slate-300"
          />
        </label>

        <div className="grid gap-2">
          <label htmlFor="login-password" className="text-sm text-muted">
            Password
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
              autoFocus
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
              {showPassword ? 'Hide' : 'Show'}
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
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function describeError(message: string): string {
  if (message === 'Invalid login credentials') return 'That password is wrong. Try again.'
  if (/fetch|network/i.test(message)) return "Can't reach the server. Check your connection."
  return message
}
