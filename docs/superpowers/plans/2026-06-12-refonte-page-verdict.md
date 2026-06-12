# Refonte page Verdict (direction chaleureuse) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer la page Verdict d'un prototype non stylé en outil crédible (direction « chaleureuse rassurante »), corriger les 3 P1 (saisies libres, esthétique, erreurs) et 2 P2 (jargon profil, hiérarchie) de la critique.

**Architecture:** Un système de design tokenisé (`src/styles.css`, OKLCH/hex, importé dans `__root`) remplace les styles inline et débloque les états `:hover`/`:focus`/`:active`. La logique de formulaire est extraite en helpers purs testables (`src/web/form.ts`). Les saisies contraintes (segmenté DPE/Type, select Profil) suppriment les champs texte libres. La page gagne validation-gated submit, try/catch, `<form>`, `aria-live`.

**Tech Stack:** TanStack Start (React 19, Vite), TypeScript ESM, CSS natif (tokens + `:has()`), Vitest, pnpm. Zéro lib UI, zéro webfont.

---

## Préconditions
- Sous-projet 2 livré : `src/routes/index.tsx`, `src/routes/__root.tsx`, `src/components/{Field,Fiche}.tsx`, `src/web/{result,fiche-format,verdict.fn}.ts`, `src/regulatory/ruleset.ts` (exporte `Classe`, `Profil`).
- Référence design : `docs/superpowers/specs/2026-06-12-refonte-page-verdict-design.md`.
- Suite verte au départ (`pnpm test` → 43+).

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `src/styles.css` | Tokens + classes composants | Créer |
| `src/routes/__root.tsx` | Importer le CSS, body via tokens | Modifier |
| `src/web/form.ts` | Logique pure (validation, options) | Créer |
| `tests/web/form.test.ts` | Tests de `form.ts` | Créer |
| `src/components/Segmented.tsx` | Contrôle segmenté (radios natifs stylés) | Créer |
| `src/components/Field.tsx` | Input via classes + inputMode + error | Modifier |
| `src/routes/index.tsx` | Saisies contraintes + layout + erreur + a11y | Modifier |
| `src/components/Fiche.tsx` | Restyle via classes, emphase des chiffres | Modifier |

---

### Task 1: Système de design (`styles.css` + `__root`)

**Files:**
- Create: `src/styles.css`
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Créer `src/styles.css`**

