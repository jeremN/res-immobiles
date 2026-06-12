# SP-B : Runtime store JSON par département — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire lire au runtime le fichier statique `/agg/<dept>.json` (servi par le CDN) au lieu d'un JSON bundlé, avec couverture dérivée — figeant le contrat que l'ingestion nationale (SP-A) devra remplir.

**Architecture:** La server function dérive l'origine de la requête (`getRequestUrl`), fetch `/agg/<dept>.json`, et en extrait les agrégats de la commune via `pickDeps`. 404 → hors-zone ; 5xx/réseau → erreur récupérable. `buildResult` devient le constructeur de fiche du chemin couvert. La Rochelle re-exportée en `public/agg/17.json` pour valider bout-en-bout.

**Tech Stack:** TanStack Start (server functions, `@tanstack/react-start/server`), TypeScript ESM, Vitest, pnpm, tsx.

---

## Préconditions
- App déployée, runtime actuel = `getDeps` lisant `src/web/aggregates.lr.json` bundlé (La Rochelle).
- Référence : `docs/superpowers/specs/2026-06-12-scaling-runtime-dept-store-design.md`.
- Suite verte (51).

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `src/web/deptStore.ts` | `pickDeps` (pur) + `fetchDeptAgg` (réseau) + type `DeptAgg` | Créer |
| `tests/web/deptStore.test.ts` | Tests | Créer |
| `public/agg/17.json` | La Rochelle au format dépt (généré) | Générer + committer |
| `src/web/result.ts` | `buildResult` → chemin couvert (geo non-null) | Modifier |
| `tests/web/result.test.ts` | Adapter (drop null/hors-zone, +indéterminé) | Modifier |
| `src/web/verdict.fn.ts` | Origine + fetch dépt + couverture dérivée | Modifier |
| `scripts/check-deploy-result.ts` | Parité via `public/agg/17.json` + `pickDeps` | Modifier |
| `src/web/aggregates.ts` · `src/web/aggregates.lr.json` · `tests/web/aggregates.test.ts` | `getDeps` bundlé | Supprimer |

---

### Task 1: `deptStore.ts` (pickDeps + fetchDeptAgg) + tests

**Files:**
- Create: `src/web/deptStore.ts`
- Test: `tests/web/deptStore.test.ts`

- [ ] **Step 1: Écrire le test (échoue)**

```ts
// tests/web/deptStore.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { pickDeps, fetchDeptAgg, type DeptAgg } from '../../src/web/deptStore'

const agg: DeptAgg = {
  dept: '17',
  zoneDecote: [
    { insee: '17300', typeLocal: 'Maison', etiquette: 'G', prixM2Median: 4375, n: 61 },
    { insee: '17300', typeLocal: 'Maison', etiquette: 'D', prixM2Median: 4811, n: 387 },
    { insee: '17137', typeLocal: 'Maison', etiquette: 'D', prixM2Median: 5200, n: 40 },
  ],
  coutTravaux: [{ dept: '17', classeCible: 'D', trancheSurface: '90-120', coutMedian: 32232, coutP25: 21382, coutP75: 42385, n: 40 }],
}

describe('pickDeps', () => {
  it('filtre zoneDecote sur l’insee et garde coutTravaux', () => {
    const d = pickDeps(agg, '17300')
    expect(d.zoneDecote.length).toBe(2)
    expect(d.zoneDecote.every((z) => z.insee === '17300')).toBe(true)
    expect(d.coutTravaux).toEqual(agg.coutTravaux)
  })
  it('insee inconnu → zoneDecote vide', () => {
    expect(pickDeps(agg, '99999').zoneDecote.length).toBe(0)
  })
})

describe('fetchDeptAgg', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('200 → DeptAgg parsé', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(agg), { status: 200 })))
    const r = await fetchDeptAgg('http://x', '17')
    expect(r?.dept).toBe('17')
    expect(r?.zoneDecote.length).toBe(3)
  })
  it('404 → null (non couvert)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    expect(await fetchDeptAgg('http://x', '67')).toBeNull()
  })
  it('500 → throw (erreur transitoire)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    await expect(fetchDeptAgg('http://x', '17')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `pnpm vitest run tests/web/deptStore.test.ts`
Expected: FAIL (`Cannot find module '../../src/web/deptStore'`).

- [ ] **Step 3: Implémenter `src/web/deptStore.ts`**

```ts
import type { Deps } from '../verdict/engine'

export interface DeptAgg {
  dept: string
  zoneDecote: Deps['zoneDecote']
  coutTravaux: Deps['coutTravaux']
}

// Pur : extrait les deps d'une commune depuis l'agrégat du département.
export function pickDeps(agg: DeptAgg, insee: string): Deps {
  return {
    zoneDecote: agg.zoneDecote.filter((z) => z.insee === insee),
    coutTravaux: agg.coutTravaux,
  }
}

