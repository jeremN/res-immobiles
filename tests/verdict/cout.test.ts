import { describe, it, expect } from 'vitest'
import { computeCoutTravaux, trancheSurface } from '../../src/verdict/cout'

describe('trancheSurface', () => {
  it('range par tranches de 30 m²', () => {
    expect(trancheSurface(75)).toBe('60-90')
    expect(trancheSurface(30)).toBe('30-60')
  })
})

describe('computeCoutTravaux', () => {
  it('médiane + p25/p75 par classe-cible × tranche', () => {
    const audits = [
      { classeBilan: 'D', surface: 75, coutCumule: 20000 },
      { classeBilan: 'D', surface: 80, coutCumule: 28000 },
      { classeBilan: 'D', surface: 70, coutCumule: 36000 },
    ]
    const out = computeCoutTravaux(audits)
    const d = out.find((x) => x.classeCible === 'D' && x.trancheSurface === '60-90')!
    expect(d.coutMedian).toBe(28000)
    expect(d.n).toBe(3)
    expect(d.coutP25).toBeLessThanOrEqual(d.coutMedian)
    expect(d.coutP75).toBeGreaterThanOrEqual(d.coutMedian)
  })
})
