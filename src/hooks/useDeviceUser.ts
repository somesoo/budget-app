import { useCallback, useSyncExternalStore } from 'react'
import { peopleStore } from '../lib/people'
import type { Person } from '../types'

const STORAGE_KEY = 'budget-app.device-person'

/**
 * Who uses THIS phone. Kept only in the device's localStorage — it never
 * reaches the shared database. Someone no longer in the budget counts as
 * nobody, so the phone asks again.
 */

function read(): Person | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null
  } catch {
    return null
  }
}

let cached: Person | null = read()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // other tabs / windows on the same device
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cached = read()
      emit()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot(): Person | null {
  return cached
}

export function useDeviceUser() {
  const stored = useSyncExternalStore(subscribe, getSnapshot, () => null)
  const people = useSyncExternalStore(peopleStore.subscribe, peopleStore.get, peopleStore.get)
  // with one person in the budget there's nobody else it could be
  const person =
    stored && people.some((p) => p.id === stored)
      ? stored
      : people.length === 1
        ? people[0].id
        : null

  const setPerson = useCallback((next: Person) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // private mode / storage blocked — carry on in memory
    }
    cached = next
    emit()
  }, [])

  return { person, setPerson, isChosen: person !== null }
}
