# Design — Page « Verdict » (sous-projet 2, UX + web)

> Statut : design validé (brainstorming), prêt pour plan d'implémentation.
> Date : 2026-06-11.
> Socle : sous-projet 1 livré (`src/verdict/engine.ts` exporte `getVerdict` + `Deps` ; Postgres `resimmo_dev` peuplé La Rochelle). Voir `docs/superpowers/specs/2026-06-11-verdict-investisseur-design.md` et la mémoire `dvf-dpe-value-layer-feasibility`.

## 1. Objectif

Rendre le moteur `getVerdict` **touchable par un investisseur** : une page où il apporte un bien et reçoit la fiche de décision. But premier = pouvoir mettre le produit devant 3-5 investisseurs réels pour valider que la fiche est convaincante. Périmètre : **La Rochelle (INSEE 17300) uniquement**.

## 2. Décisions de design (validées en maquettes)

| Axe | Décision |
|---|---|
| Méthode de saisie | **Hybride** : coller l'annonce → préremplit des champs **éditables** → l'utilisateur valide. Saisie manuelle toujours possible. |
| Philosophie de la fiche | **Dossier d'abord** : preuves d'abord (prix, décote, coût, échéance), **verdict en conclusion**. |
| Invariant 1 | **Confiance affichée en gris** à côté de chaque chiffre (« 61 ventes », « 40 audits »). Jamais cachée. |
| Invariant 2 | **Bandeau réforme DPE 2026** quand la classe saisie est E/F/G. |

## 3. Structure de page & flux d'entrée

Une seule route (la page-outil au lancement, à la racine `/`). Flux :

1. **Zone de collage** « Colle ton annonce ici » (textarea).
2. Au collage / au clic *Analyser* → le **parseur d'annonce** (§5) extrait ce qu'il peut : `prix`, `surface`, `classe DPE`, `adresse` (+ `étage`, `pièces` si présents).
3. **Champs éditables préremplis** : adresse, prix demandé, surface, classe DPE, (étage, pièces optionnels). Les champs non extraits restent vides à remplir. Tout est modifiable.
4. **Select profil de revenus** (bleu / jaune / violet / rose) pour l'estimation des aides. Défaut : **rose** (taux d'aide le plus bas → marge conservatrice, on sous-promet).
5. Bouton **Obtenir le verdict** → appelle la server function (§6) → affiche la fiche (§4).

## 4. La fiche de résultat (dossier d'abord)

Ordre de rendu, preuve → conclusion, un bloc par élément, **confiance en gris dans chaque bloc** :

