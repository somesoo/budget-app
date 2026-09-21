import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * When the env vars are missing we still create a client against a dummy URL so
 * that importing modules never throw; the UI shows a setup screen instead
 * (see `SetupNotice`).
 */
export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-missing',
  {
    auth: {
      // the session is kept in localStorage and refreshed in the background,
      // so the password is typed once per device
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 5 } },
  },
)
