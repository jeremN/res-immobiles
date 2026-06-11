import { getEcheanceInterdiction, estimateAides } from '../regulatory/ruleset'
import { trancheSurface } from './cout'
import type { Fiche, VerdictInput, Confiance } from './types'

interface Deps {
  zoneDecote: { insee: string; typeLocal: string; etiquette: string; prixM2Median: number; n: number }[]
  coutTravaux: { classeCible: string; trancheSurface: string; coutMedian: number; coutP25: number; coutP75: number; n: number }[]
}

function confiance(n: number): Confiance {
  return { n, niveau: n >= 50 ? 'haute' : n >= 15 ? 'moyenne' : 'faible' }
}

function classerVerdict(marge: number | null, prixDemande: number): Fiche['verdict'] {
  if (marge === null) return 'indetermine'
  const ratio = marge / prixDemande
  if (ratio >= 0.15) return 'bonne-affaire'
  if (ratio >= 0) return 'correct'
  return 'piege'
}

export function getVerdict(input: VerdictInput, deps: Deps): Fiche {
  const cible = input.classeCible ?? 'D'
  const prixM2Demande = Math.round(input.prixDemande / input.surface)

  const decZone = deps.zoneDecote.filter((z) => z.insee === input.insee && z.typeLocal === input.typeLocal)
  const dActuelle = decZone.find((z) => z.etiquette === input.classeDpe) ?? null
  const dCible = decZone.find((z) => z.etiquette === cible) ?? null

  const cout = deps.coutTravaux.find((c) => c.classeCible === cible && c.trancheSurface === trancheSurface(input.surface)) ?? null
  const aides = cout ? estimateAides({ profil: input.profilAides, coutTravaux: cout.coutMedian }) : { montant: 0 }
  const coutNet = cout ? cout.coutMedian - aides.montant : null

  const valeurCible = dCible ? dCible.prixM2Median * input.surface : null
  const margePotentielle = valeurCible != null && coutNet != null ? Math.round(valeurCible - input.prixDemande - coutNet) : null

  const positionnement: Fiche['comparable']['positionnement'] = !dActuelle
    ? 'inconnu'
    : prixM2Demande < dActuelle.prixM2Median * 0.95 ? 'sous-cote'
    : prixM2Demande > dActuelle.prixM2Median * 1.05 ? 'sur-cote'
    : 'dans-le-marche'

  return {
    prixM2Demande,
    comparable: { prixM2Median: dActuelle?.prixM2Median ?? null, positionnement, confiance: confiance(dActuelle?.n ?? 0) },
    decote: { prixM2ClasseActuelle: dActuelle?.prixM2Median ?? null, prixM2ClasseCible: dCible?.prixM2Median ?? null, confiance: confiance(dCible?.n ?? 0) },
    cout: { median: cout?.coutMedian ?? null, p25: cout?.coutP25 ?? null, p75: cout?.coutP75 ?? null, confiance: confiance(cout?.n ?? 0) },
    echeance: getEcheanceInterdiction(input.classeDpe, 'metropole'),
    aides,
    margePotentielle,
    verdict: classerVerdict(margePotentielle, input.prixDemande),
  }
}
