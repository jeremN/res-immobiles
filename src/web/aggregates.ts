import data from './aggregates.lr.json'
import type { Deps } from '../verdict/engine'

// Sert les agrégats empaquetés (lecture seule), sans Postgres au runtime.
// Le filtre insee/dept reproduit les WHERE de loadDeps → remplacement transparent.
export function getDeps(insee: string, dept: string): Deps {
  return {
    zoneDecote: data.zoneDecote.filter((z) => z.insee === insee),
    coutTravaux: data.coutTravaux.filter((c) => c.dept === dept),
  } as Deps
}
