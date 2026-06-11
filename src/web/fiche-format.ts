import type { Fiche } from '../verdict/types'
import type { Classe } from '../regulatory/ruleset'

export function verdictDisplay(v: Fiche['verdict']): { label: string; color: string } {
  switch (v) {
    case 'bonne-affaire': return { label: 'Bonne affaire', color: '#16a34a' }
    case 'correct': return { label: 'Correct', color: '#d97706' }
    case 'piege': return { label: 'Piège', color: '#dc2626' }
    default: return { label: 'Indéterminé', color: '#6b7280' }
  }
}

export function positionnementText(p: Fiche['comparable']['positionnement']): string {
  return { 'sous-cote': 'sous-coté', 'sur-cote': 'sur-coté', 'dans-le-marche': 'dans le marché', inconnu: 'inconnu' }[p]
}

export function euros(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${Math.round(n).toLocaleString('fr-FR').replace(/[  \s]/g, ' ')} €`
}

export function confianceText(c: { n: number; niveau: string }, nom: string): string {
  const base = `${c.n} ${nom}`
  return c.niveau === 'faible' ? `${base} — à prendre avec prudence` : base
}

export function showDpeBanner(classe: Classe): boolean {
  return classe === 'E' || classe === 'F' || classe === 'G'
}
