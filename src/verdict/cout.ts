export interface AuditRow { classeBilan: string | null; surface: number | null; coutCumule: number | null }
export interface CoutAgg { classeCible: string; trancheSurface: string; coutMedian: number; coutP25: number; coutP75: number; n: number }

export function trancheSurface(s: number): string {
  const lo = Math.floor(s / 30) * 30
  return `${lo}-${lo + 30}`
}

function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const base = Math.floor(pos)
  return s[base + 1] !== undefined ? s[base] + (pos - base) * (s[base + 1] - s[base]) : s[base]
}

export function computeCoutTravaux(audits: AuditRow[]): CoutAgg[] {
  const groups = new Map<string, number[]>()
  for (const a of audits) {
    if (!a.classeBilan || a.surface == null || a.coutCumule == null || a.coutCumule <= 0) continue
    const key = `${a.classeBilan}|${trancheSurface(a.surface)}`
    ;(groups.get(key) ?? groups.set(key, []).get(key)!).push(a.coutCumule)
  }
  return [...groups.entries()].map(([key, vals]) => {
    const [classeCible, trancheSurface] = key.split('|')
    return { classeCible, trancheSurface, coutMedian: quantile(vals, 0.5), coutP25: quantile(vals, 0.25), coutP75: quantile(vals, 0.75), n: vals.length }
  })
}
