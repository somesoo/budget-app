import { AUTH_EMAIL } from '../config'

/**
 * The budget's account email on this device. VITE_AUTH_EMAIL wins when an
 * older install still sets it; otherwise it's whatever last signed in here,
 * so a phone asks for the email only the first time.
 */

const STORAGE_KEY = 'budget-app.account-email'

export function rememberedEmail(): string {
  if (AUTH_EMAIL) return AUTH_EMAIL
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberEmail(email: string) {
  try {
    localStorage.setItem(STORAGE_KEY, email)
  } catch {
    // storage blocked: it'll be asked for again next time
  }
}

export interface SetupStatus {
  /** The server can make the account (it has the Supabase secret key). */
  canCreate: boolean
  /** No account yet: show the welcome screen. null when unknown. */
  needsAccount: boolean | null
}

/** GET /api/setup. Without the server functions (plain `npm run dev`) it's just the sign-in. */
export async function fetchSetupStatus(): Promise<SetupStatus> {
  try {
    const res = await fetch('/api/setup', { cache: 'no-store' })
    if (!res.ok) return { canCreate: false, needsAccount: null }
    return (await res.json()) as SetupStatus
  } catch {
    return { canCreate: false, needsAccount: null }
  }
}
