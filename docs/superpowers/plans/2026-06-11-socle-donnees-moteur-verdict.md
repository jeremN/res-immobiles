# Socle données + moteur de verdict — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingérer DVF + DPE + Audits ADEME + BAN pour La Rochelle dans Postgres, précalculer les agrégats (décote par zone×classe, coût travaux par classe-cible×type×surface), encoder un ruleset réglementaire daté, et exposer un moteur `getVerdict(input)` produisant la fiche de décision — le tout testable sans UI.

**Architecture:** Pipeline d'ingestion batch (scripts Node hors web) → Postgres (tables brutes + agrégats précalculés). Moteur de verdict pur : lit les agrégats + applique le ruleset, aucune dépendance réseau en lecture sauf le géocodage de l'adresse d'entrée. Tout le cœur (ruleset, agrégats, verdict) est déterministe et testé par fixtures.

**Tech Stack:** TypeScript (ESM, Node 20+), Postgres, Drizzle ORM + drizzle-kit, Vitest, `fetch`/`FormData` natifs, tsx pour les scripts. pnpm.

---

## Structure de fichiers (verrouille la décomposition)

| Fichier | Responsabilité |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts`, `drizzle.config.ts` | Scaffolding + config |
| `src/db/schema.ts` | Tables Drizzle : `dvfMutations`, `dpeLogements`, `zoneDecote`, `coutTravaux` |
| `src/db/client.ts` | Pool `pg` + instance Drizzle |
| `src/regulatory/ruleset.ts` | Config datée (échéances, réforme 2026) + `getEcheance`, `estimateAides` |
| `src/verdict/types.ts` | `VerdictInput`, `Fiche`, types partagés |
| `src/verdict/decote.ts` | `computeZoneDecote(rows)` → agrégat décote |
| `src/verdict/cout.ts` | `computeCoutTravaux(auditRows)` → agrégat coût |
| `src/verdict/engine.ts` | `getVerdict(input, deps)` → `Fiche` |
| `src/ingest/geocode.ts` | `geocodeBatch(addrs)` via BAN bulk |
| `src/ingest/sources.ts` | `fetchDvf`, `fetchDpe`, `fetchAudits` |
| `src/ingest/load.ts` | normalisation + insert Postgres |
| `src/ingest/run.ts` | orchestrateur 1 commune (bout en bout) |
| `tests/**` | tests Vitest (miroir de `src`) |
| `fixtures/**` | échantillons figés pour tests déterministes |

Build sequence des tâches : scaffold → schéma → ruleset (cœur pur) → agrégats → moteur verdict → géocodage → fetchers → load → orchestrateur.

---

### Task 1 : Scaffolding du projet

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`

- [ ] **Step 1: Initialiser le projet et les dépendances**

Run:
```bash
cd /Users/jeremienehlil/Documents/Code/Personal/res-immobiles
pnpm init
pnpm add drizzle-orm pg
pnpm add -D typescript tsx vitest drizzle-kit @types/pg @types/node
```

- [ ] **Step 2: Écrire `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"],
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Écrire `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
})
```

- [ ] **Step 4: Ajouter `"type": "module"` et les scripts à `package.json`**

```json
{
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "ingest": "tsx src/ingest/run.ts",
    "db:push": "drizzle-kit push"
  }
}
```

- [ ] **Step 5: Écrire `.gitignore`**

```
node_modules
dist
.env
/tmp
```

- [ ] **Step 6: Vérifier que le harnais de test tourne (à vide)**

Run: `pnpm test`
Expected: Vitest démarre, "No test files found" (exit 0 ou message « no tests »).

- [ ] **Step 7: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold ts/postgres/vitest project"
```

---

### Task 2 : Schéma Postgres (Drizzle)

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`

- [ ] **Step 1: Écrire `src/db/schema.ts`**

```ts
import { pgTable, serial, text, integer, doublePrecision, index } from 'drizzle-orm/pg-core'

// Ventes DVF (logements), géocodées BAN
export const dvfMutations = pgTable('dvf_mutations', {
  id: serial('id').primaryKey(),
  idMutation: text('id_mutation').notNull(),
  insee: text('insee').notNull(),
  iris: text('iris'),                       // maille zone (rempli plus tard ; commune en repli)
  banId: text('ban_id'),
  typeLocal: text('type_local').notNull(),  // 'Maison' | 'Appartement'
  valeurFonciere: doublePrecision('valeur_fonciere'),
  surfaceReelle: doublePrecision('surface_reelle'),
  prixM2: doublePrecision('prix_m2'),
  etiquetteDpe: text('etiquette_dpe'),      // classe jointe depuis DPE (peut être null)
}, (t) => ({ inseeIdx: index('dvf_insee_idx').on(t.insee) }))

// DPE logements existants (clé BAN + énergie)
export const dpeLogements = pgTable('dpe_logements', {
  id: serial('id').primaryKey(),
  banId: text('ban_id').notNull(),
  insee: text('insee').notNull(),
  typeBatiment: text('type_batiment').notNull(), // 'maison' | 'appartement' | 'immeuble'
  etiquette: text('etiquette'),
  surfaceHabitable: doublePrecision('surface_habitable'),
  etage: text('etage'),
}, (t) => ({ banIdx: index('dpe_ban_idx').on(t.banId) }))

// Agrégat précalculé : décote €/m² par zone × classe × type
export const zoneDecote = pgTable('zone_decote', {
  id: serial('id').primaryKey(),
  insee: text('insee').notNull(),
  typeLocal: text('type_local').notNull(),
  etiquette: text('etiquette').notNull(),
  prixM2Median: doublePrecision('prix_m2_median').notNull(),
  n: integer('n').notNull(),
}, (t) => ({ zIdx: index('zd_idx').on(t.insee, t.typeLocal) }))

// Agrégat précalculé : coût travaux pour atteindre une classe cible
export const coutTravaux = pgTable('cout_travaux', {
  id: serial('id').primaryKey(),
  classeCible: text('classe_cible').notNull(),   // 'A'..'G'
  trancheSurface: text('tranche_surface').notNull(), // ex '60-90'
  coutMedian: doublePrecision('cout_median').notNull(),
  coutP25: doublePrecision('cout_p25').notNull(),
  coutP75: doublePrecision('cout_p75').notNull(),
  n: integer('n').notNull(),
})
```

- [ ] **Step 2: Écrire `src/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool)
export { pool }
```

- [ ] **Step 3: Écrire `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

- [ ] **Step 4: Pousser le schéma vers une base locale**

Run:
```bash
createdb resimmo_dev 2>/dev/null; DATABASE_URL=postgres://localhost/resimmo_dev pnpm db:push
```
Expected: drizzle-kit crée les 4 tables sans erreur.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(db): drizzle schema for dvf/dpe + precomputed aggregates"
```

---

### Task 3 : Ruleset réglementaire (cœur pur, golden tests)

**Files:**
- Create: `src/regulatory/ruleset.ts`, `tests/regulatory/ruleset.test.ts`

- [ ] **Step 1: Écrire le test qui échoue — `tests/regulatory/ruleset.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { getEcheanceInterdiction, RULESET_VERSION } from '../../src/regulatory/ruleset'

describe('getEcheanceInterdiction (métropole, droit en vigueur 2026)', () => {
  it('G interdit depuis 2025-01-01', () => {
    expect(getEcheanceInterdiction('G', 'metropole')).toEqual({ classe: 'G', dateInterdiction: '2025-01-01', enVigueur: true })
  })
  it('F interdit au 2028-01-01 (à venir)', () => {
    expect(getEcheanceInterdiction('F', 'metropole')).toEqual({ classe: 'F', dateInterdiction: '2028-01-01', enVigueur: false })
  })
  it('E interdit au 2034-01-01', () => {
    expect(getEcheanceInterdiction('E', 'metropole').dateInterdiction).toBe('2034-01-01')
  })
  it('D et mieux : pas d’échéance', () => {
    expect(getEcheanceInterdiction('D', 'metropole').dateInterdiction).toBeNull()
  })
  it('outre-mer : G au 2028-01-01', () => {
    expect(getEcheanceInterdiction('G', 'outremer').dateInterdiction).toBe('2028-01-01')
  })
  it('le ruleset est versionné et daté', () => {
    expect(RULESET_VERSION).toMatch(/^2026-/)
  })
})
```

- [ ] **Step 2: Lancer le test — il doit échouer**

Run: `pnpm test tests/regulatory/ruleset.test.ts`
Expected: FAIL ("Cannot find module ... ruleset").

- [ ] **Step 3: Écrire `src/regulatory/ruleset.ts`**

```ts
// Ruleset réglementaire DATÉ. Source de vérité du moat. Re-vérifier à chaque date d'effet.
// Dernière vérification : 2026-06-11. Sources : service-public A17975 ; ecologie.gouv.fr (réforme DPE 2026).
export const RULESET_VERSION = '2026-06-11'
export const DATE_DU_JOUR = '2026-06-11' // injecté ; remplacé par l'horloge réelle à l'exécution

export type Classe = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export type Territoire = 'metropole' | 'outremer'

const CALENDRIER: Record<Territoire, Partial<Record<Classe, string>>> = {
  metropole: { G: '2025-01-01', F: '2028-01-01', E: '2034-01-01' },
  outremer: { G: '2028-01-01', F: '2031-01-01', E: '2034-01-01' },
}

export interface Echeance {
  classe: Classe
  dateInterdiction: string | null
  enVigueur: boolean
}

export function getEcheanceInterdiction(classe: Classe, territoire: Territoire): Echeance {
  const date = CALENDRIER[territoire][classe] ?? null
  return { classe, dateInterdiction: date, enVigueur: date !== null && date <= DATE_DU_JOUR }
}
```

- [ ] **Step 4: Lancer le test — il doit passer**

Run: `pnpm test tests/regulatory/ruleset.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Ajouter le test des aides (échec d'abord)**

Ajouter à `tests/regulatory/ruleset.test.ts` :

```ts
import { estimateAides } from '../../src/regulatory/ruleset'

describe('estimateAides (MaPrimeRénov 2026, ordre de grandeur)', () => {
  it('profil bleu (très modeste) > profil rose (supérieur) pour le même coût', () => {
    const bleu = estimateAides({ profil: 'bleu', coutTravaux: 30000 })
    const rose = estimateAides({ profil: 'rose', coutTravaux: 30000 })
    expect(bleu.montant).toBeGreaterThan(rose.montant)
    expect(bleu.montant).toBeLessThanOrEqual(30000)
  })
  it('plafonné au coût des travaux', () => {
    expect(estimateAides({ profil: 'bleu', coutTravaux: 1000 }).montant).toBeLessThanOrEqual(1000)
  })
})
```

- [ ] **Step 6: Implémenter `estimateAides` dans `ruleset.ts`**

```ts
export type Profil = 'bleu' | 'jaune' | 'violet' | 'rose'
// Taux indicatifs « rénovation d'ampleur » MaPrimeRénov 2026 (à affiner avec le barème Anah).
const TAUX_AIDE: Record<Profil, number> = { bleu: 0.8, jaune: 0.6, violet: 0.45, rose: 0.3 }

export function estimateAides(input: { profil: Profil; coutTravaux: number }): { montant: number; tauxApplique: number } {
  const taux = TAUX_AIDE[input.profil]
  return { montant: Math.min(input.coutTravaux, Math.round(input.coutTravaux * taux)), tauxApplique: taux }
}
```

- [ ] **Step 7: Lancer toute la suite ruleset — tout passe**

Run: `pnpm test tests/regulatory/ruleset.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(regulatory): dated ruleset (echeances + aides) with golden tests"
```

---

### Task 4 : Agrégat décote (`computeZoneDecote`)

**Files:**
- Create: `src/verdict/decote.ts`, `tests/verdict/decote.test.ts`

> ★ à toi (point de décision métier #1) — à l'exécution, c'est TOI qui écris le corps de `computeZoneDecote` (Step 3). Le choix qui compte : médiane simple par classe vs filtrage des outliers vs pondération par récence des ventes. Le test ci-dessous fixe le contrat ; la méthode est ta décision.

- [ ] **Step 1: Écrire le test qui échoue — `tests/verdict/decote.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { computeZoneDecote } from '../../src/verdict/decote'

const rows = [
  { insee: '17300', typeLocal: 'Maison', etiquette: 'D', prixM2: 4700 },
  { insee: '17300', typeLocal: 'Maison', etiquette: 'D', prixM2: 4740 },
  { insee: '17300', typeLocal: 'Maison', etiquette: 'G', prixM2: 4200 },
  { insee: '17300', typeLocal: 'Maison', etiquette: 'G', prixM2: 4360 },
]

describe('computeZoneDecote', () => {
  it('regroupe par insee×type×classe et sort la médiane €/m² + n', () => {
    const out = computeZoneDecote(rows)
    const d = out.find((x) => x.etiquette === 'D')!
    const g = out.find((x) => x.etiquette === 'G')!
    expect(d).toMatchObject({ insee: '17300', typeLocal: 'Maison', prixM2Median: 4720, n: 2 })
    expect(g.prixM2Median).toBe(4280)
  })
  it('ignore les lignes sans prixM2 ou sans étiquette', () => {
    const out = computeZoneDecote([{ insee: '17300', typeLocal: 'Maison', etiquette: null, prixM2: 5000 } as any])
    expect(out).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Lancer le test — il doit échouer**

Run: `pnpm test tests/verdict/decote.test.ts`
Expected: FAIL ("Cannot find module ... decote").

- [ ] **Step 3: Écrire `src/verdict/decote.ts`** ★ (à toi)

```ts
export interface DecoteRow { insee: string; typeLocal: string; etiquette: string | null; prixM2: number | null }
export interface ZoneDecoteAgg { insee: string; typeLocal: string; etiquette: string; prixM2Median: number; n: number }

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function computeZoneDecote(rows: DecoteRow[]): ZoneDecoteAgg[] {
  const groups = new Map<string, number[]>()
  for (const r of rows) {
    if (!r.etiquette || r.prixM2 == null) continue
    const key = `${r.insee}|${r.typeLocal}|${r.etiquette}`
    ;(groups.get(key) ?? groups.set(key, []).get(key)!).push(r.prixM2)
  }
  return [...groups.entries()].map(([key, vals]) => {
    const [insee, typeLocal, etiquette] = key.split('|')
    return { insee, typeLocal, etiquette, prixM2Median: median(vals), n: vals.length }
  })
}
```

- [ ] **Step 4: Lancer le test — il doit passer**

Run: `pnpm test tests/verdict/decote.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(verdict): zone decote aggregate from labeled DVF rows"
```

---

### Task 5 : Agrégat coût travaux (`computeCoutTravaux`)

**Files:**
- Create: `src/verdict/cout.ts`, `tests/verdict/cout.test.ts`

- [ ] **Step 1: Écrire le test qui échoue — `tests/verdict/cout.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { computeCoutTravaux, trancheSurface } from '../../src/verdict/cout'

describe('trancheSurface', () => {
  it('range par tranches de 30 m²', () => {
    expect(trancheSurface(75)).toBe('60-90')
    expect(trancheSurface(30)).toBe('30-60')
  })
})

describe('computeCoutTravaux', () => {
  it('médiane + p25/p75 par classe-cible × tranche', () => {
    const audits = [
      { classeBilan: 'D', surface: 75, coutCumule: 20000 },
      { classeBilan: 'D', surface: 80, coutCumule: 28000 },
      { classeBilan: 'D', surface: 70, coutCumule: 36000 },
    ]
    const out = computeCoutTravaux(audits)
    const d = out.find((x) => x.classeCible === 'D' && x.trancheSurface === '60-90')!
    expect(d.coutMedian).toBe(28000)
    expect(d.n).toBe(3)
    expect(d.coutP25).toBeLessThanOrEqual(d.coutMedian)
    expect(d.coutP75).toBeGreaterThanOrEqual(d.coutMedian)
  })
})
```

- [ ] **Step 2: Lancer le test — il doit échouer**

Run: `pnpm test tests/verdict/cout.test.ts`
Expected: FAIL ("Cannot find module ... cout").

- [ ] **Step 3: Écrire `src/verdict/cout.ts`**

```ts
export interface AuditRow { classeBilan: string | null; surface: number | null; coutCumule: number | null }
export interface CoutAgg { classeCible: string; trancheSurface: string; coutMedian: number; coutP25: number; coutP75: number; n: number }

export function trancheSurface(s: number): string {
  const lo = Math.floor(s / 30) * 30
  return `${lo}-${lo + 30}`
}

function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const base = Math.floor(pos)
  return s[base + 1] !== undefined ? s[base] + (pos - base) * (s[base + 1] - s[base]) : s[base]
}

export function computeCoutTravaux(audits: AuditRow[]): CoutAgg[] {
  const groups = new Map<string, number[]>()
  for (const a of audits) {
    if (!a.classeBilan || a.surface == null || a.coutCumule == null || a.coutCumule <= 0) continue
    const key = `${a.classeBilan}|${trancheSurface(a.surface)}`
    ;(groups.get(key) ?? groups.set(key, []).get(key)!).push(a.coutCumule)
  }
  return [...groups.entries()].map(([key, vals]) => {
    const [classeCible, trancheSurface] = key.split('|')
    return { classeCible, trancheSurface, coutMedian: quantile(vals, 0.5), coutP25: quantile(vals, 0.25), coutP75: quantile(vals, 0.75), n: vals.length }
  })
}
```

- [ ] **Step 4: Lancer le test — il doit passer**

Run: `pnpm test tests/verdict/cout.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(verdict): cost-to-reach-class aggregate from ADEME audits"
```

---

### Task 6 : Moteur de verdict (`getVerdict`) — le cœur

**Files:**
- Create: `src/verdict/types.ts`, `src/verdict/engine.ts`, `tests/verdict/engine.test.ts`

> ★ à toi (point de décision métier #2) — à l'exécution, c'est TOI qui écris la fonction `classerVerdict` (Step 4), qui transforme la marge en label *bonne affaire / correct / piège*. Les seuils sont un vrai choix produit. Le test fixe le contrat directionnel ; les bornes sont ta décision.

- [ ] **Step 1: Écrire `src/verdict/types.ts`**

```ts
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
```

- [ ] **Step 2: Écrire le test qui échoue — `tests/verdict/engine.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { getVerdict } from '../../src/verdict/engine'
import type { VerdictInput } from '../../src/verdict/types'

// deps mockées : pas de DB en test
const deps = {
  zoneDecote: [
    { insee: '17300', typeLocal: 'Maison', etiquette: 'G', prixM2Median: 4280, n: 57 },
    { insee: '17300', typeLocal: 'Maison', etiquette: 'D', prixM2Median: 4720, n: 387 },
  ],
  coutTravaux: [
    { classeCible: 'D', trancheSurface: '90-120', coutMedian: 28000, coutP25: 20000, coutP75: 38000, n: 40 },
  ],
}

const base: VerdictInput = {
  insee: '17300', typeLocal: 'Maison', surface: 100, prixDemande: 400000,
  classeDpe: 'G', profilAides: 'rose', classeCible: 'D',
}

describe('getVerdict', () => {
  it('calcule la marge = valeur cible − prix − coût net d’aides', () => {
    const f = getVerdict(base, deps)
    // valeur cible = 4720 €/m² × 100 = 472000 ; coût net = 28000 − 30%*28000 = 19600
    // marge = 472000 − 400000 − 19600 = 52400
    expect(f.margePotentielle).toBe(52400)
    expect(f.echeance.classe).toBe('G')
    expect(f.echeance.enVigueur).toBe(true)
    expect(f.prixM2Demande).toBe(4000)
  })
  it('positionne le prix demandé vs comparable classe actuelle', () => {
    const f = getVerdict(base, deps)
    // 4000 €/m² demandé vs 4280 médian classe G -> sous-coté
    expect(f.comparable.positionnement).toBe('sous-cote')
  })
  it('renvoie indetermine quand aucun comparable cible', () => {
    const f = getVerdict({ ...base, insee: '99999' }, deps)
    expect(f.verdict).toBe('indetermine')
    expect(f.margePotentielle).toBeNull()
  })
})
```

- [ ] **Step 3: Lancer le test — il doit échouer**

Run: `pnpm test tests/verdict/engine.test.ts`
Expected: FAIL ("Cannot find module ... engine").

- [ ] **Step 4: Écrire `src/verdict/engine.ts`** (la fonction `classerVerdict` est ★ à toi)

```ts
import { getEcheanceInterdiction, estimateAides } from '../regulatory/ruleset'
import { trancheSurface } from './cout'
import type { Fiche, VerdictInput, Confiance } from './types'

interface Deps {
  zoneDecote: { insee: string; typeLocal: string; etiquette: string; prixM2Median: number; n: number }[]
  coutTravaux: { classeCible: string; trancheSurface: string; coutMedian: number; coutP25: number; coutP75: number; n: number }[]
}

function confiance(n: number): Confiance {
  return { n, niveau: n >= 50 ? 'haute' : n >= 15 ? 'moyenne' : 'faible' }
}

// ★ à toi : seuils du verdict (choix produit)
function classerVerdict(marge: number | null, prixDemande: number): Fiche['verdict'] {
  if (marge === null) return 'indetermine'
  const ratio = marge / prixDemande
  if (ratio >= 0.15) return 'bonne-affaire'
  if (ratio >= 0) return 'correct'
  return 'piege'
}

export function getVerdict(input: VerdictInput, deps: Deps): Fiche {
  const cible = input.classeCible ?? 'D'
  const prixM2Demande = Math.round(input.prixDemande / input.surface)

  const decZone = deps.zoneDecote.filter((z) => z.insee === input.insee && z.typeLocal === input.typeLocal)
  const dActuelle = decZone.find((z) => z.etiquette === input.classeDpe) ?? null
  const dCible = decZone.find((z) => z.etiquette === cible) ?? null

  const cout = deps.coutTravaux.find((c) => c.classeCible === cible && c.trancheSurface === trancheSurface(input.surface)) ?? null
  const aides = cout ? estimateAides({ profil: input.profilAides, coutTravaux: cout.coutMedian }) : { montant: 0 }
  const coutNet = cout ? cout.coutMedian - aides.montant : null

  const valeurCible = dCible ? dCible.prixM2Median * input.surface : null
  const margePotentielle = valeurCible != null && coutNet != null ? Math.round(valeurCible - input.prixDemande - coutNet) : null

  const positionnement: Fiche['comparable']['positionnement'] = !dActuelle
    ? 'inconnu'
    : prixM2Demande < dActuelle.prixM2Median * 0.95 ? 'sous-cote'
    : prixM2Demande > dActuelle.prixM2Median * 1.05 ? 'sur-cote'
    : 'dans-le-marche'

  return {
    prixM2Demande,
    comparable: { prixM2Median: dActuelle?.prixM2Median ?? null, positionnement, confiance: confiance(dActuelle?.n ?? 0) },
    decote: { prixM2ClasseActuelle: dActuelle?.prixM2Median ?? null, prixM2ClasseCible: dCible?.prixM2Median ?? null, confiance: confiance(dCible?.n ?? 0) },
    cout: { median: cout?.coutMedian ?? null, p25: cout?.coutP25 ?? null, p75: cout?.coutP75 ?? null, confiance: confiance(cout?.n ?? 0) },
    echeance: getEcheanceInterdiction(input.classeDpe, 'metropole'),
    aides,
    margePotentielle,
    verdict: classerVerdict(margePotentielle, input.prixDemande),
  }
}
```

- [ ] **Step 5: Lancer le test — il doit passer**

Run: `pnpm test tests/verdict/engine.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(verdict): deterministic verdict engine (fiche from aggregates + ruleset)"
```

---

### Task 7 : Géocodage BAN (`geocodeBatch`)

**Files:**
- Create: `src/ingest/geocode.ts`, `tests/ingest/geocode.test.ts`

- [ ] **Step 1: Écrire le test qui échoue (fetch mocké) — `tests/ingest/geocode.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { parseGeocodeCsv } from '../../src/ingest/geocode'

describe('parseGeocodeCsv', () => {
  it('mappe key -> {banId, type, citycode} depuis la sortie BAN', () => {
    const csv = 'key,adresse,result_id,result_type,result_citycode\n' +
                '"8 RUE CHAUDRIER|17000","8 RUE CHAUDRIER 17000 LA ROCHELLE",17300_1750_00008,housenumber,17300\n'
    const m = parseGeocodeCsv(csv)
    expect(m.get('8 RUE CHAUDRIER|17000')).toEqual({ banId: '17300_1750_00008', type: 'housenumber', citycode: '17300' })
  })
})
```

- [ ] **Step 2: Lancer le test — échec**

Run: `pnpm test tests/ingest/geocode.test.ts`
Expected: FAIL ("Cannot find module ... geocode").

- [ ] **Step 3: Écrire `src/ingest/geocode.ts`**

```ts
// Parse la sortie CSV du géocodeur BAN en masse. CSV via un parseur tolérant aux guillemets.
export interface GeoResult { banId: string; type: string; citycode: string }

function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (c === ',' && !q) { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur); return out
}

export function parseGeocodeCsv(csv: string): Map<string, GeoResult> {
  const lines = csv.trim().split('\n')
  const header = splitCsvLine(lines[0])
  const ix = (n: string) => header.indexOf(n)
  const m = new Map<string, GeoResult>()
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsvLine(lines[i])
    m.set(f[ix('key')], { banId: f[ix('result_id')] ?? '', type: f[ix('result_type')] ?? '', citycode: f[ix('result_citycode')] ?? '' })
  }
  return m
}

export async function geocodeBatch(addrs: { key: string; adresse: string }[]): Promise<Map<string, GeoResult>> {
  const csv = 'key,adresse\n' + addrs.map((a) => `"${a.key}","${a.adresse}"`).join('\n')
  const form = new FormData()
  form.append('data', new Blob([csv], { type: 'text/csv' }), 'a.csv')
  form.append('columns', 'adresse')
  const res = await fetch('https://api-adresse.data.gouv.fr/search/csv/', { method: 'POST', body: form })
  return parseGeocodeCsv(await res.text())
}
```

- [ ] **Step 4: Lancer le test — passe**

Run: `pnpm test tests/ingest/geocode.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(ingest): BAN bulk geocoder with CSV parser"
```

---

### Task 8 : Fetchers de sources (DVF / DPE / Audits)

**Files:**
- Create: `src/ingest/sources.ts`, `tests/ingest/sources.test.ts`, `fixtures/dvf-sample.csv`

- [ ] **Step 1: Créer `fixtures/dvf-sample.csv`** (en-tête geo-DVF réel + 2 lignes)

```
id_mutation,date_mutation,numero_disposition,nature_mutation,valeur_fonciere,adresse_numero,adresse_suffixe,adresse_nom_voie,adresse_code_voie,code_postal,code_commune,nom_commune,code_departement,ancien_code_commune,ancien_nom_commune,id_parcelle,ancien_id_parcelle,numero_volume,lot1_numero,lot1_surface_carrez,lot2_numero,lot2_surface_carrez,lot3_numero,lot3_surface_carrez,lot4_numero,lot4_surface_carrez,lot5_numero,lot5_surface_carrez,nombre_lots,code_type_local,type_local,surface_reelle_bati,nombre_pieces_principales,code_nature_culture,nature_culture,code_nature_culture_speciale,nature_culture_speciale,surface_terrain,longitude,latitude
2022-1,2022-01-05,000001,Vente,400000,52,,RUE DE L ARTILLERIE,1234,17000,17300,La Rochelle,17,,,17300000CP0387,,,,,,,,,,,,,,0,1,Maison,110,5,,,,,,−1.15,46.16
2022-2,2022-02-10,000001,Vente,200000,19,,RUE DE LA CHAINE,4567,17000,17300,La Rochelle,17,,,17300000EK0047,,,,,60,,,,,,,,,1,2,Appartement,60,3,,,,,,−1.15,46.16
```

- [ ] **Step 2: Écrire le test qui échoue — `tests/ingest/sources.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseDvfCsv } from '../../src/ingest/sources'

describe('parseDvfCsv', () => {
  it('ne garde que Vente + Maison/Appartement et calcule prixM2', () => {
    const rows = parseDvfCsv(readFileSync('fixtures/dvf-sample.csv', 'utf8'))
    expect(rows).toHaveLength(2)
    const maison = rows.find((r) => r.typeLocal === 'Maison')!
    expect(maison.prixM2).toBeCloseTo(400000 / 110, 0)
    expect(maison.insee).toBe('17300')
  })
})
```

- [ ] **Step 3: Lancer le test — échec**

Run: `pnpm test tests/ingest/sources.test.ts`
Expected: FAIL ("Cannot find module ... sources").

- [ ] **Step 4: Écrire `src/ingest/sources.ts`**

```ts
import { splitCsvLine } from './geocode' // réutilise le parseur CSV (exporter splitCsvLine depuis geocode.ts)

export interface DvfRow {
  idMutation: string; insee: string; typeLocal: 'Maison' | 'Appartement'
  valeurFonciere: number; surfaceReelle: number; prixM2: number | null
  adresseKey: string; adresse: string
}

export function parseDvfCsv(csv: string): DvfRow[] {
  const lines = csv.trim().split('\n')
  const h = splitCsvLine(lines[0]); const ix = (n: string) => h.indexOf(n)
  const out: DvfRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsvLine(lines[i])
    if (f[ix('nature_mutation')] !== 'Vente') continue
    const t = f[ix('type_local')]
    if (t !== 'Maison' && t !== 'Appartement') continue
    const vf = Number(f[ix('valeur_fonciere')]); const s = Number(f[ix('surface_reelle_bati')])
    const adresse = `${f[ix('adresse_numero')]} ${f[ix('adresse_suffixe')]} ${f[ix('adresse_nom_voie')]}`.replace(/\s+/g, ' ').trim()
    out.push({
      idMutation: f[ix('id_mutation')], insee: f[ix('code_commune')], typeLocal: t,
      valeurFonciere: vf, surfaceReelle: s, prixM2: s > 0 ? vf / s : null,
      adresseKey: `${adresse}|${f[ix('code_postal')]}`, adresse,
    })
  }
  return out
}

const DPE_DS = 'meg-83tjwtg8dyz4vv7h1dqe'
const AUDIT_DS = 'ync2epx48x9azbdnggbygqp0'

export async function fetchDvf(insee: string, dept: string, years = ['2022', '2023', '2024']): Promise<DvfRow[]> {
  const all: DvfRow[] = []
  for (const y of years) {
    const url = `https://geo-dvf.s3.sbg.io.cloud.ovh.net/latest/csv/${y}/communes/${dept}/${insee}.csv`
    const res = await fetch(url)
    if (res.ok) all.push(...parseDvfCsv(await res.text()))
  }
  return all
}

export async function fetchDpe(insee: string): Promise<any[]> {
  const rows: any[] = []
  let url: string | null = `https://data.ademe.fr/data-fair/api/v1/datasets/${DPE_DS}/lines?size=10000&qs=code_insee_ban:${insee}&select=identifiant_ban,etiquette_dpe,type_batiment,surface_habitable_logement,numero_etage_appartement`
  while (url) {
    const d: any = await (await fetch(url)).json()
    rows.push(...(d.results ?? []))
    url = d.next ?? null
  }
  return rows
}

export async function fetchAudits(insee: string): Promise<any[]> {
  const rows: any[] = []
  let url: string | null = `https://data.ademe.fr/data-fair/api/v1/datasets/${AUDIT_DS}/lines?size=1000&qs=code_insee_ban:${insee}&select=couts_cumules_travaux,classe_bilan_dpe,surface_habitable_logement,etape_travaux`
  while (url) {
    const d: any = await (await fetch(url)).json()
    rows.push(...(d.results ?? []))
    url = d.next ?? null
  }
  return rows
}
```

- [ ] **Step 5: Exporter `splitCsvLine` depuis `geocode.ts`** (changer `function splitCsvLine` en `export function splitCsvLine`).

- [ ] **Step 6: Lancer le test — passe**

Run: `pnpm test tests/ingest/sources.test.ts`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(ingest): DVF/DPE/Audits fetchers + DVF CSV parser"
```

---

### Task 9 : Chargement + jointure + orchestrateur

**Files:**
- Create: `src/ingest/load.ts`, `src/ingest/run.ts`, `tests/ingest/load.test.ts`

- [ ] **Step 1: Écrire le test qui échoue (jointure pure) — `tests/ingest/load.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { labelDvfWithDpe } from '../../src/ingest/load'

describe('labelDvfWithDpe', () => {
  it('étiquette une vente maison par le DPE maison à la même adresse BAN (surface la plus proche)', () => {
    const dvf = [{ adresseKey: 'A|17000', banId: 'B1', typeLocal: 'Maison', surfaceReelle: 100 } as any]
    const dpeByBan = new Map([['B1', [{ type_batiment: 'maison', etiquette_dpe: 'E', surface_habitable_logement: 98 },
                                       { type_batiment: 'maison', etiquette_dpe: 'C', surface_habitable_logement: 60 }]]])
    const out = labelDvfWithDpe(dvf, dpeByBan)
    expect(out[0].etiquetteDpe).toBe('E') // 98 plus proche de 100 que 60
  })
})
```

- [ ] **Step 2: Lancer — échec**

Run: `pnpm test tests/ingest/load.test.ts`
Expected: FAIL ("Cannot find module ... load").

- [ ] **Step 3: Écrire `src/ingest/load.ts`**

```ts
import { db } from '../db/client'
import { dvfMutations, dpeLogements, zoneDecote, coutTravaux } from '../db/schema'
import { computeZoneDecote } from '../verdict/decote'
import { computeCoutTravaux } from '../verdict/cout'

export function labelDvfWithDpe(dvf: any[], dpeByBan: Map<string, any[]>): any[] {
  return dvf.map((d) => {
    const cands = (dpeByBan.get(d.banId) ?? []).filter((x) => x.type_batiment === (d.typeLocal === 'Maison' ? 'maison' : 'appartement') && x.etiquette_dpe)
    if (!cands.length) return { ...d, etiquetteDpe: null }
    const best = cands.reduce((a, b) =>
      Math.abs((b.surface_habitable_logement ?? 0) - d.surfaceReelle) < Math.abs((a.surface_habitable_logement ?? 0) - d.surfaceReelle) ? b : a)
    return { ...d, etiquetteDpe: best.etiquette_dpe }
  })
}

export async function loadCommune(args: {
  insee: string; dvfLabeled: any[]; dpeRows: any[]; auditRows: any[]
}) {
  await db.insert(dvfMutations).values(args.dvfLabeled.map((d) => ({
    idMutation: d.idMutation, insee: d.insee, banId: d.banId, typeLocal: d.typeLocal,
    valeurFonciere: d.valeurFonciere, surfaceReelle: d.surfaceReelle, prixM2: d.prixM2, etiquetteDpe: d.etiquetteDpe,
  })))
  await db.insert(dpeLogements).values(args.dpeRows.filter((r) => r.identifiant_ban).map((r) => ({
    banId: r.identifiant_ban, insee: args.insee, typeBatiment: r.type_batiment ?? '',
    etiquette: r.etiquette_dpe, surfaceHabitable: r.surface_habitable_logement, etage: r.numero_etage_appartement,
  })))
  // Agrégats
  const decote = computeZoneDecote(args.dvfLabeled.map((d) => ({ insee: d.insee, typeLocal: d.typeLocal, etiquette: d.etiquetteDpe, prixM2: d.prixM2 })))
  if (decote.length) await db.insert(zoneDecote).values(decote)
  const audits = args.auditRows.map((a) => ({ classeBilan: a.classe_bilan_dpe, surface: a.surface_habitable_logement, coutCumule: a.couts_cumules_travaux }))
  const cout = computeCoutTravaux(audits)
  if (cout.length) await db.insert(coutTravaux).values(cout)
}
```

- [ ] **Step 4: Lancer — passe**

Run: `pnpm test tests/ingest/load.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Écrire l'orchestrateur `src/ingest/run.ts`**

```ts
import { fetchDvf, fetchDpe, fetchAudits } from './sources'
import { geocodeBatch } from './geocode'
import { labelDvfWithDpe, loadCommune } from './load'

// Usage: DATABASE_URL=... pnpm ingest 17300 17
async function main() {
  const [insee, dept] = process.argv.slice(2)
  if (!insee || !dept) throw new Error('usage: ingest <insee> <dept>')

  const dvf = await fetchDvf(insee, dept)
  const dpeRows = await fetchDpe(insee)
  const auditRows = await fetchAudits(insee)

  // géocodage des adresses DVF distinctes
  const distinct = new Map<string, string>()
  for (const d of dvf) distinct.set(d.adresseKey, `${d.adresse} ${d.insee} LA ROCHELLE`)
  const geo = await geocodeBatch([...distinct].map(([key, adresse]) => ({ key, adresse })))
  for (const d of dvf) (d as any).banId = geo.get(d.adresseKey)?.banId ?? null

  const dpeByBan = new Map<string, any[]>()
  for (const r of dpeRows) {
    if (!r.identifiant_ban) continue
    ;(dpeByBan.get(r.identifiant_ban) ?? dpeByBan.set(r.identifiant_ban, []).get(r.identifiant_ban)!).push(r)
  }
  const dvfLabeled = labelDvfWithDpe(dvf, dpeByBan)

  await loadCommune({ insee, dvfLabeled, dpeRows, auditRows })
  console.log(`OK ${insee}: DVF=${dvf.length} DPE=${dpeRows.length} audits=${auditRows.length}`)
  process.exit(0)
}
main()
```

- [ ] **Step 6: Exécuter l'ingestion réelle pour La Rochelle**

Run:
```bash
DATABASE_URL=postgres://localhost/resimmo_dev pnpm ingest 17300 17
```
Expected: `OK 17300: DVF=~13000 DPE=~33000 audits=...` et les 4 tables peuplées.

- [ ] **Step 7: Vérifier un verdict bout-en-bout (script manuel jetable)**

Run (Node REPL ou script tsx) : charger `zoneDecote`/`coutTravaux` depuis la DB, appeler `getVerdict({insee:'17300', typeLocal:'Maison', surface:110, prixDemande:430000, classeDpe:'G', profilAides:'rose', classeCible:'D'}, deps)` et confirmer une fiche cohérente (échéance G en vigueur, marge calculée, comparables non nuls).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(ingest): commune orchestrator + DVF/DPE join + aggregate load"
```

---

## Self-Review (couverture du spec)

- **§4-5 fiche** : comparable, décote, coût, échéance, aides, marge → Tasks 4/5/6 + ruleset Task 3. Le rendement locatif optionnel n'est PAS dans ce sous-projet (input loyer non collecté ici) — il viendra avec l'UI (sous-projet 2). ✅ cohérent avec la décomposition.
- **§6 archi** : schéma (Task 2), agrégats précalculés (Tasks 4/5 + load Task 9), ruleset daté (Task 3), moteur lisant du précalculé (Task 6), ingestion (Tasks 7-9). IRIS : colonne présente, peuplée plus tard (repli `insee`). ✅
- **Placeholders** : aucun « TODO » ; les 2 `★ à toi` sont des points de décision intentionnels (learning-mode), pas des placeholders — le code complet de repli est fourni et testé.
- **Cohérence des types** : `computeZoneDecote`/`computeCoutTravaux` renvoient exactement les formes consommées par `Deps` dans `engine.ts` ; `trancheSurface` partagé entre `cout.ts` et `engine.ts` ; `splitCsvLine` exporté depuis `geocode.ts` et réutilisé par `sources.ts`. ✅
- **Non couvert volontairement** (YAGNI / autres sous-projets) : UI, SEO, auth/freemium, recalcul DPE 2026 par le détail énergétique (amélioration de l'échéance — à ajouter quand le forward matching est branché côté requête).
```
