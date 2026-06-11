import { describe, it, expect } from 'vitest'
import { labelDvfWithDpe } from '../../src/ingest/load'

describe('labelDvfWithDpe', () => {
  it('étiquette une vente maison par le DPE maison à la même adresse BAN (surface la plus proche)', () => {
    const dvf = [{ adresseKey: 'A|17000', banId: 'B1', typeLocal: 'Maison', surfaceReelle: 100 } as any]
    const dpeByBan = new Map([['B1', [{ type_batiment: 'maison', etiquette_dpe: 'E', surface_habitable_logement: 98 },
                                       { type_batiment: 'maison', etiquette_dpe: 'C', surface_habitable_logement: 60 }]]])
    const out = labelDvfWithDpe(dvf, dpeByBan)
    expect(out[0].etiquetteDpe).toBe('E') // 98 plus proche de 100 que 60
  })
  it("étiquette un appartement par le DPE appartement (ignore les DPE maison à la même adresse)", () => {
    const dvf = [{ adresseKey: 'A|17000', banId: 'B1', typeLocal: 'Appartement', surfaceReelle: 50 } as any]
    const dpeByBan = new Map([['B1', [
      { type_batiment: 'maison', etiquette_dpe: 'A', surface_habitable_logement: 50 },
      { type_batiment: 'appartement', etiquette_dpe: 'F', surface_habitable_logement: 52 },
    ]]])
    expect(labelDvfWithDpe(dvf, dpeByBan)[0].etiquetteDpe).toBe('F')
  })
  it('renvoie null quand banId est null (pas de candidat)', () => {
    const dvf = [{ adresseKey: 'A|17000', banId: null, typeLocal: 'Maison', surfaceReelle: 100 } as any]
    expect(labelDvfWithDpe(dvf, new Map())[0].etiquetteDpe).toBeNull()
  })
  it("renvoie null quand aucun DPE du bon type à l'adresse", () => {
    const dvf = [{ adresseKey: 'A|17000', banId: 'B1', typeLocal: 'Maison', surfaceReelle: 100 } as any]
    const dpeByBan = new Map([['B1', [{ type_batiment: 'appartement', etiquette_dpe: 'C', surface_habitable_logement: 100 }]]])
    expect(labelDvfWithDpe(dvf, dpeByBan)[0].etiquetteDpe).toBeNull()
  })
})
