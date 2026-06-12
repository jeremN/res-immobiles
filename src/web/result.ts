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

// Chemin couvert : geo non-null, couverture déjà décidée par l'appelant (server function).
export function buildResult(input: VerdictFnInput, geo: GeoOne, deps: Deps): VerdictResult {
  const fiche = getVerdict(
    { insee: geo.citycode, typeLocal: input.typeLocal, surface: input.surface,
      prixDemande: input.prix, classeDpe: input.classeDpe, profilAides: input.profilAides, classeCible: 'D' },
    deps,
  )
  return { couverte: true, fiche }
}
