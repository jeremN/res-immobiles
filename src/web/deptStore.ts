import type { Deps } from '../verdict/engine'

export interface DeptAgg {
  dept: string
  zoneDecote: Deps['zoneDecote']
  coutTravaux: Deps['coutTravaux']
}

// Pur : extrait les deps d'une commune depuis l'agrégat du département.
export function pickDeps(agg: DeptAgg, insee: string): Deps {
  return {
    zoneDecote: agg.zoneDecote.filter((z) => z.insee === insee),
    coutTravaux: agg.coutTravaux,
  }
}

// Réseau : 404 → null (dépt non couvert) ; 5xx/réseau → throw (transitoire, récupérable).
export async function fetchDeptAgg(origin: string, dept: string): Promise<DeptAgg | null> {
  const res = await fetch(`${origin}/agg/${dept}.json`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`agg fetch ${dept}: ${res.status}`)
  return (await res.json()) as DeptAgg
}
