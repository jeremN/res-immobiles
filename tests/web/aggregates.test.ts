import { describe, it, expect } from 'vitest'
import { getDeps } from '../../src/web/aggregates'

describe('getDeps', () => {
  it('renvoie des agrégats non vides pour La Rochelle (17300 / dept 17)', () => {
    const deps = getDeps('17300', '17')
    expect(deps.zoneDecote.length).toBeGreaterThan(0)
    expect(deps.coutTravaux.length).toBeGreaterThan(0)
  })

  it('chaque ligne zoneDecote est sur INSEE 17300', () => {
    const deps = getDeps('17300', '17')
    expect(deps.zoneDecote.every((z) => z.insee === '17300')).toBe(true)
  })

  it('chaque ligne coutTravaux est sur le département 17', () => {
    const deps = getDeps('17300', '17')
    expect(deps.coutTravaux.every((c) => c.dept === '17')).toBe(true)
  })

  it('filtre un INSEE inconnu → zoneDecote vide', () => {
    const deps = getDeps('99999', '17')
    expect(deps.zoneDecote.length).toBe(0)
  })
})
