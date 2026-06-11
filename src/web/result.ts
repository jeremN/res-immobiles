import { getVerdict, type Deps } from '../verdict/engine'
import type { Fiche } from '../verdict/types'
import type { Classe, Profil } from '../regulatory/ruleset'
import type { GeoOne } from '../ingest/geocode'

export interface VerdictFnInput {
  adresse: string; prix: number; surface: number
  classeDpe: Classe; typeLocal: 'Maison' | 'Appartement'; profilAides: Profil
  etage?: string; pieces?: number
}

export type VerdictResult =
  | { couverte: false; raison: 'adresse-introuvable' | 'hors-zone' }
  | { couverte: true; fiche: Fiche }

export function buildResult(input: VerdictFnInput, geo: GeoOne | null, deps: Deps): VerdictResult {
  if (!geo) return { couverte: false, raison: 'adresse-introuvable' }
  if (geo.citycode !== '17300') return { couverte: false, raison: 'hors-zone' }
  const fiche = getVerdict(
    { insee: geo.citycode, typeLocal: input.typeLocal, surface: input.surface,
      prixDemande: input.prix, classeDpe: input.classeDpe, profilAides: input.profilAides, classeCible: 'D' },
    deps,
  )
  return { couverte: true, fiche }
}
