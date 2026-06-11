import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseDvfCsv } from '../../src/ingest/sources'

describe('parseDvfCsv', () => {
  it('ne garde que Vente + Maison/Appartement et calcule prixM2', () => {
    const rows = parseDvfCsv(readFileSync('fixtures/dvf-sample.csv', 'utf8'))
    expect(rows).toHaveLength(2)
    const maison = rows.find((r) => r.typeLocal === 'Maison')!
    expect(maison.prixM2).toBeCloseTo(400000 / 110, 0)
    expect(maison.insee).toBe('17300')
  })
})