```css
:root {
  --bg: #fdfcfb;
  --surface: #ffffff;
  --ink: #1c1a17;
  --muted: #6b6358;
  --border: #e7e2db;
  --border-hover: #d8d1c7;
  --accent: #c2410c;
  --accent-hover: #9a3412;
  --accent-weak: #fbeae1;
  --ok: #15803d;
  --ok-weak: #e7f3eb;
  --warn: #b45309;
  --warn-weak: #f7ecdd;
  --bad: #b91c1c;
  --bad-weak: #f7e3e3;
  --radius: 8px;
  --radius-lg: 12px;
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px;
  --t-h1: 2rem; --t-h2: 1.25rem; --t-sm: 0.8125rem;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --serif: Georgia, "Times New Roman", serif;
}

* { box-sizing: border-box; }

body {
  font-family: var(--sans);
  color: var(--ink);
  background: var(--bg);
  max-width: 760px;
  margin: 0 auto;
  padding: var(--s4);
  line-height: 1.5;
}

h1 {
  font-family: var(--serif);
  font-size: var(--t-h1);
  font-weight: 700;
  letter-spacing: -0.01em;
  text-wrap: balance;
  margin: 0 0 var(--s2);
}

.subtitle { color: var(--muted); margin: 0 0 var(--s4); }

.btn {
  font: inherit;
  font-weight: 600;
  border-radius: var(--radius);
  padding: var(--s2) var(--s4);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color 160ms ease, border-color 160ms ease, transform 80ms ease;
}
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-primary:active:not(:disabled) { transform: translateY(1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost { background: transparent; border-color: var(--border); color: var(--ink); }
.btn-ghost:hover { background: var(--accent-weak); border-color: var(--accent); }

.field { display: flex; flex-direction: column; gap: var(--s1); font-size: var(--t-sm); }
.field > span { color: var(--muted); }
.input {
  font: inherit;
  padding: var(--s2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.input:hover { border-color: var(--border-hover); }
.input:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-weak); }
.input--error { border-color: var(--bad); }
textarea.input { width: 100%; resize: vertical; }
select.input { cursor: pointer; }

.paste { display: flex; flex-direction: column; gap: var(--s2); margin-bottom: var(--s4); }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); align-items: end; }
.stack { display: flex; flex-direction: column; gap: var(--s3); }

.seg { border: 0; margin: 0; padding: 0; min-width: 0; }
.seg__legend { color: var(--muted); font-size: var(--t-sm); padding: 0; margin-bottom: var(--s1); }
.seg__opts { display: flex; flex-wrap: wrap; gap: var(--s1); }
.seg__opt {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--s2) var(--s3);
  cursor: pointer;
  background: var(--surface);
  font-size: var(--t-sm);
  transition: background-color 140ms ease, border-color 140ms ease;
}
.seg__opt:hover { border-color: var(--accent); }
.seg__opt input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.seg__opt:has(input:checked) { border-color: var(--accent); background: var(--accent-weak); color: var(--accent-hover); font-weight: 600; }
.seg__opt:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }

.fiche { margin-top: var(--s5); }
.banner {
  background: var(--warn-weak); border: 1px solid var(--warn);
  border-radius: var(--radius); padding: var(--s3); font-size: var(--t-sm);
  margin-bottom: var(--s4); color: var(--ink);
}
.banner a { color: var(--accent-hover); }
.block { border-top: 1px solid var(--border); padding: var(--s3) 0; }
.block__label { color: var(--muted); font-size: var(--t-sm); margin-bottom: var(--s1); }
.block__value { font-size: 1.0625rem; }
.block__num { font-weight: 700; font-size: 1.25rem; }
.block__conf { color: var(--muted); font-size: var(--t-sm); margin-top: var(--s1); }

.verdict {
  margin-top: var(--s4); padding: var(--s5) var(--s4);
  border-radius: var(--radius-lg); text-align: center;
  background: var(--surface); border: 1.5px solid var(--border);
}
.verdict--ok { background: var(--ok-weak); border-color: var(--ok); }
.verdict--correct { background: var(--warn-weak); border-color: var(--warn); }
.verdict--bad { background: var(--bad-weak); border-color: var(--bad); }
.verdict__label { font-size: var(--t-h2); font-weight: 700; }
.verdict--ok .verdict__label { color: var(--ok); }
.verdict--correct .verdict__label { color: var(--warn); }
.verdict--bad .verdict__label { color: var(--bad); }
.verdict__marge { font-size: 1.5rem; font-weight: 700; margin-top: var(--s1); }
.verdict__formula { color: var(--muted); font-size: var(--t-sm); margin-top: var(--s1); }

.error { margin-top: var(--s5); color: var(--bad); }

@media (max-width: 520px) { .row { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
```

- [ ] **Step 2: Importer le CSS et nettoyer `__root.tsx`**

Remplacer intégralement `src/routes/__root.tsx` par :

```tsx
/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Verdict immo — La Rochelle' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Vérifier le build**

Run: `pnpm build`
Expected: exit 0, le CSS est bundlé (pas d'erreur d'import). `.netlify/v1/functions/server.mjs` + `dist/` produits.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css src/routes/__root.tsx
git commit -m "feat(ui): système de design tokenisé (direction chaleureuse)"
```

---

### Task 2: Logique de formulaire pure (`form.ts`) + tests

**Files:**
- Create: `src/web/form.ts`
- Test: `tests/web/form.test.ts`

- [ ] **Step 1: Écrire le test (échoue)**

```ts
// tests/web/form.test.ts
import { describe, it, expect } from 'vitest'
import { validateForm, parseNum, PROFIL_OPTIONS, DPE_CLASSES, type FormState } from '../../src/web/form'

const base: FormState = { adresse: '8 rue Chaudrier', prix: '430000', surface: '110', classeDpe: 'G', typeLocal: 'Maison', etage: '', profil: 'rose' }

describe('parseNum', () => {
  it('parse les nombres avec espaces et virgule', () => {
    expect(parseNum('430 000')).toBe(430000)
    expect(parseNum('12,5')).toBe(12.5)
    expect(parseNum('110')).toBe(110)
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
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `pnpm vitest run tests/web/form.test.ts`
Expected: FAIL (`Cannot find module '../../src/web/form'`).

- [ ] **Step 3: Implémenter `src/web/form.ts`**

```ts
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
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `pnpm vitest run tests/web/form.test.ts`
Expected: PASS (toutes).

