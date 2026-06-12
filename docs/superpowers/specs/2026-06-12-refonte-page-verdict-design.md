# Design — Refonte visuelle + durcissement de la page Verdict (sous-projet 3)

> Statut : design validé (brainstorming), prêt pour plan.
> Date : 2026-06-12.
> Déclencheur : critique `/impeccable critique` (méthode appliquée à la main) de la page Verdict — score 20/40 « Acceptable », 3 P1 + 2 P2. Direction visuelle choisie : **C — chaleureux rassurant**.
> Socle : sous-projet 2 livré (page TanStack Start, `src/routes/index.tsx`, `src/components/{Field,Fiche}.tsx`, server function DB-free `src/web/verdict.fn.ts`). Données inchangées (La Rochelle 17300).

## 1. Objectif

Faire passer la page d'un **prototype non stylé** à un **outil crédible** : un investisseur doit pouvoir lire « bonne affaire / piège » sur un bien à 430 k€ et *faire confiance* à l'interface. Périmètre strictement UI/UX : **aucune nouvelle fonctionnalité**, mêmes données, même commune. On corrige les 3 P1 (saisies libres, esthétique qui sape la confiance, erreurs non gérées) puis les 2 P2 (jargon profil, hiérarchie/layout), dans cet ordre.

## 2. Le piège à éviter (Direction C)

« Chaleureux » ne doit PAS devenir un fond crème/sable/beige — c'est le défaut saturé de l'IA 2026 (impeccable). La chaleur est portée par **l'accent terracotta + un H1 serif**, sur un fond **quasi-blanc** (chroma ≤ 0,005). Le body n'est jamais crème.

## 3. Système de design (`src/styles.css`, nouveau)

Un fichier CSS unique avec tokens, importé dans `src/routes/__root.tsx` (`import '../styles.css'`). Il **remplace les styles inline** des composants — c'est ce qui débloque `:hover`/`:focus`/`:active`/`:disabled`, impossibles en style inline React.

### 3.1 Tokens (`:root`)

| Token | Valeur | Usage | Contraste vérifié |
|---|---|---|---|
| `--bg` | `#fdfcfb` (oklch 0.99 0.004 50) | fond page (quasi-blanc tiède, **pas** crème) | — |
| `--surface` | `#ffffff` | inputs, bloc verdict | — |
| `--ink` | `#1c1a17` | texte principal | ~16:1 sur `--bg` ✓ |
| `--muted` | `#6b6358` | texte secondaire / confiance | ~5.2:1 sur `--bg` ✓ (≥4.5) |
| `--border` | `#e7e2db` | bordures inputs/blocs | — |
| `--accent` | `#c2410c` | action primaire, focus, sélection | blanc dessus ~4.6:1 ✓ |
| `--accent-weak` | `#fbeae1` | fond sélectionné (segment actif) | — |
| `--ok` | `#15803d` | verdict bonne-affaire | label ≥18px bold, ≥3:1 ✓ |
| `--warn` | `#b45309` | verdict correct | idem ✓ |
| `--bad` | `#b91c1c` | verdict piège | idem ✓ |
| `--radius` / `--radius-lg` | `8px` / `12px` | rayons doux | — |
| `--space-1..6` | `4 8 12 16 24 32 px` | échelle d'espacement | — |

**Sémantique ≠ accent** : le terracotta est la marque/action ; vert/ambre/rouge sont des états du verdict. On ne mélange pas.

### 3.2 Typographie

- **Un seul sans** pour UI, labels, données, boutons : `system-ui, -apple-system, Segoe UI, Roboto, sans-serif`.
- **Serif système réservé au H1 hero** uniquement : `Georgia, 'Times New Roman', serif` → paire serif+sans (axe de contraste), chaleur **sans webfont** (perf + deploy léger). Interdit ailleurs (ban product : pas de display dans labels/boutons/données).
- Échelle **rem fixe** (pas de `clamp` fluide — registre product), ratio ~1.2 : `--t-h1: 2rem`, `--t-h2: 1.25rem`, `--t-body: 1rem`, `--t-sm: 0.8125rem`.

### 3.3 Classes composants (états obligatoires)

- `.btn` (base) + `.btn-primary` (bg `--accent`, texte blanc, `:hover` assombri, `:focus-visible` anneau accent 2px, `:active` translateY(1px), `:disabled` opacité 0.5 + `cursor:not-allowed`) + `.btn-ghost` (bordure `--border`, texte `--ink`, hover fond `--accent-weak`).
- `.input` (bordure `--border`, `:focus-visible` anneau `--accent`, `:hover` bordure assombrie ; variante `.input--error` bordure `--bad`).
- `.seg` (groupe segmenté) + `.seg__opt` (label cliquable) ; radio natif visuellement masqué → l'état sélectionné stylise le label (`--accent` bordure + `--accent-weak` fond). **Accessibilité native** : navigation flèches gratuite, pas de JS clavier custom.
- `.fiche`, `.block`, `.verdict`, `.banner`.

Transitions 150–250 ms (registre product), `@media (prefers-reduced-motion: reduce)` neutralise. Aucune motion décorative.

## 4. Saisies contraintes (P1 — le verdict ne se nourrit plus de texte libre)

Logique pure extraite dans `src/web/form.ts` (testable sans DOM), consommée par des composants fins.

