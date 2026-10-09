import { describe, expect, it } from 'vitest'
import { featureOfPlace, isOn, readyForNext, type Progress } from './features'
import { visibleGuide } from './guide'
import { TOUR_STEPS, tourSteps } from './tour'

const progress: Progress = {
  daysLogging: 0,
  expenses: 0,
  hasIncome: false,
  hasPlan: false,
  hasSavings: false,
  monthsLogged: 0,
}

describe('isOn', () => {
  it('follows the stage', () => {
    expect(isOn({ stage: 1, overrides: {} }, 'budget')).toBe(false)
    expect(isOn({ stage: 2, overrides: {} }, 'budget')).toBe(true)
    expect(isOn({ stage: 3, overrides: {} }, 'debts')).toBe(false)
    expect(isOn({ stage: 4, overrides: {} }, 'ai')).toBe(true)
  })
  it('lets a switch win either way', () => {
    expect(isOn({ stage: 1, overrides: { debts: true } }, 'debts')).toBe(true)
    expect(isOn({ stage: 4, overrides: { ai: false } }, 'ai')).toBe(false)
  })
})

describe('featureOfPlace', () => {
  it('reads targets before screens', () => {
    expect(featureOfPlace({ route: '/budget', target: 'regular-costs' })).toBe('regular')
    expect(featureOfPlace({ route: '/savings', target: 'savings-goals' })).toBe('savings')
    expect(featureOfPlace({ id: 'fire', route: '/insights', target: '[data-tour="fire"]' })).toBe(
      'fire',
    )
    expect(featureOfPlace({ route: '/history' })).toBeNull()
    expect(featureOfPlace({ id: 'together' })).toBeNull()
  })
})

describe('readyForNext', () => {
  it('wants two weeks of logging before planning', () => {
    expect(readyForNext(1, { ...progress, daysLogging: 10, expenses: 40 })).toBe(false)
    expect(readyForNext(1, { ...progress, daysLogging: 14, expenses: 20 })).toBe(true)
  })
  it('wants a plan and a paycheck before saving', () => {
    expect(readyForNext(2, { ...progress, hasPlan: true })).toBe(false)
    expect(readyForNext(2, { ...progress, hasPlan: true, hasIncome: true })).toBe(true)
  })
  it('has nothing after the last stage', () => {
    expect(readyForNext(4, { ...progress, hasSavings: true, monthsLogged: 9 })).toBe(false)
  })
})

describe('what a stage leaves out of the guide and the tour', () => {
  const stage1 = (f: string) => isOn({ stage: 1, overrides: {} }, f as never)
  it('keeps adding and history at stage 1, without the tabs it hides', () => {
    const steps = tourSteps(stage1)
    expect(steps.some((s) => s.id === 'tiles')).toBe(true)
    expect(steps.some((s) => s.id === 'nav-budget' || s.id === 'net-worth')).toBe(false)
    expect(tourSteps(() => true)).toHaveLength(TOUR_STEPS.length)
    const guide = visibleGuide(stage1)
    expect(guide[0].id).toBe('start')
    expect(guide.flatMap((s) => s.steps).some((s) => s.route === '/savings')).toBe(false)
  })
})
