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
})
