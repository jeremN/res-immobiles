import type { Classe } from '../regulatory/ruleset'

export interface AnnonceFields {
  adresse?: string; prix?: number; surface?: number
  classeDpe?: Classe; typeLocal?: 'Maison' | 'Appartement'; etage?: string; pieces?: number
}

const VOIES = 'rue|avenue|av|bd|boulevard|impasse|quai|place|allée|allee|chemin|cours'

export function parseAnnonce(texte: string): AnnonceFields {
  const t = texte.replace(/ /g, ' ')
  const out: AnnonceFields = {}

  const prix = t.match(/(\d[\d .]{3,})\s*€/)
  if (prix) {
    const n = Number(prix[1].replace(/[ .]/g, ''))
    if (n >= 1000) out.prix = n
  }
  const surf = t.match(/(\d{1,4})\s*m(?:²|2)(?![a-z0-9])/i)
  if (surf) { const s = Number(surf[1]); if (s >= 8 && s <= 2000) out.surface = s }

  const dpe = t.match(/\bDPE\s*:?\s*([A-G])\b/i) || t.match(/\b([A-G])\s*\/\s*[A-G]\b/)
  if (dpe) out.classeDpe = dpe[1].toUpperCase() as Classe

  if (/\bmaison\b/i.test(t)) out.typeLocal = 'Maison'
  else if (/\bappartement\b|\bappart\b|\bT\d\b/i.test(t)) out.typeLocal = 'Appartement'

  const piece = t.match(/\bT(\d)\b/i) || t.match(/(\d)\s*pi[eè]ces?/i)
  if (piece) out.pieces = Number(piece[1])

  if (/rez[- ]de[- ]chauss/i.test(t)) out.etage = '0'
  else { const et = t.match(/(\d{1,2})\s*(?:e|è|ème|er)?\s*étage/i); if (et) out.etage = et[1] }

  const adr = t.match(new RegExp(`(\\d{1,4}(?:\\s*(?:bis|ter))?\\s+(?:${VOIES})\\s+[^,.\\n]+)`, 'i'))
  if (adr) out.adresse = adr[1].trim().replace(/\s+/g, ' ')

  return out
}
