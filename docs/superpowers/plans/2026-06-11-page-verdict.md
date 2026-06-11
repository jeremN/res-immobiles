# Page Verdict — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page web où un investisseur colle une annonce (La Rochelle), valide les champs préremplis, et reçoit la fiche de décision « dossier d'abord » calculée par le moteur `getVerdict` déjà livré.

**Architecture:** Toute la logique métier est pure et testée (parseur d'annonce, géocodage→insee, construction du résultat, helpers de formatage). TanStack Start (React/Vite/SSR) ajoute la couche web : une server function `getVerdictFn` géocode l'adresse, charge les agrégats Postgres, appelle `getVerdict`, et renvoie la fiche. JSX volontairement mince (vérifié manuellement), logique testable extraite en modules purs.

**Tech Stack:** TanStack Start (`@tanstack/react-start`, `@tanstack/react-router`), React 19, Vite, TypeScript, Vitest. Réutilise `src/verdict/engine.ts`, `src/regulatory/ruleset.ts`, Postgres `resimmo_dev`.

---

## Structure de fichiers

| Fichier | Responsabilité |
|---|---|
| `src/parse/annonce.ts` | `parseAnnonce(texte)` → champs extraits (pur) |
| `src/ingest/geocode.ts` (modif) | + `geocodeOne(adresse)` et `parseBanSearch(json)` |
| `src/web/result.ts` | `buildResult(input, geo, deps)` → `VerdictResult` (pur) + types |
| `src/web/loadDeps.ts` | `loadDeps(insee, dept)` → `Deps` (Postgres) |
| `src/web/verdict.server.ts` | `getVerdictFn` (server function : geocode + loadDeps + buildResult) |
| `src/web/fiche-format.ts` | helpers de présentation purs (verdict, positionnement, €, confiance, bandeau) |
| `src/components/Fiche.tsx` | rendu « dossier d'abord » de la fiche |
| `src/components/Field.tsx` | champ label+input réutilisable |
| `src/routes/__root.tsx`, `src/router.tsx`, `src/routes/index.tsx` | TanStack Start (layout, router, page-outil) |
| `vite.config.ts` | plugin TanStack Start + React |
| `scripts/check-page-result.ts` | vérif end-to-end du chemin données (hors navigateur) |

Ordre des tâches : logique pure d'abord (1-3), scaffolding web (4), server function (5), UI (6), vérif e2e (7).

---

### Task 1 : Parseur d'annonce (`parseAnnonce`)

**Files:** Create `src/parse/annonce.ts`, `tests/parse/annonce.test.ts`

- [ ] **Step 1: Écrire le test qui échoue — `tests/parse/annonce.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parseAnnonce } from '../../src/parse/annonce'

describe('parseAnnonce', () => {
  it('extrait prix, surface, classe DPE, type et adresse d’une annonce typique', () => {
    const t = "Maison 110 m² à vendre, 8 rue Chaudrier, La Rochelle. DPE : G. Prix 430 000 €."
    expect(parseAnnonce(t)).toMatchObject({
      typeLocal: 'Maison', surface: 110, classeDpe: 'G', prix: 430000, adresse: '8 rue Chaudrier',
    })
  })
  it('gère un appartement T3 avec étage', () => {
    const t = "Appartement T3, 65 m², 2ème étage, DPE E, 245 000 €, avenue Carnot"
    expect(parseAnnonce(t)).toMatchObject({ typeLocal: 'Appartement', surface: 65, pieces: 3, etage: '2', classeDpe: 'E', prix: 245000 })
  })
  it('n’invente rien sur un texte vague (champs absents = undefined)', () => {
    const out = parseAnnonce("Joli bien lumineux, proche commerces.")
    expect(out.prix).toBeUndefined()
    expect(out.surface).toBeUndefined()
    expect(out.classeDpe).toBeUndefined()
  })
})
```

- [ ] **Step 2: Lancer — échec**

Run: `pnpm test tests/parse/annonce.test.ts`
Expected: FAIL (`Cannot find module ... annonce`).

- [ ] **Step 3: Implémenter — `src/parse/annonce.ts`**

```ts
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
```

- [ ] **Step 4: Lancer — succès**

Run: `pnpm test tests/parse/annonce.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(parse): heuristic listing parser (no invention)"
```

---

### Task 2 : Géocodage d'une adresse (`geocodeOne`)

**Files:** Modify `src/ingest/geocode.ts`, Create `tests/ingest/geocode-one.test.ts`

- [ ] **Step 1: Écrire le test qui échoue — `tests/ingest/geocode-one.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parseBanSearch } from '../../src/ingest/geocode'

describe('parseBanSearch', () => {
  it('extrait citycode + dept + banId de la réponse BAN /search', () => {
    const json = { features: [{ properties: { id: '17300_1750_00008', citycode: '17300', type: 'housenumber' } }] }
    expect(parseBanSearch(json)).toEqual({ citycode: '17300', dept: '17', banId: '17300_1750_00008' })
  })
  it('renvoie null si aucun résultat', () => {
    expect(parseBanSearch({ features: [] })).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer — échec**

Run: `pnpm test tests/ingest/geocode-one.test.ts`
Expected: FAIL (`parseBanSearch` not exported).

- [ ] **Step 3: Implémenter — ajouter à `src/ingest/geocode.ts`**

```ts
export interface GeoOne { citycode: string; dept: string; banId: string }

export function parseBanSearch(json: any): GeoOne | null {
  const f = json?.features?.[0]
  if (!f) return null
  const citycode = f.properties?.citycode ?? ''
  if (!citycode) return null
  return { citycode, dept: citycode.slice(0, 2), banId: f.properties?.id ?? '' }
}

export async function geocodeOne(adresse: string): Promise<GeoOne | null> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`
  const res = await fetch(url)
  if (!res.ok) return null
  return parseBanSearch(await res.json())
}
```

- [ ] **Step 4: Lancer — succès**

Run: `pnpm test tests/ingest/geocode-one.test.ts`
Expected: PASS (2 tests). Run full suite `pnpm test` — confirm no regression.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(ingest): geocodeOne (single forward BAN geocode)"
```

---

### Task 3 : Construction du résultat (`buildResult`, pur)

**Files:** Create `src/web/result.ts`, `tests/web/result.test.ts`

- [ ] **Step 1: Écrire le test qui échoue — `tests/web/result.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildResult } from '../../src/web/result'
import type { VerdictFnInput } from '../../src/web/result'

