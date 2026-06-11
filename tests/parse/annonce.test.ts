import { describe, it, expect } from 'vitest'
import { parseAnnonce } from '../../src/parse/annonce'

describe('parseAnnonce', () => {
  it("extrait prix, surface, classe DPE, type et adresse d'une annonce typique", () => {
    const t = "Maison 110 m² à vendre, 8 rue Chaudrier, La Rochelle. DPE : G. Prix 430 000 €."
    expect(parseAnnonce(t)).toMatchObject({
      typeLocal: 'Maison', surface: 110, classeDpe: 'G', prix: 430000, adresse: '8 rue Chaudrier',
    })
  })
  it('gère un appartement T3 avec étage', () => {
    const t = "Appartement T3, 65 m², 2ème étage, DPE E, 245 000 €, avenue Carnot"
    expect(parseAnnonce(t)).toMatchObject({ typeLocal: 'Appartement', surface: 65, pieces: 3, etage: '2', classeDpe: 'E', prix: 245000 })
  })
  it("n'invente rien sur un texte vague (champs absents = undefined)", () => {
    const out = parseAnnonce("Joli bien lumineux, proche commerces.")
    expect(out.prix).toBeUndefined()
    expect(out.surface).toBeUndefined()
    expect(out.classeDpe).toBeUndefined()
  })
})
