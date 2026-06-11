# Design — « Verdict par deal » : aide à la décision pour investisseurs locatifs (donnée publique)

> Statut : design validé (brainstorming), prêt pour plan d'implémentation.
> Date : 2026-06-11. Auteur : Jérémie (+ Claude).
> Voir aussi les findings de faisabilité en mémoire projet : `dvf-dpe-matching-feasibility`, `dvf-dpe-value-layer-feasibility`, et la note d'exploration v0.1.

## 1. Thèse

Construire un actif durable dans l'immobilier français en croisant **uniquement de la donnée publique légale** (DVF, DPE, BAN, Audits ADEME). La valeur et la défensabilité viennent de la **couche réglementaire + analytique** (toujours juste, toujours à jour), pas de l'accès à la donnée ni du matching (commodités). Aucun scraping : l'utilisateur apporte le bien à évaluer.

## 2. Preuves empiriques de faisabilité (mesurées sur données réelles, 2026-06)

Validé sur 14 communes / 8 régions + mesures dédiées :

- **Matching à l'adresse = commodité** : géocodage DVF→BAN au numéro 95-96 % ; join adresse→DPE 77-94 %. Pas un moat.
- **Résolution au logement** : maisons **~75-85 %** (1 adresse ≈ 1 logement, là où il y a des maisons) ; appartements **~60 % en forward** (étage+surface, quasi plat sur le territoire, plancher ~49 % cœur de Paris) et **~20 % en rétrospectif** (DVF n'a ni étage ni n° d'appart → régime mort).
- **Décote verte mesurable** (DVF×DPE) : gradient monotone A→G, **−7 %** (marché tendu, La Rochelle) à **−18 %** (détendu, Niort), 100+ ventes/classe.
- **Coût travaux par saut de classe** : dataset Audits ADEME (`ync2epx48x9azbdnggbygqp0`, **2,97 M lignes**), `état initial → étape finale`, `couts_cumules_travaux` (80 % rempli). Courbe saine : ~28 k€ pour atteindre D, ~57 k€ pour A.
- **Réglementaire encodable mais à maintenance lourde** : échéances G 2025 / F 2028 / E 2034 (métropole ; DOM décalé) ; **réforme DPE 2026-01-01** (coeff élec 2,3→1,9, ~850 k logements sortis de F/G sans travaux → DPE d'avant possiblement périmés) ; PJL « Relance logement » non voté (juin 2026) ; MaPrimeRénov' rouvert 2026-02-23, conditions durcies.
- **Lacune de couverture** : **DVF inexistant en Alsace-Moselle (67, 68, 57)** — à exclure.

## 3. Décisions produit

| Axe | Décision |
|---|---|
| Modèle | Indie solo, B2C/prosumer, self-serve, distribution SEO/contenu |
| Segment | Investisseurs locatifs / petits marchands de biens (récurrence native : 10-50 biens screenés par achat) |
| Wedge | ① Le verdict par deal (« le chasseur dans une boîte ») |
| Surfaces différées | ② Carto d'opportunité par zone (SEO d'abord) ; ③ Monitoring/watchlist (rétention) |

## 4. Le produit : job, input, fiche

**Job.** *« Une fois les travaux énergétiques pris en compte, ce bien est-il une bonne affaire ? »* — répondu en ~30 s, avant visite.

**Input (légal, apporté par l'utilisateur).** Adresse + prix demandé + surface + classe DPE (+ étage + nb pièces si appartement). Saisie de champs, ou collage du texte de l'annonce qu'on parse (parser un texte fourni par l'utilisateur ≠ scraping). Aucun flux d'annonces.

