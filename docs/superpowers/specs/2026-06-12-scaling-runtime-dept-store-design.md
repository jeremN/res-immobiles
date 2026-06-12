# Design — SP-B : Runtime « store JSON par département » (scaling national)

> Statut : design validé (brainstorming), prêt pour plan.
> Date : 2026-06-12.
> Parent : architecture de scaling national validée (couverture = national tout DVF-couvert hors Alsace-Moselle ; store runtime = JSON statique par département sur le CDN). SP-B = la couche runtime ; **SP-A** (ingestion nationale produisant tous les `agg/<dd>.json`) suit.
> Socle : app déployée (`src/web/verdict.fn.ts`, `getDeps` lisant `src/web/aggregates.lr.json` bundlé, La Rochelle 17300). Voir [[verdict-app-deployment]].

## 1. Objectif

Remplacer le contrat de données runtime : au lieu de lire un JSON **bundlé** (1 commune), la server function **fetch** le fichier statique `/agg/<dept>.json` du département demandé (servi par le CDN, mis en cache à l'edge), et en extrait les agrégats de la commune. Ça fige le **contrat** que SP-A devra remplir, et se valide bout-en-bout sur La Rochelle (dept 17) avant l'ingestion massive. Périmètre : runtime uniquement. **Pas** d'ingestion nationale ici.

## 2. Contrat de données : `agg/<dd>.json`

Un fichier statique par département, servi à `/agg/<dd>.json` (où `<dd>` = code département : `01`–`95`, `2A`, `2B`) :

```json
{
  "dept": "17",
  "zoneDecote": [ { "insee": "17300", "typeLocal": "Maison", "etiquette": "G", "prixM2Median": 4375, "n": 61 }, … toutes les communes du dépt ],
  "coutTravaux": [ { "dept": "17", "classeCible": "D", "trancheSurface": "…", "coutMedian": 0, "coutP25": 0, "coutP75": 0, "n": 0 } ]
}
```

`zoneDecote` contient les lignes de **toutes** les communes du département (clé `insee`) ; `coutTravaux` est au niveau département. Mêmes formes de lignes que l'interface `Deps` actuelle (aucun changement moteur).

## 3. Composants

### 3.1 `src/web/deptStore.ts` (nouveau)
Deux unités, l'une pure (testable) et l'une réseau (testable via mock) :

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

// Réseau : fetch le JSON du département.
// 404 → null (département non couvert → hors-zone). 5xx/réseau → throw
// (erreur transitoire → remontée au try/catch de la page → « service indisponible »).
export async function fetchDeptAgg(origin: string, dept: string): Promise<DeptAgg | null> {
  const res = await fetch(`${origin}/agg/${dept}.json`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`agg fetch ${dept}: ${res.status}`)
  return (await res.json()) as DeptAgg
}
```

### 3.2 `src/web/verdict.fn.ts` (modifié)
La server function dérive l'origine de la requête entrante (`getRequestUrl()` de `@tanstack/react-start/server`, via AsyncLocalStorage) et fetch le département :

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
    if (!agg) return { couverte: false, raison: 'hors-zone' }      // département non couvert
    return buildResult(data, geo, pickDeps(agg, geo.citycode))
  })
```

**Couverture dérivée** : plus de `!== '17300'`. Hors-zone ⇔ pas de fichier `agg/<dept>.json` (404). Une commune d'un dépt couvert mais sans ventes → `pickDeps` renvoie `zoneDecote: []` → le moteur produit `verdict: 'indeterminé'` (honnête), `couverte: true`.

### 3.3 `src/web/result.ts` (modifié)
`buildResult` ne décide plus de la couverture (c'est la server function via le fetch). Il devient le constructeur de fiche du **chemin couvert** :

```ts
export function buildResult(input: VerdictFnInput, geo: GeoOne, deps: Deps): VerdictResult {
  const fiche = getVerdict(
    { insee: geo.citycode, typeLocal: input.typeLocal, surface: input.surface,
      prixDemande: input.prix, classeDpe: input.classeDpe, profilAides: input.profilAides, classeCible: 'D' },
    deps,
  )
  return { couverte: true, fiche }
}
```

`geo` est désormais garanti non-null par l'appelant (la server function gère `!geo`). Le type `VerdictResult` (union couverte true/false) est inchangé ; les cas `false` sont produits par la server function.

### 3.4 `src/web/getDeps` / `aggregates.lr.json` (retirés du runtime)
`src/web/aggregates.ts` (`getDeps`) et l'import bundlé de `aggregates.lr.json` ne sont plus utilisés au runtime → supprimés. `aggregates.lr.json` sert une dernière fois à **générer** `public/agg/17.json` (transform `{insee,dept,zoneDecote,coutTravaux}` → `{dept,zoneDecote,coutTravaux}`), puis est retiré (SP-A regénérera proprement).

### 3.5 `public/agg/17.json` (nouveau, généré)
La Rochelle au nouveau format, pour valider le runtime + le déploiement. Généré depuis `aggregates.lr.json`.

### 3.6 `scripts/check-deploy-result.ts` (modifié)
Le script de parité DB-free passe au nouveau chemin : lit `public/agg/17.json`, `pickDeps`, `buildResult` (sans réseau pour le store ; il garde le `geocodeOne` réseau). Prouve que le contrat produit la même fiche (`bonne-affaire`, marge ~76 713 €).

## 4. Origine de la requête (point technique)

`fetch` côté serveur exige une URL **absolue**. La fonction n'a pas d'origine codée en dur : on la dérive de la requête entrante via `getRequestUrl()` (AsyncLocalStorage, valide dans le handler). `new URL(getRequestUrl()).origin` →
- prod : `https://<site>.netlify.app`,
- `vite dev` : `http://localhost:5188` (Vite sert `public/agg/*.json`).
Aucune variable d'env, portable.

## 5. Tests

- **`pickDeps`** (pur) → `tests/web/deptStore.test.ts` : filtre `zoneDecote` sur l'insee ; renvoie `coutTravaux` tel quel ; insee inconnu → `zoneDecote` vide.
- **`fetchDeptAgg`** (mock `fetch`) : 200 → `DeptAgg` parsé ; 404 → `null` ; 500 → throw (erreur transitoire récupérable).
- **Parité** : `scripts/check-deploy-result.ts` produit `couverte:true` + fiche cohérente sur La Rochelle via `public/agg/17.json`.
- **Non-régression** : suite existante verte (les tests de `result.ts`/`aggregates` adaptés ou retirés selon le refactor). `pnpm build` vert + fonction Netlify émise.
- **Vérif live** (orchestrateur) : après déploiement, fetch d'un verdict La Rochelle sur l'URL publique (le fichier `agg/17.json` est servi par le CDN, la fonction le fetch).

## 6. Périmètre / non-objectifs

**Fait (SP-B)** : contrat `agg/<dept>.json`, runtime fetch + couverture dérivée, refacto `buildResult`, La Rochelle re-exportée, parité + déploiement.
**Différé** : ❌ ingestion nationale (SP-A) · ❌ génération des 93 fichiers dépt · ❌ mémoïsation cross-invocation du fetch (l'edge-cache CDN suffit pour démarrer ; à mesurer) · ❌ Git LFS pour les gros JSON (décision SP-A).

## 7. Séquence d'implémentation (pour le plan)
1. `deptStore.ts` (`pickDeps` + `fetchDeptAgg`) + tests.
2. Générer `public/agg/17.json` depuis `aggregates.lr.json`.
3. Bascule `verdict.fn.ts` (origine + fetch + couverture dérivée) + refacto `buildResult` + adaptation tests `result.ts`.
4. Retrait `getDeps`/`aggregates.ts`/import bundlé ; MAJ `check-deploy-result.ts` ; build vert.
