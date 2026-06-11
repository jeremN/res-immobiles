# Design — Déploiement Netlify de la page Verdict

> Statut : design validé (brainstorming), prêt pour plan d'implémentation.
> Date : 2026-06-11.
> Socle : sous-projet 2 livré (page Verdict TanStack Start, server function `getVerdictFn` branchée sur Postgres `resimmo_dev` peuplé La Rochelle). Voir `docs/superpowers/specs/2026-06-11-page-verdict-ux-design.md`.

## 1. Objectif

Mettre la page Verdict derrière une **URL publique** pour la tester avec des investisseurs réels. Tâche bornée : pas de nouvelles fonctionnalités produit, uniquement « la même page, accessible en ligne ». Périmètre de données inchangé : **La Rochelle (INSEE 17300) uniquement**.

## 2. Le verrou à lever : couper Postgres au runtime

Aujourd'hui la server function suit cette chaîne d'imports :

```
getVerdictFn → loadDeps → db/client → pg → process.env.DATABASE_URL
```

Sur Netlify, `getVerdictFn` s'exécute comme **fonction serverless** : il n'y a ni Postgres, ni `DATABASE_URL`. Le bundle inclurait `pg` et échouerait au premier appel.

**Constat clé** : les données nécessaires au runtime sont **61 lignes d'agrégats en lecture seule** (`zone_decote` : 14 lignes pour l'INSEE 17300 ; `cout_travaux` : 47 lignes pour le département 17). Elles sont figées entre deux ré-ingestions. Postgres ne sert qu'à les **produire**, pas à les servir. On les empaquette donc en JSON et on retire Postgres du chemin runtime.

Le seul appel réseau qui reste dans la server function est le **géocodage BAN** (`geocodeOne`, API publique, sans secret) — il est conservé tel quel.

## 3. Composants

### 3.1 `scripts/dump-aggregates.ts` (nouveau, local uniquement)
Script one-shot exécuté en local. Lit les agrégats depuis Postgres via `loadDeps('17300', '17')` et écrit le résultat dans `src/web/aggregates.lr.json`. C'est le **seul** point qui touche encore `pg`, et il ne fait pas partie du build déployé.

Forme du JSON produit (calquée sur l'interface `Deps` + métadonnées de provenance) :

```json
{
  "insee": "17300",
  "dept": "17",
  "zoneDecote": [ { "insee": "17300", "typeLocal": "...", "etiquette": "...", "prixM2Median": 0, "n": 0 } ],
  "coutTravaux": [ { "dept": "17", "classeCible": "...", "trancheSurface": "...", "coutMedian": 0, "coutP25": 0, "coutP75": 0, "n": 0 } ]
}
```

### 3.2 `src/web/aggregates.lr.json` (nouveau, **committé**)
Le snapshot des 61 lignes. Committé dans le repo (≠ gitignore) car c'est la donnée runtime qui doit être empaquetée dans le bundle déployé. Petit (~quelques Ko).

### 3.3 `src/web/aggregates.ts` (nouveau)
Remplaçant DB-free de `loadDeps`. Importe le JSON et renvoie un `Deps`. Même signature que `loadDeps` pour un remplacement direct, mais **synchrone** (pas d'I/O) :

```ts
import data from './aggregates.lr.json'
import type { Deps } from '../verdict/engine'

export function getDeps(insee: string, dept: string): Deps {
  return {
    zoneDecote: data.zoneDecote.filter((z) => z.insee === insee),
    coutTravaux: data.coutTravaux.filter((c) => c.dept === dept),
  }
}
```

Le filtre `insee`/`dept` reproduit exactement le comportement des `WHERE` de `loadDeps`, ce qui rend le remplacement transparent pour le moteur.

### 3.4 `src/web/verdict.server.ts` (modifié)
Une seule arête change : `loadDeps` (async, pg) → `getDeps` (sync, json). Le reste de la logique (géocodage, garde `citycode !== '17300'`, `buildResult`) est inchangé.

### 3.5 `loadDeps.ts` + `db/client.ts` (inchangés, conservés)
Restent dans le repo pour les scripts locaux (`dump-aggregates.ts`, `check-page-result.ts`). Comme ils ne sont plus importés par la server function, `pg` **n'est plus joignable** depuis le graphe d'imports déployé → exclu du bundle.

### 3.6 `vite.config.ts` (modifié) + `package.json` (modifié)
Ajout de la devDep `@netlify/vite-plugin-tanstack-start` et du plugin `netlify()` entre `tanstackStart()` et `viteReact()`. Le plugin configure lui-même le publish dir et les Netlify Functions — **pas** de bloc `[functions]`/redirects manuel.

### 3.7 `netlify.toml` (nouveau, minimal)
Uniquement la commande de build, pour que la CLI Netlify utilise pnpm de façon déterministe. Le plugin possède publish dir + functions, on ne les redéclare pas :

```toml
[build]
  command = "pnpm build"
```

## 4. Flux de déploiement (l'utilisateur fait l'auth)

1. `pnpm build` en local → **sanity** : confirme que le build passe sans Postgres (preuve que `pg` a bien quitté le graphe).
2. `npx netlify login` → **étape utilisateur** (son compte Netlify).
3. `npx netlify deploy --build` → URL de draft, vérification manuelle d'un verdict.
4. `npx netlify deploy --build --prod` → URL de production publique.

Aucune variable d'environnement à configurer côté Netlify (plus de DB, le géocodage BAN est public).

## 5. Rafraîchir les données

Quand on ré-ingère (plus de communes plus tard), re-lancer `tsx scripts/dump-aggregates.ts` régénère `aggregates.lr.json`, commit, redeploy. Pour l'instant : un seul dump (La Rochelle).

## 6. Tests

- **`getDeps`** (pur, déterministe sur le JSON committé) : renvoie un `Deps` non vide pour `('17300','17')` ; chaque ligne `zoneDecote` a `insee === '17300'`, chaque ligne `coutTravaux` a `dept === '17'` ; filtre un INSEE inconnu → `zoneDecote` vide.
- **Parité chemin déployé** : un script `scripts/check-deploy-result.ts` (DB-free : `geocodeOne` + `getDeps` + `buildResult`) produit une fiche `couverte: true` cohérente pour une adresse La Rochelle — prouve que le chemin sans Postgres fonctionne bout-en-bout.
- **Build** : `pnpm build` réussit (gate final ; échoue si une arête `pg` subsiste dans le bundle serveur).
- Les tests existants (parseur, géocodage, moteur, rendu fiche) restent verts.

## 7. Périmètre / non-objectifs (YAGNI)

**Fait** : runtime DB-free via JSON empaqueté, adaptateur Netlify, déploiement manuel CLI, URL publique.
**Différé** : ❌ hébergement Postgres · ❌ multi-commune au runtime (le JSON = La Rochelle) · ❌ CI/CD auto-deploy (un `netlify deploy` manuel suffit pour l'instant) · ❌ analytics/monitoring · ❌ domaine custom.

## 8. Séquence d'implémentation (pour le plan)

1. `dump-aggregates.ts` + exécution → `aggregates.lr.json` committé (la donnée doit exister avant les tests `getDeps`).
2. `getDeps` (+ tsconfig `resolveJsonModule`) + tests.
3. Bascule `verdict.server.ts` sur `getDeps` + `check-deploy-result.ts` (parité).
4. Adaptateur Netlify (`vite.config.ts`, `package.json`, `netlify.toml`) + `pnpm build` vert.
