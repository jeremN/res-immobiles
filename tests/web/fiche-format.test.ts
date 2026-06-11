import { describe, it, expect } from 'vitest'
import { verdictDisplay, positionnementText, euros, confianceText, showDpeBanner } from '../../src/web/fiche-format'

describe('fiche-format', () => {
  it('verdictDisplay mappe label + couleur', () => {
    expect(verdictDisplay('bonne-affaire')).toEqual({ label: 'Bonne affaire', color: '#16a34a' })
    expect(verdictDisplay('piege').color).toBe('#dc2626')
    expect(verdictDisplay('indetermine').label).toBe('Indéterminé')
  })
  it('positionnementText est lisible', () => {
    expect(positionnementText('sous-cote')).toBe('sous-coté')
    expect(positionnementText('dans-le-marche')).toBe('dans le marché')
  })
  it('euros formate en € français', () => {
    expect(euros(430000)).toBe('430 000 €')
    expect(euros(null)).toBe('—')
  })
  it('confianceText concatène n + nom', () => {
    expect(confianceText({ n: 61, niveau: 'haute' }, 'ventes')).toBe('61 ventes')
  })
  it('showDpeBanner true seulement pour E/F/G', () => {
    expect(showDpeBanner('G')).toBe(true)
    expect(showDpeBanner('D')).toBe(false)
  })
})
