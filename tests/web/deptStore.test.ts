import { describe, it, expect, vi, afterEach } from 'vitest'
import { pickDeps, fetchDeptAgg, type DeptAgg } from '../../src/web/deptStore'

const agg: DeptAgg = {
  dept: '17',
  zoneDecote: [
    { insee: '17300', typeLocal: 'Maison', etiquette: 'G', prixM2Median: 4375, n: 61 },
    { insee: '17300', typeLocal: 'Maison', etiquette: 'D', prixM2Median: 4811, n: 387 },
    { insee: '17137', typeLocal: 'Maison', etiquette: 'D', prixM2Median: 5200, n: 40 },
  ],
  coutTravaux: [{ dept: '17', classeCible: 'D', trancheSurface: '90-120', coutMedian: 32232, coutP25: 21382, coutP75: 42385, n: 40 }],
}

describe('pickDeps', () => {
  it("filtre zoneDecote sur l'insee et garde coutTravaux", () => {
    const d = pickDeps(agg, '17300')
    expect(d.zoneDecote.length).toBe(2)
    expect(d.zoneDecote.every((z) => z.insee === '17300')).toBe(true)
    expect(d.coutTravaux).toEqual(agg.coutTravaux)
  })
  it('insee inconnu → zoneDecote vide', () => {
    expect(pickDeps(agg, '99999').zoneDecote.length).toBe(0)
  })
})

describe('fetchDeptAgg', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('200 → DeptAgg parsé', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(agg), { status: 200 })))
    const r = await fetchDeptAgg('http://x', '17')
    expect(r?.dept).toBe('17')
    expect(r?.zoneDecote.length).toBe(3)
  })
  it('404 → null (non couvert)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    expect(await fetchDeptAgg('http://x', '67')).toBeNull()
  })
  it('500 → throw (erreur transitoire)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    await expect(fetchDeptAgg('http://x', '17')).rejects.toThrow()
  })
})
