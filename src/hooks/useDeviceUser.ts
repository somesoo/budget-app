import { useCallback, useSyncExternalStore } from 'react'
import { PERSONS, type Person } from '../types'

const STORAGE_KEY = 'budget-app.device-person'

/**
 * Who uses THIS phone. Kept only in the device's localStorage — it never
 * reaches the shared database.
 */

function read(): Person | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return PERSONS.includes(raw as Person) ? (raw as Person) : null
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
  const person = useSyncExternalStore(subscribe, getSnapshot, () => null)

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
