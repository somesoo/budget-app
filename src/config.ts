import type { Person } from './types'

/**
 * Every user-facing name and tunable number lives here, so renaming the two of
 * you — or changing the quick amounts — is a one-line edit.
 */

export const APP_NAME = 'Budget'

/** Who uses which phone. The keys are stored in the database, the labels are shown in the UI. */
export const PERSON_LABELS: Record<Person, string> = {
  bubs: 'Bubs',
  meow: 'Meow',
}

/**
 * The shared account both of you sign in with. Not a secret (the password is),
 * it just means the login screen only has to ask for a password.
 */
export const AUTH_EMAIL = (import.meta.env.VITE_AUTH_EMAIL as string | undefined) ?? ''

/** Number formatting + currency suffix (amounts are stored as plain numbers). */
export const LOCALE = 'en-GB'
export const CURRENCY_SUFFIX = 'zł'

/** Big one-tap buttons on the amount screen. */
export const QUICK_AMOUNTS = [10, 20, 50, 100]

/** One-tap contributions on the savings goal. */
export const GOAL_QUICK_AMOUNTS = [50, 100, 200, 500]

/** Fine-tuning steps shown once an amount is set. */
export const FINE_TUNE_STEPS = [-5, -1, 1, 5]

/** Week starts on Monday. */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

/** How many months the Insights tab looks back over. */
export const INSIGHTS_MONTHS = 6

/**
 * Single expenses at or above this are left out of the weekday chart. It's
 * about everyday habits — without this, rent makes whichever weekday it lands
 * on look like your most expensive day.
 */
export const WEEKDAY_EXCLUDE_FROM = 1000