const deps = {
  zoneDecote: [
    { insee: '17300', typeLocal: 'Maison', etiquette: 'G', prixM2Median: 4375, n: 61 },
    { insee: '17300', typeLocal: 'Maison', etiquette: 'D', prixM2Median: 4811, n: 387 },
  ],
  coutTravaux: [{ dept: '17', classeCible: 'D', trancheSurface: '90-120', coutMedian: 32232, coutP25: 21382, coutP75: 42385, n: 40 }],
}
const input: VerdictFnInput = { adresse: '8 rue Chaudrier', prix: 430000, surface: 110, classeDpe: 'G', typeLocal: 'Maison', profilAides: 'rose' }

describe('buildResult', () => {
  it('hors zone si citycode ≠ 17300', () => {
    const r = buildResult(input, { citycode: '75056', dept: '75', banId: 'x' }, deps)
    expect(r).toEqual({ couverte: false, raison: 'hors-zone' })
  })
  it('adresse introuvable si geo null', () => {
    expect(buildResult(input, null, deps)).toEqual({ couverte: false, raison: 'adresse-introuvable' })
  })
  it('couverte + fiche cohérente pour La Rochelle', () => {
    const r = buildResult(input, { citycode: '17300', dept: '17', banId: 'x' }, deps)
    expect(r.couverte).toBe(true)
    expect(r.fiche?.verdict).toBe('bonne-affaire')
    expect(r.fiche?.echeance.enVigueur).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer — échec**

Run: `pnpm test tests/web/result.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implémenter — `src/web/result.ts`**

```ts
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
```

- [ ] **Step 4: Lancer — succès**

Run: `pnpm test tests/web/result.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): pure buildResult (coverage check + verdict)"
```

---

### Task 4 : Helpers de formatage de la fiche (`fiche-format`, purs)

**Files:** Create `src/web/fiche-format.ts`, `tests/web/fiche-format.test.ts`

- [ ] **Step 1: Écrire le test qui échoue — `tests/web/fiche-format.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { verdictDisplay, positionnementText, euros, confianceText, showDpeBanner } from '../../src/web/fiche-format'

describe('fiche-format', () => {
  it('verdictDisplay mappe label + couleur', () => {
    expect(verdictDisplay('bonne-affaire')).toEqual({ label: 'Bonne affaire', color: '#16a34a' })
    expect(verdictDisplay('piege').color).toBe('#dc2626')
    expect(verdictDisplay('indetermine').label).toBe('Indéterminé')
  })
  it('positionnementText est lisible', () => {
    expect(positionnementText('sous-cote')).toBe('sous-coté')
    expect(positionnementText('dans-le-marche')).toBe('dans le marché')
  })
  it('euros formate en € français', () => {
    expect(euros(430000)).toBe('430 000 €')
    expect(euros(null)).toBe('—')
  })
  it('confianceText concatène n + nom', () => {
    expect(confianceText({ n: 61, niveau: 'haute' }, 'ventes')).toBe('61 ventes')
  })
  it('showDpeBanner true seulement pour E/F/G', () => {
    expect(showDpeBanner('G')).toBe(true)
    expect(showDpeBanner('D')).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer — échec**

Run: `pnpm test tests/web/fiche-format.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implémenter — `src/web/fiche-format.ts`**

```ts
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
  return `${Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ')} €`
}

export function confianceText(c: { n: number; niveau: string }, nom: string): string {
  return `${c.n} ${nom}`
}

export function showDpeBanner(classe: Classe): boolean {
  return classe === 'E' || classe === 'F' || classe === 'G'
}
```

- [ ] **Step 4: Lancer — succès**

Run: `pnpm test tests/web/fiche-format.test.ts`
Expected: PASS (5 tests). Full suite green.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): pure fiche formatting helpers"
```

---

### Task 5 : Scaffolding TanStack Start

**Files:** Modify `package.json`, `tsconfig.json`; Create `vite.config.ts`, `src/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx` (placeholder)

- [ ] **Step 1: Installer les dépendances**

```bash
cd /Users/jeremienehlil/Documents/Code/Personal/res-immobiles
pnpm add @tanstack/react-start @tanstack/react-router react react-dom
pnpm add -D @vitejs/plugin-react @types/react @types/react-dom
```

- [ ] **Step 2: Ajouter les scripts web à `package.json`**

Ajouter dans `"scripts"` (garder les scripts existants test/ingest/db:push) :
```json
    "dev": "vite dev",
    "build": "vite build"
```

- [ ] **Step 3: Mettre à jour `tsconfig.json` pour React/DOM**

Dans `compilerOptions`, ajouter `"jsx": "react-jsx"` et remplacer/ajouter `"lib": ["ES2022", "DOM", "DOM.Iterable"]`. Résultat des champs concernés :
```json
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
```

- [ ] **Step 4: Créer `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: { port: 5188 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart(),
    viteReact(), // doit venir APRÈS tanstackStart()
  ],
})
```

- [ ] **Step 5: Créer `src/router.tsx`**

```tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true })
}
```

- [ ] **Step 6: Créer `src/routes/__root.tsx`**

```tsx
/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'

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
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 760, margin: '0 auto', padding: 16 }}>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Créer un placeholder `src/routes/index.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return <h1>Verdict immo — bientôt</h1>
}
```

- [ ] **Step 8: Démarrer le serveur de dev et vérifier qu'il boote**

Run (background) : `pnpm dev` puis, après ~3s : `curl -s http://localhost:5188 | head -20`
Expected: du HTML contenant « Verdict immo ». `routeTree.gen.ts` est généré automatiquement. Arrêter le serveur ensuite.

- [ ] **Step 9: Vérifier le typage + commit**

Run: `pnpm exec tsc --noEmit` (doit être propre ; `routeTree.gen.ts` existe maintenant).
```bash
git add -A && git commit -m "chore(web): scaffold TanStack Start (router, root, index placeholder)"
```

---

### Task 6 : Server function + UI (page-outil)

**Files:** Create `src/web/loadDeps.ts`, `src/web/verdict.server.ts`, `src/components/Field.tsx`, `src/components/Fiche.tsx`; Replace `src/routes/index.tsx`

- [ ] **Step 1: Créer `src/web/loadDeps.ts`** (accès Postgres → `Deps`)

```ts
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { zoneDecote, coutTravaux } from '../db/schema'
import type { Deps } from '../verdict/engine'

export async function loadDeps(insee: string, dept: string): Promise<Deps> {
  const zd = await db.select().from(zoneDecote).where(eq(zoneDecote.insee, insee))
  const ct = await db.select().from(coutTravaux).where(eq(coutTravaux.dept, dept))
  return {
    zoneDecote: zd.map((z) => ({ insee: z.insee, typeLocal: z.typeLocal, etiquette: z.etiquette, prixM2Median: z.prixM2Median!, n: z.n })),
    coutTravaux: ct.map((c) => ({ dept: c.dept, classeCible: c.classeCible, trancheSurface: c.trancheSurface, coutMedian: c.coutMedian!, coutP25: c.coutP25!, coutP75: c.coutP75!, n: c.n })),
  }
}
```

- [ ] **Step 2: Créer la server function `src/web/verdict.server.ts`**

```ts
import { createServerFn } from '@tanstack/react-start'
import { geocodeOne } from '../ingest/geocode'
import { loadDeps } from './loadDeps'
import { buildResult, type VerdictFnInput, type VerdictResult } from './result'

export const getVerdictFn = createServerFn({ method: 'POST' })
  .inputValidator((d: VerdictFnInput) => d)
  .handler(async ({ data }): Promise<VerdictResult> => {
    const geo = await geocodeOne(data.adresse)
    if (!geo) return { couverte: false, raison: 'adresse-introuvable' }
    if (geo.citycode !== '17300') return { couverte: false, raison: 'hors-zone' }
    const deps = await loadDeps(geo.citycode, geo.dept)
    return buildResult(data, geo, deps)
  })
```

- [ ] **Step 3: Créer `src/components/Field.tsx`**

```tsx
export function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <input value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
    </label>
  )
}
```

- [ ] **Step 4: Créer `src/components/Fiche.tsx`** (dossier d'abord)

```tsx
import type { Fiche as FicheT } from '../verdict/types'
import type { Classe } from '../regulatory/ruleset'
import { verdictDisplay, positionnementText, euros, confianceText, showDpeBanner } from '../web/fiche-format'

const gris = { color: '#6b7280', fontSize: 13 }
const block = { borderTop: '1px solid #eee', padding: '12px 0' }

export function Fiche({ fiche, classe }: { fiche: FicheT; classe: Classe }) {
  const v = verdictDisplay(fiche.verdict)
  return (
    <div>
      {showDpeBanner(classe) && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 }}>
          Ton DPE date peut-être d'avant 2026. Avec le nouveau coefficient électricité, ta classe a pu s'améliorer sans travaux —{' '}
          <a href="https://observatoire-dpe-audit.ademe.fr/" target="_blank" rel="noreferrer">recalcul gratuit ADEME</a>.
        </div>
      )}

      <div style={block}>
        <div style={gris}>Prix vs marché réel</div>
        <div><b>{euros(fiche.prixM2Demande)}/m²</b> · {positionnementText(fiche.comparable.positionnement)}
          {fiche.comparable.prixM2Median != null && <> (médian {euros(fiche.comparable.prixM2Median)}/m²)</>}</div>
        <div style={gris}>{confianceText(fiche.comparable.confiance, 'ventes')}</div>
      </div>

      <div style={block}>
        <div style={gris}>Décote verte (zone)</div>
        <div>Classe actuelle {euros(fiche.decote.prixM2ClasseActuelle)}/m² · cible D {euros(fiche.decote.prixM2ClasseCible)}/m²</div>
        <div style={gris}>{confianceText(fiche.decote.confiance, 'ventes')}</div>
      </div>

      <div style={block}>
        <div style={gris}>Coût mise en conformité → D <span style={gris}>(estimation, pas un devis)</span></div>
        <div><b>{euros(fiche.cout.median)}</b> · fourchette {euros(fiche.cout.p25)}–{euros(fiche.cout.p75)}</div>
        <div style={gris}>{confianceText(fiche.cout.confiance, 'audits')}</div>
      </div>

      <div style={block}>
        <div style={gris}>Échéance & aides</div>
        <div>{fiche.echeance.dateInterdiction
          ? `Location ${fiche.echeance.enVigueur ? 'interdite depuis' : 'interdite à partir du'} ${fiche.echeance.dateInterdiction}`
          : 'Pas d’échéance d’interdiction'}</div>
        <div>Aides estimées : {euros(fiche.aides.montant)}</div>
      </div>

      <div style={{ background: v.color + '18', border: `1px solid ${v.color}`, borderRadius: 8, padding: 14, marginTop: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: v.color }}>{v.label}</div>
        {fiche.margePotentielle != null
          ? <div style={{ fontSize: 18, fontWeight: 700 }}>marge ~ {euros(fiche.margePotentielle)}</div>
          : <div style={gris}>Pas assez de comparables de cette classe pour conclure sur la marge.</div>}
        <div style={gris}>valeur après travaux − prix − coût net d'aides</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Remplacer `src/routes/index.tsx`** (collage → champs → submit → fiche)

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { parseAnnonce } from '../parse/annonce'
import { getVerdictFn } from '../web/verdict.server'
import { Field } from '../components/Field'
import { Fiche } from '../components/Fiche'
import type { VerdictResult } from '../web/result'
import type { Classe, Profil } from '../regulatory/ruleset'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [coll, setColl] = useState('')
  const [f, setF] = useState({ adresse: '', prix: '', surface: '', classeDpe: '', typeLocal: 'Maison', etage: '', profil: 'rose' })
  const [res, setRes] = useState<VerdictResult | null>(null)
  const [loading, setLoading] = useState(false)
  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }))

  function analyser() {
    const p = parseAnnonce(coll)
    setF((s) => ({ ...s,
      adresse: p.adresse ?? s.adresse, prix: p.prix?.toString() ?? s.prix,
      surface: p.surface?.toString() ?? s.surface, classeDpe: p.classeDpe ?? s.classeDpe,
      typeLocal: p.typeLocal ?? s.typeLocal, etage: p.etage ?? s.etage }))
  }

  async function verdict() {
    setLoading(true)
    const r = await getVerdictFn({ data: {
      adresse: f.adresse, prix: Number(f.prix), surface: Number(f.surface),
      classeDpe: f.classeDpe as Classe, typeLocal: f.typeLocal as 'Maison' | 'Appartement',
      profilAides: f.profil as Profil, etage: f.etage || undefined } })
    setRes(r); setLoading(false)
  }

  return (
    <main>
      <h1>Bonne affaire ou piège&nbsp;?</h1>
      <p style={{ color: '#6b7280' }}>Colle une annonce (La Rochelle), vérifie les champs, obtiens le verdict — données publiques uniquement.</p>

      <textarea value={coll} onChange={(e) => setColl(e.target.value)} rows={4}
        placeholder="Colle ton annonce ici…" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
      <button onClick={analyser} style={{ margin: '8px 0' }}>Analyser l'annonce</button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Adresse" value={f.adresse} onChange={set('adresse')} placeholder="8 rue Chaudrier" />
        <Field label="Prix demandé (€)" value={f.prix} onChange={set('prix')} />
        <Field label="Surface (m²)" value={f.surface} onChange={set('surface')} />
        <Field label="Classe DPE (A–G)" value={f.classeDpe} onChange={set('classeDpe')} />
        <Field label="Type (Maison/Appartement)" value={f.typeLocal} onChange={set('typeLocal')} />
        <Field label="Étage (si appart.)" value={f.etage} onChange={set('etage')} />
        <Field label="Profil revenus (bleu/jaune/violet/rose)" value={f.profil} onChange={set('profil')} />
      </div>
      <button onClick={verdict} disabled={loading} style={{ marginTop: 12, fontSize: 16, padding: '8px 16px' }}>
        {loading ? '…' : 'Obtenir le verdict'}</button>

      {res && (res.couverte
        ? <div style={{ marginTop: 20 }}><Fiche fiche={res.fiche} classe={f.classeDpe as Classe} /></div>
        : <p style={{ marginTop: 20, color: '#dc2626' }}>
            {res.raison === 'hors-zone' ? 'Cette commune n’est pas encore couverte (lancement : La Rochelle).' : 'Adresse non reconnue, vérifie-la.'}</p>)}
    </main>
  )
}
```

- [ ] **Step 6: Vérifier le typage**

Run: `pnpm exec tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(web): verdict page (paste→fields→server fn→fiche)"
```

---

### Task 7 : Vérification end-to-end

**Files:** Create `scripts/check-page-result.ts`

- [ ] **Step 1: Écrire le script de vérif du chemin données (hors navigateur)**

```ts
import { geocodeOne } from '../src/ingest/geocode'
import { loadDeps } from '../src/web/loadDeps'
import { buildResult } from '../src/web/result'

const geo = await geocodeOne('8 rue Chaudrier La Rochelle')
if (!geo) throw new Error('geocode KO')
const deps = await loadDeps(geo.citycode, geo.dept)
const r = buildResult(
  { adresse: '8 rue Chaudrier', prix: 430000, surface: 110, classeDpe: 'G', typeLocal: 'Maison', profilAides: 'rose' },
  geo, deps)
console.log(JSON.stringify(r, null, 2))
process.exit(0)
```

- [ ] **Step 2: Lancer le chemin données réel**

Run: `DATABASE_URL=postgres://localhost/resimmo_dev pnpm tsx scripts/check-page-result.ts`
Expected: `couverte: true`, une fiche avec `verdict` défini, `echeance.classe: 'G'`, `margePotentielle` non-null, comparables non-nuls.

- [ ] **Step 3: Vérifier que la page tourne**

Run (background) : `pnpm dev` ; après ~3s : `curl -s http://localhost:5188 | grep -o "Bonne affaire ou piège"` → doit matcher. Arrêter le serveur.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test(web): end-to-end data-path verification script"
```

- [ ] **Step 5: Suite complète + handoff humain**

Run: `pnpm test` (toute la suite verte) et `pnpm exec tsc --noEmit` (0 erreur).
Puis : lancer `pnpm dev`, ouvrir http://localhost:5188, coller une annonce La Rochelle réelle, et confirmer visuellement la fiche (c'est l'étape de validation investisseur de Jérémie).

---

## Self-Review

- **Couverture spec** : saisie hybride (Task 1 parseur + Task 6 collage→champs) ✅ ; fiche dossier-d'abord + confiance + bandeau DPE (Task 4 helpers + Task 6 Fiche.tsx) ✅ ; server function geocode→loadDeps→getVerdict (Tasks 2,3,6) ✅ ; états limites hors-zone/introuvable/indéterminé (Task 3 buildResult + Task 6 rendu) ✅ ; périmètre La Rochelle (buildResult check 17300) ✅. Tests : parseur/geocode/buildResult/format = purs et testés ; JSX vérifié manuellement (Task 7) — conforme au spec « tests composant légers » réinterprété en helpers purs testés.
- **Placeholders** : aucun ; tout le code est complet. `routeTree.gen.ts` est généré par l'outil (pas à écrire).
- **Cohérence des types** : `VerdictFnInput`/`VerdictResult` définis en Task 3, réutilisés Tasks 6/7 ; `Deps` (exporté sous-projet 1) consommé par `loadDeps`/`buildResult` à l'identique ; `GeoOne` défini Task 2, utilisé Tasks 3/6/7 ; helpers `fiche-format` (Task 4) consommés par `Fiche.tsx` (Task 6). `profilAides` défaut 'rose' côté UI.
- **Non couvert (volontaire)** : pages SEO, comptes/freemium, multi-commune, rendement locatif, recoupement classe↔DPE matché.