`src/web/form.ts` :
- `DPE_CLASSES = ['A','B','C','D','E','F','G'] as const`.
- `PROFIL_OPTIONS: { value: Profil; label: string }[]` = `[{value:'rose',label:'Supérieurs (rose)'}, {value:'violet',label:'Intermédiaires (violet)'}, {value:'jaune',label:'Modestes (jaune)'}, {value:'bleu',label:'Très modestes (bleu)'}]` — libellé **par le sens** (tranches MaPrimeRénov), couleur officielle en secondaire. Défaut `rose` (marge conservatrice, cohérent sous-projet 2).
- `TYPES = ['Maison','Appartement'] as const`.
- `type FormState = { adresse:string; prix:string; surface:string; classeDpe:string; typeLocal:string; etage:string; profil:string }`.
- `parseNum(s): number | null` (nettoie espaces/virgule, renvoie `null` si non fini ou ≤ 0).
- `validateForm(f): { ok:boolean; fields:{ adresse:boolean; prix:boolean; surface:boolean; classeDpe:boolean } }` — adresse trim non-vide ; prix/surface = `parseNum` non-null ; classeDpe ∈ `DPE_CLASSES`. (typeLocal/profil toujours valides via contrôles contraints.)

Composants :
- **Classe DPE** → `src/components/Segmented.tsx` (générique) : `A B C D E F G`, sélection unique, radios natifs masqués + labels stylés.
- **Type** → `Segmented` à 2 options `Maison / Appartement`. **Étage** n'apparaît que si `Appartement` (divulgation progressive).
- **Profil revenus** → `<select>` natif peuplé depuis `PROFIL_OPTIONS`.
- **Prix / Surface** → `<input inputMode="numeric">` ; `--input--error` si touché et invalide.

## 5. Gestion d'erreur (P1)

Dans `src/routes/index.tsx` :
- `verdict()` enveloppé en `try/catch`. Sur exception (réseau, BAN 5xx, server fn) → état d'erreur récupérable affiché (« Le service est momentanément indisponible, réessaie. ») + **reset du loading** dans un `finally`.
- Nouveau state `err: string | null`. Le résultat et l'erreur sont mutuellement exclusifs (on efface l'un en posant l'autre).
- Bouton **« Obtenir le verdict » désactivé** tant que `validateForm(f).ok` est faux → plus de `NaN €/m²`.
- `<form onSubmit={...}>` (Entrée soumet) ; `e.preventDefault()`.
- Région résultat `aria-live="polite"` → le lecteur d'écran annonce l'apparition du verdict/erreur (persona Sam).

## 6. Hiérarchie & layout (P2)

`src/routes/index.tsx` — fin de la grille 2-col qui orpheline le 7e champ. Structure :
1. H1 serif + sous-titre.
2. Zone de collage pleine largeur + bouton **Analyser** (`.btn-ghost`).
3. Champs : **Adresse** pleine largeur ; rangée **Prix · Surface** ; **Classe DPE** segmenté pleine largeur ; rangée **Type · (Étage si appart.)** ; **Profil** select.
4. **Obtenir le verdict** (`.btn-primary`, désactivé si invalide).
5. Résultat (`aria-live`).

`src/components/Fiche.tsx` — restylée via classes : les **chiffres décisifs** (prix €/m², marge) en `--ink` plus gros/gras ; libellés de bloc et confiance en `--muted` *lisible* ; séparateurs `--border`. Bloc verdict = le pic : `--surface`, rayon `--radius-lg`, couleur sémantique selon verdict, grande marge. Bandeau DPE conservé, restylé `.banner`.

## 7. Tests

- **`src/web/form.ts`** (pur) → `tests/web/form.test.ts` : `validateForm` accepte un cas valide ; rejette adresse vide, prix `''`/`0`/`'abc'`, surface invalide, classe hors A–G ; `parseNum('430 000')`/`'430000'`/`'12,5'` → nombres, `''`/`'-1'`/`'0'` → null ; `PROFIL_OPTIONS` = 4 entrées, défaut `rose` en tête, valeurs ∈ `Profil`.
- **Non-régression** : toute la suite existante (parseur, géocodage, moteur, fiche-format, result, aggregates) reste verte.
- **Vérification visuelle finale** (pas un test unitaire) : `pnpm dev` + capture navigateur de l'état vide et d'une fiche La Rochelle, contrôle des contrastes et des états (hover/focus visibles). Pas de DOM test harness ajouté (cohérent avec la philosophie « logique pure testée » du repo).

## 8. Périmètre / non-objectifs (YAGNI)

**Fait** : système de design tokenisé (CSS), saisies contraintes, gestion d'erreur + a11y, hiérarchie/layout, libellés profil clairs.
**Différé** : ❌ webfont / lib UI · ❌ thème sombre · ❌ nouvelles features produit · ❌ multi-commune · ❌ animations au-delà des transitions d'état · ❌ DOM/component test harness (logique pure suffit).

## 9. Séquence d'implémentation (pour le plan, ordre P1→P2)

1. **Système de design** : `src/styles.css` (tokens + classes) + import dans `__root`, body via tokens.
2. **Logique de formulaire pure** : `src/web/form.ts` + tests.
3. **Saisies contraintes** : `Segmented.tsx`, refonte `Field.tsx`, câblage dans `index.tsx` (DPE/Type/Étage/Profil) sur la logique pure.
4. **Gestion d'erreur + a11y** : try/catch, submit gardé, `<form>`, `aria-live`.
5. **Fiche restylée + hiérarchie** : `Fiche.tsx` via classes, emphase des chiffres décisifs.
6. **Vérification visuelle** : build vert + capture navigateur.
