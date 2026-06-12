import type { Profil } from '../regulatory/ruleset'

export const DPE_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
export const TYPES = ['Maison', 'Appartement'] as const

export const PROFIL_OPTIONS: { value: Profil; label: string }[] = [
  { value: 'rose', label: 'Supérieurs (rose)' },
  { value: 'violet', label: 'Intermédiaires (violet)' },
  { value: 'jaune', label: 'Modestes (jaune)' },
  { value: 'bleu', label: 'Très modestes (bleu)' },
]

export interface FormState {
  adresse: string; prix: string; surface: string
  classeDpe: string; typeLocal: string; etage: string; profil: string
}

export function parseNum(s: string): number | null {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

export interface FormValidity {
  ok: boolean
  fields: { adresse: boolean; prix: boolean; surface: boolean; classeDpe: boolean }
}

export function validateForm(f: FormState): FormValidity {
  const fields = {
    adresse: f.adresse.trim().length > 0,
    prix: parseNum(f.prix) !== null,
    surface: parseNum(f.surface) !== null,
    classeDpe: (DPE_CLASSES as readonly string[]).includes(f.classeDpe),
  }
  return { ok: Object.values(fields).every(Boolean), fields }
}