**Sortie — la fiche de décision :**
1. **Prix vs marché réel** — comparables DVF (€/m² médian par type/zone/tranche de surface) ; positionnement sur/sous-coté.
2. **Décote verte — vérité du marché** — décote réellement appliquée à cette classe dans la zone ; le prix demandé intègre-t-il déjà la passoire ?
3. **Coût de mise en conformité** — distribution empirique (audits ADEME comparables) classe actuelle → D (et → E).
4. **Échéance d'interdiction applicable** — selon la classe **recalculée post-réforme 2026** ; flag « règle en évolution » si PJL concerné.
5. **Aides mobilisables** — estimation MaPrimeRénov' selon profil de revenus saisi + ampleur travaux.
6. **Verdict** — *bonne affaire / correct / piège*, appuyé sur deux indicateurs **transparents** (chaque entrée affichée) : la **marge potentielle (plus-value, en €)** = `valeur post-travaux (comparables à la classe cible, D par défaut) − prix demandé − coût travaux net d'aides` ; et, en option, le **rendement locatif (%)** = `loyer de marché annuel ÷ coût total`, si l'utilisateur fournit le loyer visé.

## 5. Logique de calcul & honnêteté

**Pivot de conception :** la classe DPE est fournie par l'utilisateur (elle est sur l'annonce) → on n'a PAS besoin de résoudre le logement pour la connaître. Le matching DPE est un **enrichissement bonus**, pas une dépendance. Conséquences :

- **Comparables** : DVF seul, indépendant de la classe.
- **Décote** : **statistique de zone, pas un lookup par bien**. Robuste même à 20 % de match appartement (20 % de milliers de ventes = échantillon suffisant pour une moyenne de marché). Jamais besoin d'être exact au logement.
- **Coût travaux** : lookup de distribution sur audits comparables (classe-cible × type × tranche surface × région).
- **Échéance** : si le forward résout le DPE réel (maison ~79 %, appart ~60 %), on récupère le détail énergétique → **recalcul classe post-2026** + validation de la classe annoncée. Sinon : classe saisie + flag « si chauffage électrique, classe possiblement améliorée en 2026 — recalcul gratuit ADEME ».
- **Aides / Verdict** : règles + profil ; rendement transparent.

**La couche d'honnêteté est le différenciateur.** Chaque chiffre porte sa **confiance + taille d'échantillon** (« décote sur 182 ventes F/G de la zone », « 14 audits comparables »). Jamais de fausse précision. Maison = fiche haute confiance ; appartement = confiance affichée, enrichie quand le forward matche.

## 6. Architecture

Cinq composants, séparés par responsabilité.

1. **App TanStack Start** (seul process exposé)
   - Pages-zones **SSR** (`/[ville]/decote-passoire-thermique`, `/[ville]/prix-m2-par-classe-dpe`, …) pour le SEO programmatique.
   - Outil verdict (formulaire → fiche).
   - **Server functions = l'API** (`getVerdict(input)`, `getZoneStats(zone)`). Pas de Fastify séparé au MVP (extractible plus tard).
2. **Postgres** (source de vérité requêtable)
   - `dvf_mutations` (géocodées BAN), `dpe_logements` (clé BAN + énergie), `ban_index`.
   - Agrégats précalculés : `zone_decote` (€/m² médian par zone×classe×type), `cout_travaux` (distribution par classe-cible×type×tranche-surface×région).
   - `users` / `usage` (freemium).
   - **Maille zone = IRIS d'abord** (repli commune) ; PostGIS plus tard si trop grossier. **Pas de pgvector** au MVP.
3. **Workers d'ingestion** (scripts TS planifiés, hors web)
   - `probe.py` industrialisé : sources publiques → normalisation → géocodage BAN bulk → chargement Postgres → **précalcul des agrégats**. Cadence : DVF ~2×/an, DPE continu, Audits périodique. Checks d'anomalie (couverture DPE/hab, trou Alsace-Moselle).
4. **Moteur de verdict** (module appelé par les server functions)
   - input → géocode l'adresse (1 appel BAN) → lit les agrégats → applique le ruleset → calcule rendement/verdict. **Lit du précalculé → rapide, pas d'appel externe lourd en live.**
5. **Ruleset réglementaire** (config versionnée et datée — le moat *et* la dette)
   - Échéances, coefficient 2026, barèmes aides, encodés avec **dates d'effet + `derniere_verification` + liens sources**.

