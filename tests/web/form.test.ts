import { describe, it, expect } from 'vitest'
import { validateForm, parseNum, PROFIL_OPTIONS, DPE_CLASSES, type FormState } from '../../src/web/form'

const base: FormState = { adresse: '8 rue Chaudrier', prix: '430000', surface: '110', classeDpe: 'G', typeLocal: 'Maison', etage: '', profil: 'rose' }

describe('parseNum', () => {
  it('parse les nombres avec espaces et virgule', () => {
    expect(parseNum('430 000')).toBe(430000)
    expect(parseNum('12,5')).toBe(12.5)
    expect(parseNum('110')).toBe(110)
    expect(parseNum('1 000,50')).toBe(1000.5)
  })
  it('rejette vide, zéro, négatif, non-numérique', () => {
    expect(parseNum('')).toBeNull()
    expect(parseNum('0')).toBeNull()
    expect(parseNum('-1')).toBeNull()
    expect(parseNum('abc')).toBeNull()
  })
})

describe('validateForm', () => {
  it('accepte un formulaire valide', () => {
    expect(validateForm(base).ok).toBe(true)
  })
  it('rejette une adresse vide', () => {
    const r = validateForm({ ...base, adresse: '   ' })
    expect(r.fields.adresse).toBe(false)
    expect(r.ok).toBe(false)
  })
  it('rejette prix/surface invalides', () => {
    expect(validateForm({ ...base, prix: '' }).fields.prix).toBe(false)
    expect(validateForm({ ...base, surface: 'abc' }).fields.surface).toBe(false)
  })
  it('rejette une classe hors A–G', () => {
    expect(validateForm({ ...base, classeDpe: 'Z' }).fields.classeDpe).toBe(false)
    expect(validateForm({ ...base, classeDpe: '' }).ok).toBe(false)
  })
})

describe('options', () => {
  it('PROFIL_OPTIONS: 4 entrées, rose en tête, libellé par le sens', () => {
    expect(PROFIL_OPTIONS).toHaveLength(4)
    expect(PROFIL_OPTIONS[0].value).toBe('rose')
    expect(PROFIL_OPTIONS[0].label).toContain('Supérieurs')
  })
  it('DPE_CLASSES couvre A à G', () => {
    expect(DPE_CLASSES).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  })
})
