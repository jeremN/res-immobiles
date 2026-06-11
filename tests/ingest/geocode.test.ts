import { describe, it, expect } from 'vitest'
import { parseGeocodeCsv, csvField } from '../../src/ingest/geocode'

describe('parseGeocodeCsv', () => {
  it('mappe key -> {banId, type, citycode} depuis la sortie BAN', () => {
    const csv = 'key,adresse,result_id,result_type,result_citycode\n' +
                '"8 RUE CHAUDRIER|17000","8 RUE CHAUDRIER 17000 LA ROCHELLE",17300_1750_00008,housenumber,17300\n'
    const m = parseGeocodeCsv(csv)
    expect(m.get('8 RUE CHAUDRIER|17000')).toEqual({ banId: '17300_1750_00008', type: 'housenumber', citycode: '17300' })
  })
})

describe('csvField', () => {
  it('échappe les guillemets en doublant (RFC 4180)', () => {
    expect(csvField('rue "des" lilas')).toBe('"rue ""des"" lilas"')
  })
  it('round-trip: une clé contenant un guillemet survit au parse', () => {
    const csv = 'key,adresse,result_id,result_type,result_citycode\n' +
                csvField('K"1') + ',x,IDX,housenumber,17300\n'
    expect(parseGeocodeCsv(csv).get('K"1')?.banId).toBe('IDX')
  })
})