1. **Prix vs marché réel** — `prixM2Demande` vs `comparable.prixM2Median`, étiquette `sous-coté / dans-le-marché / sur-coté`. Gris : `comparable.confiance.n` ventes.
2. **Décote verte (zone)** — `decote.prixM2ClasseActuelle` vs `decote.prixM2ClasseCible` (delta %). Gris : `decote.confiance.n`.
3. **Coût mise en conformité → D** — `cout.median` + fourchette `cout.p25`–`cout.p75`. Gris : `cout.confiance.n` audits. Libellé « estimation, pas un devis ».
4. **Échéance & aides** — `echeance.dateInterdiction` + statut `enVigueur` (formulé clairement : « interdit à la location depuis 2025 » / « interdit à partir de 2028 ») ; `aides.montant` estimé.
5. **Conclusion : verdict** — `verdict` (bonne-affaire / correct / piège / indéterminé) + `margePotentielle` (€), avec la formule explicite en sous-texte (« valeur après travaux − prix − coût net d'aides »).

Couleurs verdict : bonne-affaire = vert, correct = ambre, piège = rouge, indéterminé = neutre.

**Bandeau réforme DPE 2026** (si classe ∈ {E,F,G}) : « Ton DPE date peut-être d'avant 2026 — avec le nouveau coefficient électricité, ta classe a pu s'améliorer sans travaux. [Recalcul gratuit ADEME]. »

**États limites (honnêtes)** :
- Adresse hors La Rochelle (citycode ≠ 17300) → « Cette commune n'est pas encore couverte (lancement : La Rochelle). » Pas de fiche.
- Pas de comparable pour la classe (`verdict = indéterminé`, `margePotentielle = null`) → afficher les blocs disponibles + « Pas assez de ventes de cette classe dans la zone pour conclure sur la marge. »
- Confiance faible (`niveau = 'faible'`) → le gris l'indique (« 8 ventes — à prendre avec prudence »).
- Adresse non géocodable → « Adresse non reconnue, vérifie-la. »

## 5. Le parseur d'annonce (`src/parse/annonce.ts`)

Pur, testable. `parseAnnonce(texte: string): Partial<{ adresse, prix, surface, classeDpe, typeLocal, etage, pieces }>`. Heuristiques :
- **typeLocal** : `/\bmaison\b/i` → 'Maison' ; `/\bappartement\b|\bappart\b|\bT\d\b/i` → 'Appartement' ; sinon `undefined` (l'UI a un toggle, défaut Maison).
- **prix** : `/\b(\d[\d  .]{4,})\s*€/` → nombre nettoyé (espaces/points retirés).
- **surface** : `/(\d{1,4})\s*m²|\bm2\b/` → premier match plausible (10–1000).
- **classe DPE** : `/\bDPE\s*:?\s*([A-G])\b/i` ou `/\b([A-G])\s*\/\s*[A-G]\b/` (DPE/GES).
- **étage** : `/(\d{1,2})(?:e|ème|er)?\s*étage/i` ou « rez-de-chaussée » → 0.
- **pièces** : `/T(\d)\b/i` ou `/(\d)\s*pièces?/i`.
- **adresse** : ligne contenant un numéro + un mot-clé voie (`rue|avenue|av|bd|boulevard|impasse|quai|place|allée`), sinon laissée vide.
Chaque champ non trouvé reste `undefined` → champ vide côté UI. **Jamais d'invention** : si ambigu, on laisse vide pour saisie manuelle (cohérent avec la couche d'honnêteté).

## 6. Câblage (server function + données)

`getVerdictFn(input: { adresse, prix, surface, classeDpe, typeLocal, profilAides, etage?, pieces? })` (server function TanStack Start) :
1. **Géocode l'adresse** (`geocodeOne(adresse)` — nouveau helper, BAN `/search/?q=&limit=1`, JSON) → `{ citycode, dept, banId }`.
2. Si `citycode !== '17300'` → renvoie `{ couverte: false }`.
3. Charge depuis Postgres `zone_decote` (where insee=citycode) et `cout_travaux` (where dept) → construit le `Deps`.
4. Appelle `getVerdict({ insee: citycode, typeLocal, surface, prixDemande: prix, classeDpe, profilAides, ... }, deps)`.
   - `typeLocal` : déduit de l'annonce si possible (« maison »/« appartement »), sinon défaut « Maison » (réglable côté UI — petit toggle).
5. Renvoie `{ couverte: true, fiche }`.

**Stack** : TanStack Start (React, Vite, SSR, server functions) ajouté au projet (pas encore présent). Le moteur, le ruleset et les agrégats sont réutilisés tels quels. À vérifier au moment du plan via la doc TanStack Start à jour (server functions, routing).

## 7. Tests

- **Parseur** (`parseAnnonce`) : pur → tests unitaires sur ~6 annonces collées réelles (variées : avec/sans étage, T3, « rez-de-chaussée », prix avec espaces). Vérifie aussi qu'un texte vague laisse les champs `undefined` (pas d'invention).
- **geocodeOne** : test sur le parsing de la réponse BAN (citycode/dept extraits), mock réseau.
- **getVerdictFn** : intégration — adresse La Rochelle → `couverte:true` + fiche cohérente ; adresse hors zone → `couverte:false`.
- **Rendu fiche** : tests composant légers sur les états (verdict bonne-affaire vs indéterminé ; bandeau DPE présent si E/F/G ; confiance affichée).

## 8. Périmètre / non-objectifs (YAGNI)

**Fait** : 1 route, saisie hybride + parseur, fiche dossier-d'abord, server function sur La Rochelle.
**Différé** : ❌ pages SEO zones · ❌ comptes / freemium / facturation · ❌ multi-commune · ❌ rendement locatif (loyer) · ❌ recoupement classe saisie ↔ DPE matché (on fait confiance à la classe saisie) · ❌ historique / watchlist.

## 9. Séquence d'implémentation (pour le plan)

1. **Parseur d'annonce + geocodeOne** (purs/testables, sans web) — premier, dérisque la logique.
2. **Scaffolding TanStack Start** + la server function `getVerdictFn` wirée sur Postgres + moteur.
3. **UI** : page (collage → champs → submit) + rendu de la fiche (dossier-d'abord, invariants, états limites).
