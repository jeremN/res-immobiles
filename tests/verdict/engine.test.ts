import { describe, it, expect } from 'vitest'
import { getVerdict } from '../../src/verdict/engine'
import type { VerdictInput } from '../../src/verdict/types'

const deps = {
  zoneDecote: [
    { insee: '17300', typeLocal: 'Maison', etiquette: 'G', prixM2Median: 4280, n: 57 },
    { insee: '17300', typeLocal: 'Maison', etiquette: 'D', prixM2Median: 4720, n: 387 },
  ],
  coutTravaux: [
    { dept: '17', classeCible: 'D', trancheSurface: '90-120', coutMedian: 28000, coutP25: 20000, coutP75: 38000, n: 40 },
  ],
}

const base: VerdictInput = {
  insee: '17300', typeLocal: 'Maison', surface: 100, prixDemande: 400000,
  classeDpe: 'G', profilAides: 'rose', classeCible: 'D',
}

describe('getVerdict', () => {
  it("calcule la marge = valeur cible − prix − coût net d'aides", () => {
    const f = getVerdict(base, deps)
    expect(f.margePotentielle).toBe(52400)
    expect(f.echeance.classe).toBe('G')
    expect(f.echeance.enVigueur).toBe(true)
    expect(f.prixM2Demande).toBe(4000)
  })
  it('positionne le prix demandé vs comparable classe actuelle', () => {
    const f = getVerdict(base, deps)
    expect(f.comparable.positionnement).toBe('sous-cote')
  })
  it('renvoie indetermine quand aucun comparable cible', () => {
    const f = getVerdict({ ...base, insee: '99999' }, deps)
    expect(f.verdict).toBe('indetermine')
    expect(f.margePotentielle).toBeNull()
  })
  it('decote.confiance reflète le min(n) des deux classes (la plus faible)', () => {
    const f = getVerdict(base, deps)
    expect(f.decote.confiance.n).toBe(57) // min(57 pour G, 387 pour D)
    expect(f.decote.confiance.niveau).toBe('haute') // 57 >= 50
  })
})
