// Ruleset réglementaire DATÉ. Source de vérité du moat. Re-vérifier à chaque date d'effet.
// Dernière vérification : 2026-06-11. Sources : service-public A17975 ; ecologie.gouv.fr (réforme DPE 2026).
export const RULESET_VERSION = '2026-06-11'
export const DATE_DU_JOUR = '2026-06-11' // injecté ; remplacé par l'horloge réelle à l'exécution

export type Classe = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export type Territoire = 'metropole' | 'outremer'

const CALENDRIER: Record<Territoire, Partial<Record<Classe, string>>> = {
  metropole: { G: '2025-01-01', F: '2028-01-01', E: '2034-01-01' },
  outremer: { G: '2028-01-01', F: '2031-01-01', E: '2034-01-01' },
}

export interface Echeance {
  classe: Classe
  dateInterdiction: string | null
  enVigueur: boolean
}

export function getEcheanceInterdiction(classe: Classe, territoire: Territoire): Echeance {
  const date = CALENDRIER[territoire][classe] ?? null
  return { classe, dateInterdiction: date, enVigueur: date !== null && date <= DATE_DU_JOUR }
}

export type Profil = 'bleu' | 'jaune' | 'violet' | 'rose'
// Taux indicatifs « rénovation d'ampleur » MaPrimeRénov 2026 (à affiner avec le barème Anah).
const TAUX_AIDE: Record<Profil, number> = { bleu: 0.8, jaune: 0.6, violet: 0.45, rose: 0.3 }

export function estimateAides(input: { profil: Profil; coutTravaux: number }): { montant: number; tauxApplique: number } {
  const taux = TAUX_AIDE[input.profil]
  return { montant: Math.min(input.coutTravaux, Math.round(input.coutTravaux * taux)), tauxApplique: taux }
}
