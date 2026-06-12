# Handoff — Verdict immo

> Rédigé le 2026-06-12. Reprise prévue : semaine prochaine.
> Repo : `jeremN/res-immobiles` (public, branche `main`). App live : **https://visionary-seahorse-28d6ac.netlify.app/**

## TL;DR — où on en est

L'app **« Verdict immo »** est **en ligne et fonctionnelle** (verdict investisseur sur un bien, données publiques DVF/DPE/audits, La Rochelle). Cette session a livré : déploiement DB-free, refonte UX « chaleureuse », favicon, et **SP-B** (fondation runtime pour passer au national). **La prochaine étape est SP-A : l'ingestion nationale** qui produit la couverture « max communes ». SP-A n'est **pas commencé**.

⚠️ **Écart prod ↔ main** : `main` contient SP-B (runtime store par-département) mais **la prod tourne encore sur l'ancien runtime** (JSON La Rochelle bundlé). SP-B est validé en local. Pour shipper SP-B : `pnpm build` puis `npx netlify deploy --prod`. **Aucun changement visible utilisateur** (La Rochelle marche pareil, le reste = hors-zone) — c'est un refactor d'archi. Optionnel de le déployer maintenant ; la prod actuelle marche.

## Architecture (1 commune → national)

- **Verdict** : `getVerdict(input, deps)` dans `src/verdict/engine.ts` — pur, filtre par `insee`/`dept`. Inchangé, déjà multi-commune.
- **Runtime (SP-B, dans `main`)** : la server function `src/web/verdict.fn.ts` dérive l'origine de la requête (`getRequestUrl({xForwardedHost:true})`), **fetch `/agg/<dept>.json`** (statique, CDN, edge-cache) via `src/web/deptStore.ts` (`fetchDeptAgg` + `pickDeps`), puis `buildResult`. Couverture **dérivée** : 404 → hors-zone ; 5xx/réseau → erreur récupérable ; dépt présent mais commune sans ventes → `couverte:true` + verdict `indéterminé`.
- **Données runtime** : `public/agg/<dd>.json` = `{ dept, zoneDecote:[…toutes communes du dépt], coutTravaux:[…dépt] }`. **Seul `public/agg/17.json` existe** (La Rochelle). SP-A produira les ~92 autres.
- **Store** : pas de DB au runtime. Fichiers statiques par département servis par le CDN.

## Fait cette session (tout sur `main`, poussé)

1. **Déploiement DB-free** : agrégats empaquetés JSON, `getDeps` → Postgres retiré du runtime, adaptateur Netlify. Specs/plans `docs/superpowers/{specs,plans}/2026-06-11-deploiement-netlify*`.
2. **Refonte UX** (direction « chaleureuse rassurante ») : design system tokenisé `src/styles.css`, saisies contraintes (DPE segmenté, type toggle, profil libellé), validation + gestion d'erreur + a11y, fiche restylée. Critique impeccable passée d'un proto 20/40 → outil crédible. Specs/plans `…/2026-06-12-refonte-page-verdict*`.
3. **Favicon** maison+check terracotta (`public/favicon.svg` + png/ico, `<link>` dans `__root`).
4. **SP-B — runtime store par-département** : `deptStore.ts`, bascule `verdict.fn.ts`, refacto `buildResult` (chemin couvert), `public/agg/17.json`, parité préservée (verdict « bonne affaire », marge 76 713 €). 51 tests verts. Specs/plans `…/2026-06-12-scaling-runtime-dept-store*`.

## NEXT — SP-A : ingestion nationale (le gros morceau)

**But** : produire tous les `public/agg/<dd>.json` (~93 depts métropole **hors Alsace-Moselle 67/68/57**, DVF y est aveugle). Couverture = national, tout DVF-couvert ; communes à faible volume → verdict « indéterminé » honnête (assumé).

