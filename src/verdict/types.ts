import type { Classe, Profil, Echeance } from '../regulatory/ruleset'

export interface VerdictInput {
  insee: string
  typeLocal: 'Maison' | 'Appartement'
  surface: number
  prixDemande: number
  classeDpe: Classe
  profilAides: Profil
  classeCible?: Classe // défaut 'D'
}

export interface Confiance { n: number; niveau: 'haute' | 'moyenne' | 'faible' }

export interface Fiche {
  prixM2Demande: number
  comparable: { prixM2Median: number | null; positionnement: 'sous-cote' | 'dans-le-marche' | 'sur-cote' | 'inconnu'; confiance: Confiance }
  decote: { prixM2ClasseActuelle: number | null; prixM2ClasseCible: number | null; confiance: Confiance }
  cout: { median: number | null; p25: number | null; p75: number | null; confiance: Confiance }
  echeance: Echeance
  aides: { montant: number }
  margePotentielle: number | null
  verdict: 'bonne-affaire' | 'correct' | 'piege' | 'indetermine'
}
