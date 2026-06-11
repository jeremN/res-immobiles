// Parse la sortie CSV du géocodeur BAN en masse. CSV via un parseur tolérant aux guillemets.
export interface GeoResult { banId: string; type: string; citycode: string }

export function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (c === ',' && !q) { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur); return out
}

export function csvField(s: string): string {
  return `"${s.replace(/"/g, '""')}"`
}

export function parseGeocodeCsv(csv: string): Map<string, GeoResult> {
  const lines = csv.trim().split('\n')
  const header = splitCsvLine(lines[0])
  const ix = (n: string) => header.indexOf(n)
  const m = new Map<string, GeoResult>()
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsvLine(lines[i])
    m.set(f[ix('key')], { banId: f[ix('result_id')] ?? '', type: f[ix('result_type')] ?? '', citycode: f[ix('result_citycode')] ?? '' })
  }
  return m
}

export async function geocodeBatch(addrs: { key: string; adresse: string }[]): Promise<Map<string, GeoResult>> {
  const csv = 'key,adresse\n' + addrs.map((a) => `${csvField(a.key)},${csvField(a.adresse)}`).join('\n')
  const form = new FormData()
  form.append('data', new Blob([csv], { type: 'text/csv' }), 'a.csv')
  form.append('columns', 'adresse')
  const res = await fetch('https://api-adresse.data.gouv.fr/search/csv/', { method: 'POST', body: form })
  return parseGeocodeCsv(await res.text())
}

export interface GeoOne { citycode: string; dept: string; banId: string }

export function parseBanSearch(json: any): GeoOne | null {
  const f = json?.features?.[0]
  if (!f) return null
  const citycode = f.properties?.citycode ?? ''
  if (!citycode) return null
  return { citycode, dept: citycode.slice(0, 2), banId: f.properties?.id ?? '' }
}

export async function geocodeOne(adresse: string): Promise<GeoOne | null> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`
  const res = await fetch(url)
  if (!res.ok) return null
  return parseBanSearch(await res.json())
}
