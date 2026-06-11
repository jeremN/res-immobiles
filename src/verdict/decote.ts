export interface DecoteRow { insee: string; typeLocal: string; etiquette: string | null; prixM2: number | null }
export interface ZoneDecoteAgg { insee: string; typeLocal: string; etiquette: string; prixM2Median: number; n: number }

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function computeZoneDecote(rows: DecoteRow[]): ZoneDecoteAgg[] {
  const groups = new Map<string, number[]>()
  for (const r of rows) {
    if (!r.etiquette || r.prixM2 == null) continue
    const key = `${r.insee}|${r.typeLocal}|${r.etiquette}`
    ;(groups.get(key) ?? groups.set(key, []).get(key)!).push(r.prixM2)
  }
  return [...groups.entries()].map(([key, vals]) => {
    const [insee, typeLocal, etiquette] = key.split('|')
    return { insee, typeLocal, etiquette, prixM2Median: median(vals), n: vals.length }
  })
}