**À faire** (≈ refonte de `src/ingest/`) :
1. **Sourcing par département, pas par commune** : télécharger les fichiers bulk — DVF (geo-dvf S3, par dépt/année), DPE (ADEME data-fair, filtré dépt), audits ADEME (dépt). Plus d'appels API unitaires par commune.
2. **Corriger le bug géocodage** : `src/ingest/run.ts` colle `" LA ROCHELLE"` **en dur** sur chaque adresse avant BAN → géocoder par **citycode** (BAN accepte une colonne citycode) ou nom de commune réel.
3. **`cout_travaux` à l'échelle du dépt** : aujourd'hui `loadCommune` fait `delete coutTravaux where dept` puis recompute depuis les audits **de la seule commune** → 2 communes d'un même dépt s'écrasent. Sourcer les audits **par dépt** (`fetchAudits(dept)`).
4. **Batch sur 93 depts** → staging Postgres local → **export** un `public/agg/<dd>.json` par dépt. Réécrire `scripts/dump-aggregates.ts` (actuellement figé 17300/17 et **obsolète** : il écrit l'ancien `aggregates.lr.json` supprimé).
5. **Dérisquer sur 1-2 depts d'abord** (tailles réelles DVF/DPE, limites/débit BAN en masse, temps de batch) **avant** le run national.
6. **Taille des artefacts** : ~25-40 Mo de JSON committés dans `public/agg/`. Si git souffre → Git LFS.

**Process** : SP-A aura son propre **brainstorm → spec → plan → subagent-driven build** (comme les autres). Commencer par le brainstorm (questions ouvertes : où tourne le batch — local on-demand vs cloud scheduled ; format/staging ; stratégie de dérisquage).

## Backlog / loose ends (non bloquants)

- `scripts/dump-aggregates.ts` : **obsolète** (écrit `aggregates.lr.json` supprimé) → réécrit par SP-A.
- Copie hors-zone dans `src/routes/index.tsx` dit encore « lancement : La Rochelle » → à généraliser quand le national arrive.
- `src/ingest/geocode.ts` `parseBanSearch` : `dept = citycode.slice(0,2)` → faux pour DOM (97x, 3 car.). **Métropole only** pour l'instant donc OK (un code 97x → 404 → hors-zone, comportement voulu) ; à corriger si DOM ajouté.
- `fetchDeptAgg` : pas de timeout/`AbortSignal`, pas de mémoïsation cross-invocation (l'edge-cache CDN suffit pour démarrer) → à mesurer/ajouter si latence.
- `src/web/aggregates.ts`/`getDeps` retirés ; `src/web/loadDeps.ts` + `src/db/` restent (utilisés par les scripts d'ingest locaux, pas par l'app déployée).
- `favicon` : raster 16px OK ; pas d'apple-touch testé sur device réel.

## Carte des fichiers clés

| Domaine | Fichier |
|---|---|
| Moteur verdict | `src/verdict/engine.ts`, `src/verdict/{decote,cout,types}.ts` |
| Réglementaire | `src/regulatory/ruleset.ts` (échéances DPE, aides ; `RULESET_VERSION`) |
| Runtime web | `src/web/verdict.fn.ts` (server fn), `src/web/deptStore.ts`, `src/web/result.ts`, `src/web/form.ts`, `src/web/fiche-format.ts` |
| UI | `src/routes/{index,__root}.tsx`, `src/components/{Field,Segmented,Fiche}.tsx`, `src/styles.css` |
| Données runtime | `public/agg/17.json` (seul existant) |
| Ingestion (à refondre SP-A) | `src/ingest/{run,sources,load,geocode}.ts` |
| Parseur annonce | `src/parse/annonce.ts` |
| DB (build-time/scripts) | `src/db/{client,schema}.ts`, `loadDeps.ts` |
| Scripts | `scripts/{check-deploy-result,check-page-result,check-verdict,dump-aggregates}.ts` |

## Recettes opérationnelles

```bash
pnpm test            # vitest (51 verts)
pnpm build           # vite build → dist/ + .netlify/v1/functions/server.mjs
pnpm dev             # vite dev sur :5188 (sert aussi /agg/*.json depuis public/)

# Déployer (auth Netlify déjà faite, site lié) :
pnpm build && npx netlify deploy --prod

# Parité runtime sans réseau (chemin couvert) :
pnpm exec tsx scripts/check-deploy-result.ts   # attend couverte:true, marge ~76713

# Ingestion 1 commune (ANCIEN flux, sera remplacé par SP-A) :
pnpm exec tsx --env-file=.env src/ingest/run.ts <insee> <dept>
```

Postgres local : `resimmo_dev` (`.env` → `DATABASE_URL`, gitignored). Gestionnaire de paquets : **pnpm 11.5.3** (champ corepack `packageManager` dans package.json ; **pas** de `devEngines` — il cassait `npx netlify`, cf. mémoire).

## Contraintes data (validées, en mémoire)

- **DVF aveugle en Alsace-Moselle (67/68/57)** → ces depts non couvrables.
- **Volume nécessaire** : confiance `n` faible <15 / moyenne ≥15 / haute ≥50 ; peu de ventes → verdict « indéterminé ».
- Matching apparts forward ~52-72%, maisons ~75-85%.
- Détail : mémoires `dvf-dpe-matching-feasibility`, `dvf-dpe-value-layer-feasibility`, `verdict-app-deployment`.

## Comment reprendre

1. Lire ce fichier + les mémoires du projet (chargées en début de session).
2. Décider : déployer SP-B d'abord (optionnel) ou attaquer directement **SP-A**.
3. Pour SP-A : lancer le **brainstorming** (superpowers) sur l'ingestion nationale — design d'abord, dérisquer sur 1-2 depts, puis spec → plan → subagent-driven build.

## Inventaire specs/plans

- `docs/superpowers/specs/2026-06-11-verdict-investisseur-design.md` · `2026-06-11-page-verdict-ux-design.md`
- `docs/superpowers/specs/2026-06-11-deploiement-netlify-design.md`
- `docs/superpowers/specs/2026-06-12-refonte-page-verdict-design.md`
- `docs/superpowers/specs/2026-06-12-scaling-runtime-dept-store-design.md`
- `docs/superpowers/plans/2026-06-11-socle-donnees-moteur-verdict.md` · `2026-06-11-page-verdict.md` · `2026-06-11-deploiement-netlify.md`
- `docs/superpowers/plans/2026-06-12-refonte-page-verdict.md` · `2026-06-12-scaling-runtime-dept-store.md`
