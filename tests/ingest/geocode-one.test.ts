import { describe, it, expect } from 'vitest'
import { parseBanSearch } from '../../src/ingest/geocode'

describe('parseBanSearch', () => {
  it('extrait citycode + dept + banId de la réponse BAN /search', () => {
    const json = { features: [{ properties: { id: '17300_1750_00008', citycode: '17300', type: 'housenumber' } }] }
    expect(parseBanSearch(json)).toEqual({ citycode: '17300', dept: '17', banId: '17300_1750_00008' })
  })
  it('renvoie null si aucun résultat', () => {
    expect(parseBanSearch({ features: [] })).toBeNull()
  })
})
