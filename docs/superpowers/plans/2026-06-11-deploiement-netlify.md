# Déploiement Netlify de la page Verdict — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la page Verdict accessible derrière une URL publique Netlify en supprimant la dépendance Postgres au runtime.

**Architecture:** La server function `getVerdictFn` est rendue « DB-free » : les 61 lignes d'agrégats (lecture seule) sont dumpées de Postgres vers un JSON committé, puis servies par un `getDeps` synchrone qui remplace `loadDeps`. Ça coupe l'arête `pg` du graphe d'imports déployé. On ajoute ensuite l'adaptateur officiel `@netlify/vite-plugin-tanstack-start` et un `netlify.toml` minimal. Le déploiement final (`netlify login` + `netlify deploy`) est une étape manuelle de l'utilisateur.

**Tech Stack:** TanStack Start (React, Vite SSR, server functions), TypeScript ESM, Postgres (local, build-time only), `@netlify/vite-plugin-tanstack-start`, Netlify CLI, Vitest, pnpm, tsx.

---

## Préconditions

- Postgres local `resimmo_dev` **peuplé La Rochelle** (issu de l'ingest du sous-projet 1). Si la base est vide, lancer `pnpm ingest` avant la Task 1, sinon le dump produira un JSON vide (la Task 1 échoue volontairement dans ce cas).
- Réseau disponible (la Task 3 appelle l'API BAN publique).
- Référence design : `docs/superpowers/specs/2026-06-11-deploiement-netlify-design.md`.

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `scripts/dump-aggregates.ts` | Dump Postgres → JSON (local, hors build) | Créer |
| `src/web/aggregates.lr.json` | Snapshot des 61 lignes runtime (committé) | Générer + committer |
| `src/web/aggregates.ts` | `getDeps()` DB-free (remplace `loadDeps` au runtime) | Créer |
| `tests/web/aggregates.test.ts` | Tests de `getDeps` | Créer |
| `src/web/verdict.server.ts` | Bascule `loadDeps` → `getDeps` | Modifier |
| `scripts/check-deploy-result.ts` | Vérif parité du chemin DB-free | Créer |
| `tsconfig.json` | Activer `resolveJsonModule` | Modifier |
| `vite.config.ts` | Ajouter le plugin `netlify()` | Modifier |
| `netlify.toml` | Commande de build pnpm | Créer |
| `package.json` | devDep `@netlify/vite-plugin-tanstack-start` | Modifier (via `pnpm add`) |

`loadDeps.ts` et `db/client.ts` restent **inchangés** (utilisés par les scripts locaux uniquement, plus par la server function).

---

### Task 1: Dump des agrégats vers JSON committé

**Files:**
- Create: `scripts/dump-aggregates.ts`
- Generate: `src/web/aggregates.lr.json`

- [ ] **Step 1: Écrire le script de dump**

```ts
// scripts/dump-aggregates.ts
import { writeFileSync } from 'node:fs'
import { loadDeps } from '../src/web/loadDeps'
import { pool } from '../src/db/client'

const INSEE = '17300'
const DEPT = '17'

const deps = await loadDeps(INSEE, DEPT)
const out = { insee: INSEE, dept: DEPT, zoneDecote: deps.zoneDecote, coutTravaux: deps.coutTravaux }
writeFileSync(new URL('../src/web/aggregates.lr.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.log(`zoneDecote=${out.zoneDecote.length} coutTravaux=${out.coutTravaux.length}`)
await pool.end()
if (out.zoneDecote.length === 0 || out.coutTravaux.length === 0) {
  console.error('ERREUR: agrégats vides — Postgres resimmo_dev est-il peuplé ? (pnpm ingest)')
  process.exit(1)
}
process.exit(0)
```

- [ ] **Step 2: Lancer le dump**

Run: `pnpm exec tsx --env-file=.env scripts/dump-aggregates.ts`
(`--env-file=.env` charge `DATABASE_URL=postgres://localhost/resimmo_dev` ; sans lui, `pg` taperait la base par défaut.)
Expected: affiche `zoneDecote=14 coutTravaux=47` (les nombres exacts peuvent varier ; **doivent être > 0**), exit 0, et crée `src/web/aggregates.lr.json`.

Si le script affiche `zoneDecote=0 ...` et exit 1 : Postgres n'est pas peuplé → lancer `pnpm ingest` puis relancer cette étape.

- [ ] **Step 3: Vérifier le JSON généré**

Run: `node -e "const d=require('./src/web/aggregates.lr.json'); console.log(d.insee, d.dept, d.zoneDecote.length, d.coutTravaux.length); if(!d.zoneDecote.length||!d.coutTravaux.length) process.exit(1)"`
Expected: `17300 17 <n>=14 <m>=47` (n, m > 0), exit 0.

- [ ] **Step 4: Committer le script et le snapshot**

```bash
git add scripts/dump-aggregates.ts src/web/aggregates.lr.json
git commit -m "feat(deploy): dump agrégats La Rochelle en JSON runtime"
```

---

### Task 2: `getDeps` DB-free + tests

**Files:**
- Modify: `tsconfig.json`
- Create: `src/web/aggregates.ts`
- Test: `tests/web/aggregates.test.ts`

- [ ] **Step 1: Activer `resolveJsonModule` dans tsconfig**

Dans `tsconfig.json`, ajouter la ligne `"resolveJsonModule": true,` dans `compilerOptions` (par ex. juste après `"esModuleInterop": true,`). Résultat attendu :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"],
    "outDir": "dist",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 2: Écrire le test (échoue)**

```ts
// tests/web/aggregates.test.ts
import { describe, it, expect } from 'vitest'
import { getDeps } from '../../src/web/aggregates'

describe('getDeps', () => {
  it('renvoie des agrégats non vides pour La Rochelle (17300 / dept 17)', () => {
    const deps = getDeps('17300', '17')
    expect(deps.zoneDecote.length).toBeGreaterThan(0)
    expect(deps.coutTravaux.length).toBeGreaterThan(0)
  })

  it('chaque ligne zoneDecote est sur INSEE 17300', () => {
    const deps = getDeps('17300', '17')
    expect(deps.zoneDecote.every((z) => z.insee === '17300')).toBe(true)
  })

  it('chaque ligne coutTravaux est sur le département 17', () => {
    const deps = getDeps('17300', '17')
    expect(deps.coutTravaux.every((c) => c.dept === '17')).toBe(true)
  })

  it('filtre un INSEE inconnu → zoneDecote vide', () => {
    const deps = getDeps('99999', '17')
    expect(deps.zoneDecote.length).toBe(0)
  })
})
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm vitest run tests/web/aggregates.test.ts`
Expected: FAIL (`Cannot find module '../../src/web/aggregates'`).

- [ ] **Step 4: Implémenter `getDeps`**

```ts
// src/web/aggregates.ts
import data from './aggregates.lr.json'
import type { Deps } from '../verdict/engine'

// Sert les agrégats empaquetés (lecture seule), sans Postgres au runtime.
// Le filtre insee/dept reproduit les WHERE de loadDeps → remplacement transparent.
export function getDeps(insee: string, dept: string): Deps {
  return {
    zoneDecote: data.zoneDecote.filter((z) => z.insee === insee),
    coutTravaux: data.coutTravaux.filter((c) => c.dept === dept),
  }
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `pnpm vitest run tests/web/aggregates.test.ts`
Expected: PASS (4/4).

Si TypeScript se plaint d'un mismatch de type sur le retour (types inférés du JSON), ajouter `as Deps` sur l'objet retourné. Ne PAS modifier la forme des données.

- [ ] **Step 6: Committer**

```bash
git add tsconfig.json src/web/aggregates.ts tests/web/aggregates.test.ts
git commit -m "feat(deploy): getDeps DB-free depuis le JSON empaqueté"
```

---

### Task 3: Bascule de la server function + vérif parité DB-free

**Files:**
- Modify: `src/web/verdict.server.ts`
- Create: `scripts/check-deploy-result.ts`

- [ ] **Step 1: Basculer `verdict.server.ts` sur `getDeps`**

Remplacer intégralement le contenu de `src/web/verdict.server.ts` par :

```ts
import { createServerFn } from '@tanstack/react-start'
import { geocodeOne } from '../ingest/geocode'
import { getDeps } from './aggregates'
import { buildResult, type VerdictFnInput, type VerdictResult } from './result'

export const getVerdictFn = createServerFn({ method: 'POST' })
  .validator((d: VerdictFnInput) => d)
  .handler(async ({ data }): Promise<VerdictResult> => {
    const geo = await geocodeOne(data.adresse)
    if (!geo) return { couverte: false, raison: 'adresse-introuvable' }
    if (geo.citycode !== '17300') return { couverte: false, raison: 'hors-zone' }
    const deps = getDeps(geo.citycode, geo.dept)
    return buildResult(data, geo, deps)
  })
```

(Seuls changements : import `getDeps` au lieu de `loadDeps`, et `getDeps(...)` sans `await`.)

- [ ] **Step 2: Écrire le script de parité DB-free**

```ts
// scripts/check-deploy-result.ts
// Reproduit le chemin déployé SANS Postgres : geocodeOne + getDeps + buildResult.
import { geocodeOne } from '../src/ingest/geocode'
import { getDeps } from '../src/web/aggregates'
import { buildResult } from '../src/web/result'

const geo = await geocodeOne('8 rue Chaudrier La Rochelle')
if (!geo) throw new Error('geocode KO')
const deps = getDeps(geo.citycode, geo.dept)
const r = buildResult(
  { adresse: '8 rue Chaudrier', prix: 430000, surface: 110, classeDpe: 'G', typeLocal: 'Maison', profilAides: 'rose' },
  geo, deps,
)
console.log(JSON.stringify(r, null, 2))
if (!('couverte' in r) || r.couverte !== true) {
  console.error('ATTENDU couverte:true — le chemin DB-free ne produit pas de fiche')
  process.exit(1)
}
process.exit(0)
```

- [ ] **Step 3: Lancer le script de parité**

Run: `pnpm exec tsx scripts/check-deploy-result.ts`
Expected: affiche une fiche JSON avec `"couverte": true` et un bloc `fiche` (verdict, comparable, decote, cout, echeance, aides, margePotentielle), exit 0. **Aucune connexion Postgres** n'est ouverte.

- [ ] **Step 4: Lancer toute la suite de tests (non-régression)**

Run: `pnpm test`
Expected: PASS sur l'intégralité de la suite (parseur, géocodage, moteur, fiche-format, result, aggregates).

- [ ] **Step 5: Committer**

```bash
git add src/web/verdict.server.ts scripts/check-deploy-result.ts
git commit -m "feat(deploy): server function DB-free (getDeps) + check parité"
```

---

### Task 4: Adaptateur Netlify + build de prod

**Files:**
- Modify: `package.json` (via `pnpm add`)
- Modify: `vite.config.ts`
- Create: `netlify.toml`

- [ ] **Step 1: Installer le plugin Netlify (devDep)**

Run: `pnpm add -D @netlify/vite-plugin-tanstack-start`
Expected: le paquet apparaît dans `devDependencies` de `package.json`, exit 0.

- [ ] **Step 2: Ajouter le plugin à `vite.config.ts`**

Remplacer intégralement le contenu de `vite.config.ts` par :

```ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: { port: 5188 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart(),
    netlify(),
    viteReact(), // must come AFTER tanstackStart()
  ],
})
```

- [ ] **Step 3: Créer `netlify.toml`**

```toml
# Le plugin @netlify/vite-plugin-tanstack-start configure publish dir + functions.
# On ne pin ici que la commande de build (pnpm déterministe).
[build]
  command = "pnpm build"
