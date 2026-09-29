import { afterEach, describe, expect, it } from 'vitest'
import {
  LEGACY_PEOPLE,
  getPeople,
  personColor,
  personIdFor,
  personIds,
  personLabel,
  setPeople,
  zeroByPerson,
} from './people'

afterEach(() => setPeople(LEGACY_PEOPLE))

describe('people', () => {
  it('starts as the two of the original app', () => {
    expect(personIds()).toEqual(['bubs', 'meow'])
    expect(personLabel('meow')).toBe('Meow')
  })

  it('names, colours and zeros whoever is in the budget, in order', () => {
    setPeople([
      { id: 'ola', name: 'Ola', color: '#2fa37a', sort_order: 1 },
      { id: 'jan', name: 'Jan', color: '#b865e0', sort_order: 0 },
    ])
    expect(personIds()).toEqual(['jan', 'ola'])
    expect(personLabel('ola')).toBe('Ola')
    expect(personColor('jan')).toBe('#b865e0')
    expect(zeroByPerson()).toEqual({ jan: 0, ola: 0 })
    // someone no longer in the budget still reads as a name
    expect(personLabel('kasia')).toBe('Kasia')
    expect(personLabel(null)).toBe('')
  })

  it('keeps the same list without telling anyone', () => {
    const before = getPeople()
    setPeople([...LEGACY_PEOPLE])
    expect(getPeople()).toBe(before)
  })

  it('makes an id from a name, unique and database-safe', () => {
    expect(personIdFor('Anna', [])).toBe('anna')
    expect(personIdFor('Łukasz Żak', [])).toBe('lukasz-zak')
    expect(personIdFor('Zoë', [])).toBe('zoe')
    expect(personIdFor('Anna', ['anna', 'anna-2'])).toBe('anna-3')
    expect(personIdFor('💖', [])).toBe('person')
    expect(personIdFor('A'.repeat(40), [])).toMatch(/^[a-z0-9-]{1,24}$/)
  })
})
