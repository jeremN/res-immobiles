import { describe, it, expect } from 'vitest'
import { getEcheanceInterdiction, RULESET_VERSION, estimateAides } from '../../src/regulatory/ruleset'

describe('getEcheanceInterdiction (métropole, droit en vigueur 2026)', () => {
  it('G interdit depuis 2025-01-01', () => {
    expect(getEcheanceInterdiction('G', 'metropole')).toEqual({ classe: 'G', dateInterdiction: '2025-01-01', enVigueur: true })
  })
  it('F interdit au 2028-01-01 (à venir)', () => {
    expect(getEcheanceInterdiction('F', 'metropole')).toEqual({ classe: 'F', dateInterdiction: '2028-01-01', enVigueur: false })
  })
  it('E interdit au 2034-01-01', () => {
    expect(getEcheanceInterdiction('E', 'metropole').dateInterdiction).toBe('2034-01-01')
  })
  it("D et mieux : pas d'échéance", () => {
    expect(getEcheanceInterdiction('D', 'metropole').dateInterdiction).toBeNull()
  })
  it('outre-mer : G au 2028-01-01', () => {
    expect(getEcheanceInterdiction('G', 'outremer').dateInterdiction).toBe('2028-01-01')
  })
  it('le ruleset est versionné et daté', () => {
    expect(RULESET_VERSION).toMatch(/^2026-/)
  })
})

describe('estimateAides (MaPrimeRénov 2026, ordre de grandeur)', () => {
  it('profil bleu (très modeste) > profil rose (supérieur) pour le même coût', () => {
    const bleu = estimateAides({ profil: 'bleu', coutTravaux: 30000 })
    const rose = estimateAides({ profil: 'rose', coutTravaux: 30000 })
    expect(bleu.montant).toBeGreaterThan(rose.montant)
    expect(bleu.montant).toBeLessThanOrEqual(30000)
  })
  it('plafonné au coût des travaux', () => {
    expect(estimateAides({ profil: 'bleu', coutTravaux: 1000 }).montant).toBeLessThanOrEqual(1000)
  })
})