```

- [ ] **Step 4: Build de prod (gate)**

Run: `pnpm build`
Expected: build réussi, exit 0. **C'est le gate clé** : si une arête `pg` subsistait dans le graphe de la server function, le build/bundle échouerait ou avertirait. Aucune erreur liée à `pg`/`DATABASE_URL` ne doit apparaître.

- [ ] **Step 5: Committer**

```bash
git add package.json pnpm-lock.yaml vite.config.ts netlify.toml
git commit -m "feat(deploy): adaptateur Netlify + build de prod"
```

---

## Déploiement final (étape manuelle utilisateur — hors subagents)

Ces commandes nécessitent l'authentification Netlify de l'utilisateur ; elles ne sont **pas** exécutées par un subagent :

1. `npx netlify login` (compte Netlify de l'utilisateur).
2. `npx netlify deploy --build` → URL de draft ; ouvrir, coller une annonce La Rochelle, vérifier le verdict.
3. `npx netlify deploy --build --prod` → URL de production publique.

Aucune variable d'environnement à configurer (plus de DB ; le géocodage BAN est public).

---

## Self-Review (auteur du plan)

- **Couverture spec** : §2 verrou Postgres → Tasks 1-3 ; §3.1 dump → Task 1 ; §3.2 JSON committé → Task 1 ; §3.3 getDeps → Task 2 ; §3.4 bascule server fn → Task 3 ; §3.6/§3.7 adaptateur+toml → Task 4 ; §4 déploiement → section manuelle ; §6 tests → Tasks 2 (getDeps), 3 (parité + suite), 4 (build gate). ✓
- **Cohérence des types** : `getDeps(insee, dept): Deps` défini en Task 2, consommé identiquement en Task 3 et dans `check-deploy-result.ts`. `Deps` importé depuis `../verdict/engine` (existe). `VerdictFnInput`/`VerdictResult`/`buildResult` réutilisés tels quels. ✓
- **Pas de placeholder** : tout le code est complet ; les seuls nombres « variables » (14/47) sont des données réelles générées par la Task 1, bornées par une assertion `> 0`. ✓
