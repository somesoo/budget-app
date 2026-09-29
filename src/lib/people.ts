import type { Person } from '../types'

/*
 * The people in the budget, one to four. They're rows in the database (see
 * migration 0015), loaded once at start and kept here, so any code can put a
 * name to an id without every caller passing the list down.
 */

export interface PersonInfo {
  /** What the other tables store: short, lowercase, never changes. */
  id: Person
  /** What's shown; can change any time. */
  name: string
  color: string
  sort_order: number
}

export const MAX_PEOPLE = 4

/** One per person, in order: told apart at a glance, on the dark background too. */
export const PERSON_COLORS = ['#3987e5', '#d95926', '#2fa37a', '#b865e0']

/** Before migration 0015 the app was made for two, with these ids. */
export const LEGACY_PEOPLE: PersonInfo[] = [
  { id: 'bubs', name: 'Bubs', color: PERSON_COLORS[0], sort_order: 0 },
  { id: 'meow', name: 'Meow', color: PERSON_COLORS[1], sort_order: 1 },
]

let current: PersonInfo[] = LEGACY_PEOPLE
const listeners = new Set<() => void>()

export const peopleStore = {
  get: () => current,
  subscribe: (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

/** Replaces the list; the same list again changes nothing, so screens don't re-render for it. */
export function setPeople(list: PersonInfo[]) {
  const next = [...list].sort((a, b) => a.sort_order - b.sort_order)
  if (JSON.stringify(next) === JSON.stringify(current)) return
  current = next
  for (const l of listeners) l()
}

export const getPeople = () => current
export const personIds = (): Person[] => current.map((p) => p.id)

const capitalise = (id: string) => id.charAt(0).toUpperCase() + id.slice(1)

/** A name for an id; one no longer in the list (removed, or from an old export) still reads well. */
export function personLabel(id: Person | null | undefined): string {
  if (!id) return ''
  return current.find((p) => p.id === id)?.name ?? capitalise(id)
}

export function personColor(id: Person): string {
  const index = current.findIndex((p) => p.id === id)
  return current[index]?.color ?? PERSON_COLORS[Math.max(index, 0) % PERSON_COLORS.length]
}

/** Zero for everyone in the budget, to add up into. */
export const zeroByPerson = (): Record<Person, number> =>
  Object.fromEntries(personIds().map((p) => [p, 0]))

/**
 * An id for a new person, from their name: "Anna" → "anna", "Zoë Ann" →
 * "zoe-ann", then "anna-2" if that's taken. Letters outside a–z fall back to
 * "person".
 */
export function personIdFor(name: string, taken: Person[]): Person {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ł/gi, 'l')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 20) || 'person'
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}
