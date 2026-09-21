import { useState, type FormEvent } from 'react'
import { APP_NAME, AUTH_EMAIL } from '../config'
import { supabase } from '../lib/supabaseClient'

/**
 * One shared account for both phones. The form is a real <form> with a username
 * field, so the browser's password manager offers to save the password; after
 * that the Supabase session lives in localStorage and this screen stays away.
 */
export function Login() {
  const [email, setEmail] = useState(AUTH_EMAIL)
  const [password, setPassword] = useState('')
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
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Wrong password'
          : authError.message,
      )
      setBusy(false)
    }
    // on success onAuthStateChange swaps this screen out
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-bold text-white">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in once — this device stays signed in afterwards.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-muted">Account</span>
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={Boolean(AUTH_EMAIL)}
            required
            className="w-full rounded-2xl bg-white/5 px-4 py-3.5 text-base text-white outline-none ring-1 ring-white/10 read-only:text-muted"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-muted">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
            className="w-full rounded-2xl bg-white/5 px-4 py-3.5 text-base text-white outline-none ring-1 ring-white/10 focus:ring-white/30"
          />
        </label>

        {error && (
          <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="h-16 rounded-3xl bg-white text-xl font-bold text-ink transition active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
