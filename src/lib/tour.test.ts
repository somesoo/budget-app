import { beforeEach, describe, expect, it } from 'vitest'
import { TOUR_STEPS, tourSeen, tourStore } from './tour'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage
})

describe('tour', () => {
  it('has a unique id and a screen for every step', () => {
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length)
    for (const s of TOUR_STEPS) expect(s.route.startsWith('/')).toBe(true)
  })

  it('starts at the first step and stays within the steps', () => {
    tourStore.start('/settings')
    expect(tourStore.get()).toEqual({ step: 0, from: '/settings' })
    tourStore.go(-3)
    expect(tourStore.get().step).toBe(0)
    tourStore.go(999)
    expect(tourStore.get().step).toBe(TOUR_STEPS.length - 1)
  })

  it('is remembered as seen once finished or skipped', () => {
    expect(tourSeen()).toBe(false)
    tourStore.start()
    tourStore.end()
    expect(tourStore.get().step).toBeNull()
    expect(tourSeen()).toBe(true)
  })
})