Si TypeScript se plaint que les `value` de `PROFIL_OPTIONS` ne sont pas assignables à `Profil`, vérifier que `Profil` dans `src/regulatory/ruleset.ts` couvre bien `'bleu' | 'jaune' | 'violet' | 'rose'`. Ne PAS modifier `ruleset.ts` ; si le type diffère, aligner les `value` sur les vraies valeurs de `Profil` et adapter le test.

- [ ] **Step 5: Commit**

```bash
git add src/web/form.ts tests/web/form.test.ts
git commit -m "feat(ui): logique de formulaire pure (validation + options)"
```

---

### Task 3: Composant `Segmented` + refonte `Field`

**Files:**
- Create: `src/components/Segmented.tsx`
- Modify: `src/components/Field.tsx`

- [ ] **Step 1: Créer `src/components/Segmented.tsx`**

```tsx
export function Segmented({ legend, name, options, value, onChange }: {
  legend: string
  name: string
  options: readonly { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <fieldset className="seg">
      <legend className="seg__legend">{legend}</legend>
      <div className="seg__opts">
        {options.map((o) => (
          <label key={o.value} className="seg__opt">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 2: Remplacer `src/components/Field.tsx`**

```tsx
export function Field({ label, value, onChange, placeholder, inputMode, error }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'numeric' | 'text'
  error?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className={`input${error ? ' input--error' : ''}`}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
```

- [ ] **Step 3: Vérifier le build**

Run: `pnpm build`
Expected: exit 0 (les composants compilent ; `Field` est encore consommé par `index.tsx` avec l'ancienne signature — compatible car les nouveaux props sont optionnels).

- [ ] **Step 4: Commit**

```bash
git add src/components/Segmented.tsx src/components/Field.tsx
git commit -m "feat(ui): composant Segmented + Field via classes"
```

---

### Task 4: Page — saisies contraintes, layout, erreur, a11y

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Remplacer intégralement `src/routes/index.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { parseAnnonce } from '../parse/annonce'
import { getVerdictFn } from '../web/verdict.fn'
import { Field } from '../components/Field'
import { Segmented } from '../components/Segmented'
import { Fiche } from '../components/Fiche'
import { DPE_CLASSES, TYPES, PROFIL_OPTIONS, validateForm, parseNum, type FormState } from '../web/form'
import type { VerdictResult } from '../web/result'
import type { Classe, Profil } from '../regulatory/ruleset'

export const Route = createFileRoute('/')({ component: Home })

const DPE_OPTS = DPE_CLASSES.map((c) => ({ value: c, label: c }))
const TYPE_OPTS = TYPES.map((t) => ({ value: t, label: t }))

function Home() {
  const [coll, setColl] = useState('')
  const [f, setF] = useState<FormState>({ adresse: '', prix: '', surface: '', classeDpe: '', typeLocal: 'Maison', etage: '', profil: 'rose' })
  const [res, setRes] = useState<VerdictResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState(false)
  const set = (k: keyof FormState) => (v: string) => setF((s) => ({ ...s, [k]: v }))

  const valid = validateForm(f)

  function analyser() {
    const p = parseAnnonce(coll)
    setF((s) => ({ ...s,
      adresse: p.adresse ?? s.adresse, prix: p.prix?.toString() ?? s.prix,
      surface: p.surface?.toString() ?? s.surface, classeDpe: p.classeDpe ?? s.classeDpe,
      typeLocal: p.typeLocal ?? s.typeLocal, etage: p.etage ?? s.etage }))
  }

  async function verdict(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTouched(true)
    if (!valid.ok) return
    setLoading(true); setErr(null); setRes(null)
    try {
      const r = await getVerdictFn({ data: {
        adresse: f.adresse, prix: parseNum(f.prix)!, surface: parseNum(f.surface)!,
        classeDpe: f.classeDpe as Classe, typeLocal: f.typeLocal as 'Maison' | 'Appartement',
        profilAides: f.profil as Profil, etage: f.etage || undefined } })
      setRes(r)
    } catch {
      setErr('Le service est momentanément indisponible, réessaie dans un instant.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <h1>Bonne affaire ou piège&nbsp;?</h1>
      <p className="subtitle">Colle une annonce (La Rochelle), vérifie les champs, obtiens le verdict — données publiques uniquement.</p>

      <div className="paste">
        <textarea className="input" value={coll} onChange={(e) => setColl(e.target.value)} rows={4} placeholder="Colle ton annonce ici…" />
        <div><button type="button" className="btn btn-ghost" onClick={analyser}>Analyser l'annonce</button></div>
      </div>

      <form className="stack" onSubmit={verdict}>
        <Field label="Adresse" value={f.adresse} onChange={set('adresse')} placeholder="8 rue Chaudrier" error={touched && !valid.fields.adresse} />
        <div className="row">
          <Field label="Prix demandé (€)" value={f.prix} onChange={set('prix')} inputMode="numeric" error={touched && !valid.fields.prix} />
          <Field label="Surface (m²)" value={f.surface} onChange={set('surface')} inputMode="numeric" error={touched && !valid.fields.surface} />
        </div>
        <Segmented legend="Classe DPE" name="dpe" options={DPE_OPTS} value={f.classeDpe} onChange={set('classeDpe')} />
        <div className="row">
          <Segmented legend="Type" name="type" options={TYPE_OPTS} value={f.typeLocal} onChange={set('typeLocal')} />
          {f.typeLocal === 'Appartement' && <Field label="Étage" value={f.etage} onChange={set('etage')} inputMode="numeric" />}
        </div>
        <label className="field">
          <span>Profil de revenus (pour estimer les aides)</span>
          <select className="input" value={f.profil} onChange={(e) => set('profil')(e.target.value)}>
            {PROFIL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <div>
          <button type="submit" className="btn btn-primary" disabled={loading || (touched && !valid.ok)}>
            {loading ? 'Analyse…' : 'Obtenir le verdict'}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {err && <p className="error">{err}</p>}
        {res && (res.couverte
          ? <div className="fiche"><Fiche fiche={res.fiche} classe={f.classeDpe as Classe} /></div>
          : <p className="error">{res.raison === 'hors-zone'
              ? "Cette commune n'est pas encore couverte (lancement : La Rochelle)."
              : 'Adresse non reconnue, vérifie-la.'}</p>)}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Vérifier le build + les tests**

Run: `pnpm build && pnpm test`
Expected: build exit 0 ; suite verte (la logique pure de `form.ts` est couverte ; le rendu n'a pas de test unitaire). Aucune erreur TS sur `FormEvent`, `parseNum`, `Segmented`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat(ui): saisies contraintes + validation + erreur + a11y"
```

---

### Task 5: Fiche restylée + hiérarchie + suite verte

**Files:**
- Modify: `src/components/Fiche.tsx`

- [ ] **Step 1: Remplacer intégralement `src/components/Fiche.tsx`**

```tsx
import type { Fiche as FicheT } from '../verdict/types'
import type { Classe } from '../regulatory/ruleset'
import { verdictDisplay, positionnementText, euros, confianceText, showDpeBanner } from '../web/fiche-format'

const VERDICT_CLASS: Record<FicheT['verdict'], string> = {
  'bonne-affaire': 'verdict--ok',
  correct: 'verdict--correct',
  piege: 'verdict--bad',
  indetermine: '',
}

export function Fiche({ fiche, classe }: { fiche: FicheT; classe: Classe }) {
  const v = verdictDisplay(fiche.verdict)
  return (
    <div>
      {showDpeBanner(classe) && (
        <div className="banner">
          Ton DPE date peut-être d'avant 2026. Avec le nouveau coefficient électricité, ta classe a pu s'améliorer sans travaux —{' '}
          <a href="https://observatoire-dpe-audit.ademe.fr/" target="_blank" rel="noreferrer">recalcul gratuit ADEME</a>.
        </div>
      )}

      <div className="block">
        <div className="block__label">Prix vs marché réel</div>
        <div className="block__value">
          <span className="block__num">{euros(fiche.prixM2Demande)}/m²</span> · {positionnementText(fiche.comparable.positionnement)}
          {fiche.comparable.prixM2Median != null && <> (médian {euros(fiche.comparable.prixM2Median)}/m²)</>}
        </div>
        <div className="block__conf">{confianceText(fiche.comparable.confiance, 'ventes')}</div>
      </div>

      <div className="block">
        <div className="block__label">Décote verte (zone)</div>
        <div className="block__value">Classe actuelle {euros(fiche.decote.prixM2ClasseActuelle)}/m² · cible D {euros(fiche.decote.prixM2ClasseCible)}/m²</div>
        <div className="block__conf">{confianceText(fiche.decote.confiance, 'ventes')}</div>
      </div>

      <div className="block">
        <div className="block__label">Coût mise en conformité → D <span>(estimation, pas un devis)</span></div>
        <div className="block__value"><span className="block__num">{euros(fiche.cout.median)}</span> · fourchette {euros(fiche.cout.p25)}–{euros(fiche.cout.p75)}</div>
        <div className="block__conf">{confianceText(fiche.cout.confiance, 'audits')}</div>
      </div>

      <div className="block">
        <div className="block__label">Échéance &amp; aides</div>
        <div className="block__value">{fiche.echeance.dateInterdiction
          ? `Location ${fiche.echeance.enVigueur ? 'interdite depuis' : 'interdite à partir du'} ${fiche.echeance.dateInterdiction}`
          : "Pas d’échéance d’interdiction"}</div>
        <div className="block__value">Aides estimées : {euros(fiche.aides.montant)}</div>
      </div>

      <div className={`verdict ${VERDICT_CLASS[fiche.verdict]}`}>
        <div className="verdict__label">{v.label}</div>
        {fiche.margePotentielle != null
          ? <div className="verdict__marge">marge ~ {euros(fiche.margePotentielle)}</div>
          : <div className="block__conf">Pas assez de comparables de cette classe pour conclure sur la marge.</div>}
        <div className="verdict__formula">valeur après travaux − prix − coût net d'aides</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier la non-régression complète**

Run: `pnpm test`
Expected: suite entière verte (parseur, géocodage, moteur, fiche-format, result, aggregates, form).

- [ ] **Step 3: Vérifier le build de prod**

Run: `pnpm build`
Expected: exit 0, `.netlify/v1/functions/server.mjs` + `dist/` produits, aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/components/Fiche.tsx
git commit -m "feat(ui): fiche restylée, emphase des chiffres décisifs"
```

---

## Vérification visuelle (orchestrateur, après Task 5)

Hors subagents — l'orchestrateur lance `pnpm dev`, capture l'état vide et une fiche La Rochelle (8 rue Chaudrier, 430000, 110, G, Maison, rose) via le navigateur, et contrôle : contraste du corps de texte, états `:hover`/`:focus` visibles, segmenté DPE/Type cliquable, fond quasi-blanc (pas crème), bloc verdict coloré. Puis revue de code finale, et déploiement de la version soignée.

## Self-Review (auteur du plan)
- **Couverture spec** : §3 design system → Task 1 ; §4 saisies → Tasks 2-4 ; §5 erreur/a11y → Task 4 ; §6 hiérarchie → Task 4 (form) + Task 5 (fiche) ; §7 tests → Task 2 (form) + Tasks 4-5 (suite verte) + vérif visuelle. ✓
- **Cohérence des types** : `FormState`/`validateForm`/`parseNum`/`PROFIL_OPTIONS`/`DPE_CLASSES`/`TYPES` définis Task 2, consommés identiquement Tasks 3-4. `Segmented` signature définie Task 3, appelée Task 4. `Field` props optionnels → rétro-compatible. `Profil`/`Classe` importés de `ruleset`. ✓
- **Pas de placeholder** : code complet à chaque étape (CSS, TS, TSX). ✓
- **Risque connu** : `:has()` CSS (segmenté) — supporté par les navigateurs courants 2026 ; acceptable pour un MVP. Si support requis plus large, replier sur une classe togglée en JS (non nécessaire ici).
