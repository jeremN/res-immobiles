import { describe, it, expect } from 'vitest'
import { buildResult } from '../../src/web/result'
import type { VerdictFnInput } from '../../src/web/result'

const deps = {
  zoneDecote: [
    { insee: '17300', typeLocal: 'Maison', etiquette: 'G', prixM2Median: 4375, n: 61 },
    { insee: '17300', typeLocal: 'Maison', etiquette: 'D', prixM2Median: 4811, n: 387 },
  ],
  coutTravaux: [{ dept: '17', classeCible: 'D', trancheSurface: '90-120', coutMedian: 32232, coutP25: 21382, coutP75: 42385, n: 40 }],
}
const input: VerdictFnInput = { adresse: '8 rue Chaudrier', prix: 430000, surface: 110, classeDpe: 'G', typeLocal: 'Maison', profilAides: 'rose' }

describe('buildResult', () => {
  it('hors zone si citycode ≠ 17300', () => {
    const r = buildResult(input, { citycode: '75056', dept: '75', banId: 'x' }, deps)
    expect(r).toEqual({ couverte: false, raison: 'hors-zone' })
  })
  it('adresse introuvable si geo null', () => {
    expect(buildResult(input, null, deps)).toEqual({ couverte: false, raison: 'adresse-introuvable' })
  })
  it('couverte + fiche cohérente pour La Rochelle', () => {
    const r = buildResult(input, { citycode: '17300', dept: '17', banId: 'x' }, deps)
    expect(r.couverte).toBe(true)
    const fiche = (r as Extract<typeof r, { couverte: true }>).fiche
    expect(fiche.verdict).toBe('bonne-affaire')
    expect(fiche.echeance.enVigueur).toBe(true)
  })
})