// Réseau : 404 → null (dépt non couvert) ; 5xx/réseau → throw (transitoire, récupérable).
export async function fetchDeptAgg(origin: string, dept: string): Promise<DeptAgg | null> {
  const res = await fetch(`${origin}/agg/${dept}.json`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`agg fetch ${dept}: ${res.status}`)
  return (await res.json()) as DeptAgg
}
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `pnpm vitest run tests/web/deptStore.test.ts`
Expected: PASS (5).

- [ ] **Step 5: Commit**

```bash
git add src/web/deptStore.ts tests/web/deptStore.test.ts
git commit -m "feat(scaling): deptStore (pickDeps + fetchDeptAgg) + tests"
```

---

### Task 2: Générer `public/agg/17.json`

**Files:**
- Generate: `public/agg/17.json`

- [ ] **Step 1: Transformer `aggregates.lr.json` → format dépt**

Run:
```bash
node -e "const fs=require('fs');const d=require('./src/web/aggregates.lr.json');fs.mkdirSync('public/agg',{recursive:true});fs.writeFileSync('public/agg/17.json',JSON.stringify({dept:d.dept,zoneDecote:d.zoneDecote,coutTravaux:d.coutTravaux},null,2)+'\n')"
```
Expected: crée `public/agg/17.json`.

- [ ] **Step 2: Vérifier**

Run: `node -e "const a=require('./public/agg/17.json');console.log(a.dept,a.zoneDecote.length,a.coutTravaux.length);if(a.dept!=='17'||!a.zoneDecote.length||!a.coutTravaux.length)process.exit(1)"`
Expected: `17 14 47`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add public/agg/17.json
git commit -m "feat(scaling): La Rochelle au format agg/<dept>.json"
```

---

### Task 3: Refacto `buildResult` + bascule `verdict.fn.ts`

**Files:**
- Modify: `src/web/result.ts`
- Modify: `tests/web/result.test.ts`
- Modify: `src/web/verdict.fn.ts`

- [ ] **Step 1: Remplacer `src/web/result.ts`**

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

// Chemin couvert : geo non-null, couverture déjà décidée par l'appelant (server function).
export function buildResult(input: VerdictFnInput, geo: GeoOne, deps: Deps): VerdictResult {
  const fiche = getVerdict(
    { insee: geo.citycode, typeLocal: input.typeLocal, surface: input.surface,
      prixDemande: input.prix, classeDpe: input.classeDpe, profilAides: input.profilAides, classeCible: 'D' },
    deps,
  )
  return { couverte: true, fiche }
}
```

- [ ] **Step 2: Remplacer `tests/web/result.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildResult } from '../../src/web/result'
import type { VerdictFnInput } from '../../src/web/result'
import type { GeoOne } from '../../src/ingest/geocode'

const deps = {
  zoneDecote: [
    { insee: '17300', typeLocal: 'Maison', etiquette: 'G', prixM2Median: 4375, n: 61 },
    { insee: '17300', typeLocal: 'Maison', etiquette: 'D', prixM2Median: 4811, n: 387 },
  ],
  coutTravaux: [{ dept: '17', classeCible: 'D', trancheSurface: '90-120', coutMedian: 32232, coutP25: 21382, coutP75: 42385, n: 40 }],
}
const geo: GeoOne = { citycode: '17300', dept: '17', banId: 'x' }
const input: VerdictFnInput = { adresse: '8 rue Chaudrier', prix: 430000, surface: 110, classeDpe: 'G', typeLocal: 'Maison', profilAides: 'rose' }

describe('buildResult', () => {
  it('couverte + fiche cohérente pour La Rochelle', () => {
    const r = buildResult(input, geo, deps)
    expect(r.couverte).toBe(true)
    const fiche = (r as Extract<typeof r, { couverte: true }>).fiche
    expect(fiche.verdict).toBe('bonne-affaire')
    expect(fiche.echeance.enVigueur).toBe(true)
  })
  it('commune sans comparable → couverte mais verdict indéterminé', () => {
    const r = buildResult(input, geo, { zoneDecote: [], coutTravaux: [] })
    expect(r.couverte).toBe(true)
    const fiche = (r as Extract<typeof r, { couverte: true }>).fiche
    expect(fiche.verdict).toBe('indetermine')
    expect(fiche.margePotentielle).toBeNull()
  })
})
```

- [ ] **Step 3: Remplacer `src/web/verdict.fn.ts`**

