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

/** Number formatting + currency suffix (amounts are stored as plain numbers). */
export const LOCALE = 'en-GB'
export const CURRENCY_SUFFIX = 'zł'

/** Big one-tap buttons on the amount screen. */
export const QUICK_AMOUNTS = [10, 20, 50, 100]

/** Fine-tuning steps shown once an amount is set. */
export const FINE_TUNE_STEPS = [-5, -1, 1, 5]

/** Week starts on Monday. */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
