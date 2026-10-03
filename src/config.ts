/**
 * Tunable numbers live here, so changing the quick amounts or the currency is
 * a one-line edit. The people are in the database; the text is in
 * src/locales.
 */

/**
 * The shared account everyone signs in with. Not a secret (the password is),
 * it just means the login screen only has to ask for a password.
 */
export const AUTH_EMAIL = (import.meta.env.VITE_AUTH_EMAIL as string | undefined) ?? ''

/**
 * Currency suffix (amounts are stored as plain numbers). Number and date
 * formats follow the app's language: see src/i18n.
 */
export const CURRENCY_SUFFIX = 'zł'

/** Big one-tap buttons on the amount screen; they add up. Each device can change them in Settings. */
export const QUICK_AMOUNTS = [10, 20, 50, 100]

/** One-tap contributions on the savings goal. */
export const GOAL_QUICK_AMOUNTS = [50, 100, 200, 500]


/**
 * Yearly contribution limits, per person, set each year by the government:
 * IKE is 3× and IKZE 1.2× the forecast average monthly salary. Add next year's
 * figure when it's announced (usually in November); until then the latest
 * known year is used.
 */
export const RETIREMENT_LIMITS: Record<'ike' | 'ikze', Record<number, number>> = {
  ike: { 2025: 26_019, 2026: 28_260 },
  ikze: { 2025: 10_407.6, 2026: 11_304 },
}

/** How far ahead a month can be planned. */
export const PLAN_AHEAD_MONTHS = 3

/** How many months the Insights tab looks back over. */
export const INSIGHTS_MONTHS = 6

/**
 * Single expenses at or above this are left out of the weekday chart. It's
 * about everyday habits — without this, rent makes whichever weekday it lands
 * on look like your most expensive day.
 */
export const WEEKDAY_EXCLUDE_FROM = 1000

/**
 * Financial independence (the FIRE card on Insights): enough is this many
 * years of spending, the "4% rule" (take out 4% a year and it lasts). The
 * savings are assumed to grow by FIRE_REAL_RETURN a year after inflation, a
 * cautious figure for a mix of shares and bonds.
 */
export const FIRE_MULTIPLE = 25
export const FIRE_REAL_RETURN = 0.04