**Flux.** Ingestion batch (sources → Postgres + agrégats) d'un côté ; requête temps réel (input → géocode → agrégats → ruleset → fiche) de l'autre. Croisement uniquement au niveau de Postgres.

## 7. Distribution, monétisation, géo

- **Distribution** : SEO programmatique = la donnée. Pages-zones générées depuis `zone_decote` (coût marginal ~nul, SSR), chacune avec CTA vers l'outil. + 2-3 guides piliers (réforme DPE 2026, calendrier d'interdiction).
- **Monétisation** : freemium **1 palier**. Gratuit : pages publiques + 3-5 verdicts/mois. Payant (~15-30 €/mois) : verdicts illimités, modélisation rendement, export PDF (watchlist/alertes plus tard).
- **Géo de lancement** : **La Rochelle** (déjà validée de bout en bout → zéro friction). Extension ville par ville. **Exclure l'Alsace-Moselle.**

## 8. Périmètre MVP & non-objectifs (YAGNI)

**Fait** : 1 ville · outil verdict · pages-zones SEO · freemium 1 palier.

**Ne fait PAS** : ❌ scraping/flux d'annonces · ❌ couverture nationale · ❌ watchlist/portefeuille/alertes · ❌ carto d'opportunité (hors pages SEO) · ❌ pgvector/recherche sémantique/chat LLM · ❌ garantie de DPE exact à l'appartement (confiance affichée) · ❌ Alsace-Moselle · ❌ dépôt d'aides automatisé.

## 9. Risques & parades

1. **Qualité de l'input** → validation de plages + recoupement avec le DPE matché quand le forward résout.
2. **Ambiguïté forward (~40 % appart)** → neutralisée par design (classe saisie ; matching = bonus) ; confiance communiquée.
3. **Dérive réglementaire** → ruleset daté + cadence de re-vérification ; flag visible des DPE périmés (recalcul 2026). C'est la dette **et** le moat.
4. **Comparables minces en micro-zone** → élargir le rayon / repli commune ; afficher la taille d'échantillon ; refuser la fausse précision.
5. **Transférabilité du coût audit** → présenté comme distribution + fourchette ; « estimation, pas un devis ».
6. **Responsabilité** → aide à la décision, **pas** diagnostic / estimation notariale / conseil juridique → disclaimers clairs.
7. **Latence DVF** (~6 mois, 2×/an) → acceptable (on ne fait pas de prix live ; décote = statistique de marché).

## 10. Tests

- Moteur de verdict **déterministe** → tests unitaires sur fixtures (input connu → fiche attendue).
- **Golden tests** sur le ruleset réglementaire (classe → échéance, scénarios de dates d'effet dont réforme 2026).
- Validation pipeline : checks d'anomalie à l'ingestion (couverture DPE implausible, trou Alsace-Moselle).
- Agrégats décote/coût recoupés avec benchmarks externes (valeur verte Notaires, ADEME).

## 11. Séquence de construction (décomposition pour les plans d'implémentation)

Le MVP se décompose en sous-projets ; chacun aura son propre plan. Ordre proposé (du plus risqué/fondateur au plus périphérique) :

1. **Socle données + moteur de verdict** (cœur) : ingestion La Rochelle (DVF+DPE+BAN+Audits) → Postgres + agrégats (`zone_decote`, `cout_travaux`) ; ruleset réglementaire daté ; moteur de verdict + une server function `getVerdict`. Testable sans UE finale. **C'est le premier plan d'implémentation.**
2. **App web** : outil verdict (UI) + pages-zones SSR (SEO).
3. **Comptes + freemium** : auth, quota de verdicts, palier payant (facturation).

## 12. Sources réglementaires (à re-vérifier périodiquement)

- service-public — calendrier interdiction passoires (A17975).
- economie.gouv.fr / ecologie.gouv.fr — réforme DPE 2026 (coeff 2,3→1,9, arrêté 13 août 2025).
- PAP / presse — PJL « Relance logement » (présenté 2026-04-23, non voté).
- Anah — guide des aides 2026 (MaPrimeRénov').
