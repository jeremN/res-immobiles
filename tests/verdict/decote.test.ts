import { describe, it, expect } from 'vitest'
import { computeZoneDecote } from '../../src/verdict/decote'

const rows = [
  { insee: '17300', typeLocal: 'Maison', etiquette: 'D', prixM2: 4700 },
  { insee: '17300', typeLocal: 'Maison', etiquette: 'D', prixM2: 4740 },
  { insee: '17300', typeLocal: 'Maison', etiquette: 'G', prixM2: 4200 },
  { insee: '17300', typeLocal: 'Maison', etiquette: 'G', prixM2: 4360 },
]

describe('computeZoneDecote', () => {
  it('regroupe par insee×type×classe et sort la médiane €/m² + n', () => {
    const out = computeZoneDecote(rows)
    const d = out.find((x) => x.etiquette === 'D')!
    const g = out.find((x) => x.etiquette === 'G')!
    expect(d).toMatchObject({ insee: '17300', typeLocal: 'Maison', prixM2Median: 4720, n: 2 })
    expect(g.prixM2Median).toBe(4280)
  })
  it('ignore les lignes sans prixM2 ou sans étiquette', () => {
    const out = computeZoneDecote([{ insee: '17300', typeLocal: 'Maison', etiquette: null, prixM2: 5000 } as any])
    expect(out).toHaveLength(0)
  })
})