```ts
import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { geocodeOne } from '../ingest/geocode'
import { fetchDeptAgg, pickDeps } from './deptStore'
import { buildResult, type VerdictFnInput, type VerdictResult } from './result'

export const getVerdictFn = createServerFn({ method: 'POST' })
  .validator((d: VerdictFnInput) => d)
  .handler(async ({ data }): Promise<VerdictResult> => {
    const geo = await geocodeOne(data.adresse)
    if (!geo) return { couverte: false, raison: 'adresse-introuvable' }
    const origin = new URL(getRequestUrl()).origin
    const agg = await fetchDeptAgg(origin, geo.dept)
    if (!agg) return { couverte: false, raison: 'hors-zone' }
    return buildResult(data, geo, pickDeps(agg, geo.citycode))
  })
```

- [ ] **Step 4: Tester + builder**

Run: `pnpm test`
Expected: suite verte (le test buildResult adapté ; `getDeps`/`aggregates.test` encore présents, verts).

Run: `pnpm build`
Expected: exit 0, `.netlify/v1/functions/server.mjs` émis. Aucune erreur TS sur `getRequestUrl` (import depuis `@tanstack/react-start/server`).

- [ ] **Step 5: Commit**

```bash
git add src/web/result.ts tests/web/result.test.ts src/web/verdict.fn.ts
git commit -m "feat(scaling): runtime fetch agg/<dept>.json + couverture dérivée"
```

---

### Task 4: Retrait du store bundlé + parité

**Files:**
- Delete: `src/web/aggregates.ts`, `src/web/aggregates.lr.json`, `tests/web/aggregates.test.ts`
- Modify: `scripts/check-deploy-result.ts`

- [ ] **Step 1: Mettre à jour `scripts/check-deploy-result.ts`**

Remplacer intégralement par :

```ts
// scripts/check-deploy-result.ts
// Parité du chemin couvert (sans réseau pour le store) : geocodeOne + pickDeps(agg dépt) + buildResult.
import { readFileSync } from 'node:fs'
import { geocodeOne } from '../src/ingest/geocode'
import { pickDeps, type DeptAgg } from '../src/web/deptStore'
import { buildResult } from '../src/web/result'

const geo = await geocodeOne('8 rue Chaudrier La Rochelle')
if (!geo) throw new Error('geocode KO')
const agg = JSON.parse(readFileSync(new URL('../public/agg/17.json', import.meta.url), 'utf8')) as DeptAgg
const r = buildResult(
  { adresse: '8 rue Chaudrier', prix: 430000, surface: 110, classeDpe: 'G', typeLocal: 'Maison', profilAides: 'rose' },
  geo, pickDeps(agg, geo.citycode),
)
console.log(JSON.stringify(r, null, 2))
if (!('couverte' in r) || r.couverte !== true) {
  console.error('ATTENDU couverte:true')
  process.exit(1)
}
process.exit(0)
```

- [ ] **Step 2: Supprimer le store bundlé**

```bash
git rm src/web/aggregates.ts src/web/aggregates.lr.json tests/web/aggregates.test.ts
```

- [ ] **Step 3: Parité + non-régression + build**

Run: `pnpm exec tsx scripts/check-deploy-result.ts`
Expected: fiche JSON `"couverte": true`, verdict `bonne-affaire`, marge ~76713, exit 0.

Run: `pnpm test`
Expected: suite verte (sans `aggregates.test`, avec `deptStore.test` + `result.test` adapté).

Run: `pnpm build`
Expected: exit 0, fonction Netlify émise, aucune référence résiduelle à `aggregates`/`getDeps`.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-deploy-result.ts src/web/ tests/web/
git commit -m "refactor(scaling): retirer le store bundlé (getDeps/aggregates)"
```

---

## Vérification live (orchestrateur, après Task 4)
Redéploiement (`pnpm build` + `netlify deploy --prod`), puis fetch d'un verdict La Rochelle sur l'URL publique : confirme que la fonction fetch bien `/agg/17.json` servi par le CDN et produit la fiche. (Un dépt non couvert, ex. une adresse en 75, doit renvoyer « hors-zone ».)

## Self-Review (auteur du plan)
- **Couverture spec** : §3.1 deptStore → Task 1 ; §3.5 agg/17.json → Task 2 ; §3.2 verdict.fn + §3.3 buildResult → Task 3 ; §3.4 retrait getDeps + §3.6 check-deploy → Task 4 ; §5 tests → Tasks 1,3,4. ✓
- **Build vert entre tâches** : T1-T2 additifs ; T3 bascule verdict.fn mais `aggregates.ts`/`check-deploy` (getDeps) encore présents → OK ; T4 retire getDeps ET met à jour check-deploy ensemble → pas d'état cassé. ✓
- **Types** : `DeptAgg` (T1) consommé en T3/T4 ; `buildResult(input, geo: GeoOne, deps)` (T3) appelé identiquement en T4 et verdict.fn ; `getRequestUrl` depuis `@tanstack/react-start/server` (confirmé context7). ✓
- **Pas de placeholder** : code complet partout. ✓
