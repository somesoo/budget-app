/** Shown when the Supabase environment variables are missing. */
export function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-6 text-white">
      <h1 className="text-2xl font-bold">Database not configured</h1>
      <p className="text-sm text-muted">
        Copy <code className="rounded bg-white/10 px-1">.env.example</code> to{' '}
        <code className="rounded bg-white/10 px-1">.env</code> and fill in:
      </p>
      <pre className="overflow-x-auto rounded-2xl bg-white/5 p-4 text-xs text-slate-200 ring-1 ring-white/10">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
      </pre>
      <p className="text-sm text-muted">
        The README covers the migration, the seed and the Realtime setup.
      </p>
    </div>
  )
}
