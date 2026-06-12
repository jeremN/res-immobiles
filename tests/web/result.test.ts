import { describe, it, expect } from 'vitest'
import { buildResult } from '../../src/web/result'
import type { VerdictFnInput } from '../../src/web/result'
import type { GeoOne } from '../../src/ingest/geocode'

const deps = {
  zoneDecote: [
    { insee: '17300', typeLocal: 'Maison', etiquette: 'G', prixM2Median: 4375, n: 61 },
    { insee: '17300', typeLocal: 'Maison', etiquette: 'D', prixM2Median: 4811, n: 387 },
  ],
  coutTravaux: [{ dept: '17', classeCible: 'D', trancheSurface: '90-120', coutMedian: 32232, coutP25: 21382, coutP75: 42385, n: 40 }],
}
const geo: GeoOne = { citycode: '17300', dept: '17', banId: 'x' }
const input: VerdictFnInput = { adresse: '8 rue Chaudrier', prix: 430000, surface: 110, classeDpe: 'G', typeLocal: 'Maison', profilAides: 'rose' }

describe('buildResult', () => {
  it('couverte + fiche cohérente pour La Rochelle', () => {
    const r = buildResult(input, geo, deps)
    expect(r.couverte).toBe(true)
    const fiche = (r as Extract<typeof r, { couverte: true }>).fiche
    expect(fiche.verdict).toBe('bonne-affaire')
    expect(fiche.echeance.enVigueur).toBe(true)
  })
  it('commune sans comparable → couverte mais verdict indéterminé', () => {
    const r = buildResult(input, geo, { zoneDecote: [], coutTravaux: [] })
    expect(r.couverte).toBe(true)
    const fiche = (r as Extract<typeof r, { couverte: true }>).fiche
    expect(fiche.verdict).toBe('indetermine')
    expect(fiche.margePotentielle).toBeNull()
  })
})
