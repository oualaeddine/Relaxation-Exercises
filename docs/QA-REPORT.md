# Rapport QA — Calme

Rapport factuel des vérifications exécutées dans l'environnement de développement (conteneur Linux,
Node 22.22.0, npm 10.9.4). Toutes les valeurs proviennent de la dernière exécution de `npm run check`
(code de sortie 0).

## A. Environnement

| Élément | Valeur |
| --- | --- |
| Framework | React 19.3, React Router 7.18, TypeScript 5.8 (strict), Vite 7.3, Tailwind CSS 3.4 |
| Gestionnaire de paquets | npm (`package-lock.json`, installation reproductible avec `npm ci`) |
| Tests unitaires / composants | Vitest 4.1 + jsdom 26 + Testing Library (React 16, user-event 14, jest-dom 6) |
| Tests navigateur | Playwright 1.63.0 (`@playwright/test`), Chromium 153.0.8010.12 headless |
| Accessibilité | `@axe-core/playwright` 4.14 (règles WCAG 2.0/2.1 A et AA + bonnes pratiques) |
| Lint | ESLint 9, typescript-eslint 8, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y |
| Fuseau horaire des tests | `Europe/Paris` (Vitest et Playwright), y compris le passage à l'heure d'hiver du 25/10/2026 |

## B. Commandes exécutées

| Commande | Résultat |
| --- | --- |
| `npm run typecheck` (`tsc -b`) | ✅ réussi, 0 erreur |
| `npm run lint` (`eslint . --max-warnings=0`) | ✅ réussi, 0 erreur, 0 avertissement |
| `npm test` (`vitest run`) | ✅ 10 fichiers, **209 tests réussis**, 0 échec, 0 ignoré |
| `npm run build` (`tsc -b && vite build`) | ✅ réussi — JS 573 kB (164 kB gzip), CSS 47 kB (8 kB gzip) |
| `npm run test:e2e` (`playwright test`, sur le build de production servi par `vite preview`) | ✅ **97 tests réussis**, 0 échec, 0 ignoré, 0 instable |
| `npm run check` (enchaîne tout ce qui précède) | ✅ code de sortie 0 |

## C. Résultats

- Vitest : 209 réussis / 0 échoué / 0 ignoré.
  - Catalogue (10 exercices nommés explicitement), recherche, normalisation des réglages.
  - Protocoles : respiration lente (4/6 s, bornes de phase, cycle 10 s, pas de trou/doublon, fin exacte),
    carrée (ordre des 4 phases, pauses désactivées par défaut, une seule pause, durées personnalisées,
    changement de cadence au cycle suivant / en pause), lèvres pincées (2/4 s), fredonnement et soupir
    (compte, objectif, répétitions passées, fin anticipée), étapes guidées (alternée, relaxation
    musculaire, scan, marche, ancrage 5-4-3-2-1).
  - Machine à états : toutes les transitions demandées, appels répétés, reprise d'une séance terminée,
    absence de doublons.
  - Minuterie : 30 s actives + 10 s de pause + 20 s actives = **50 s** enregistrées ; rappels retardés
    sans dérive ; reprise après rechargement sans double comptage ; durées nulles ou très courtes.
  - Stockage (adaptateur `localStorage` réel de jsdom + magasin à écriture défaillante), statistiques
    (vide, une séance, même jour, semaine, minuit, heure d'été/hiver, suppression), CSV/JSON.
  - Composants : accueil, bibliothèque, détail, pratique, Mon suivi, Paramètres (voir `src/pages/__tests__`).
- Playwright : 97 réussis / 0 échoué.
  - Scénarios 1 à 8 : tous réussis (`e2e/core-flows.spec.ts`, `e2e/all-exercises.spec.ts`,
    `e2e/data-and-recovery.spec.ts`).
  - Scénario 4 : les **10 exercices** sont parcourus via l'interface (détails, démarrage, interaction
    centrale, pause/reprise, fin, vérification de l'historique).
  - Réactif (`e2e/responsive.spec.ts`) : 11 écrans × 4 tailles = 44 tests — 320×568, 390×844,
    768×1024, 1440×900 : pas de défilement horizontal, mode de navigation correct, commande principale
    visible et cliquable, cibles tactiles ≥ 32 px, aucun chevauchement de commandes, chiffres du minuteur
    ≥ 28 px, visuel de respiration carré. Captures dans `test-results/screens/`.
  - Accessibilité (`e2e/accessibility.spec.ts`) : axe sur 7 pages, 10 exercices × 5 états (prêt, en
    cours, en pause, dialogue de fin, bilan) et 2 dialogues : **0 violation** ; lien d'évitement, focus
    visible, pratique au clavier seul, piège de focus et Échap dans les dialogues, annonces limitées aux
    changements de phase, mouvement réduit.
  - Performances (`e2e/performance.spec.ts`) : une seule minuterie active pendant la pratique, aucune
    après navigation / fin / abandon ; ~6 écritures `localStorage` par minute (points de contrôle) au
    lieu d'une par tick ; aucune requête externe ; chargement local `networkidle` < 5 s.
  - Chaque test e2e échoue automatiquement en cas d'erreur console, d'exception non interceptée, de
    requête en échec (4xx/5xx) ou de requête vers un hôte externe.

## D. Défauts trouvés et corrigés

| Défaut | Effet pour l'utilisateur | Correction | Test de non-régression |
| --- | --- | --- | --- |
| Démarrer depuis la page Détail mettait aussitôt la séance en pause | « Démarrer la séance guidée » ouvrait une séance figée | La pause automatique ne se déclenche qu'en **quittant** réellement l'écran de pratique | `navigation.test.tsx` › « saves the configuration and starts the session », scénario 2 e2e |
| `createSession` levait une exception avec une inspiration de 0 s | Plantage avec des réglages corrompus | Normalisation défensive des réglages dans le moteur | `lifecycle.test.ts` › « zero and very short durations… » |
| Basculer le mode automatique/manuel en cours de répétition n'avait aucun effet | Bouton inopérant (fredonnement, alternée) | `replan` reprend l'unité courante dans le nouveau plan | `sequence.test.ts` › « switching pacing mode mid-repetition… » |
| Raccourci Espace : plantage si la cible de l'événement n'est pas un élément | Erreur JS possible au clavier | Garde `instanceof Element` | `practice.test.tsx` › « Space toggles pause / resume » |
| Validation native du navigateur masquait le message d'erreur français de l'objectif | Message absent / non accessible | `noValidate` + message `role="alert"` | `data.test.tsx` › « validates and saves the weekly goal » |
| `File.text()` absent de certains navigateurs | Import JSON impossible | Repli `FileReader` | `data.test.tsx` › import |
| Le `<select>` de filtre était imbriqué dans son libellé | Nom accessible « Exercice Tous les exercices » | Libellés `for`/`id` séparés | scénario 6 e2e (`getByLabel('Exercice', { exact: true })`) |
| Tableau `sr-only` du graphique (les tableaux ignorent `width: 1px`) | Défilement horizontal de 62 px à 320 px (accueil, suivi) | Conteneur `sr-only` autour du tableau | `responsive.spec.ts` (320 px) |
| Rangée de commandes trop large (relaxation musculaire, respiration carrée) à 320 px | Débordement de 22–26 px, bouton écrasé à 25 px | Grille / `min-w-0` / `shrink-0`, libellé autorisé à revenir à la ligne | `responsive.spec.ts` (320 px) |
| Interrupteurs de 28 px de haut | Cibles tactiles trop petites | Zone cliquable 44×56 px | `responsive.spec.ts` (cibles tactiles) |
| Barres du graphique 7 jours décalées par rapport aux jours sur grand écran | Lecture du graphique erronée | Graphique en colonnes flex alignées | inspection des captures 1440 px |
| Nom accessible du lien logo différent du texte visible (axe `label-content-name-mismatch`) | Commande vocale « cliquer sur Calme… » inopérante | Suppression de l'`aria-label`, sous-titre `aria-hidden` | `accessibility.spec.ts` (toutes les pages) |
| Contraste insuffisant des narines « fermées » (opacité 60 %) | Texte peu lisible | Couleurs atténuées sans opacité | `accessibility.spec.ts` › respiration alternée |
| Transition de la barre de progression active en mode réduit | Mouvement malgré la préférence | Suppression globale des transitions/animations en mode réduit | `accessibility.spec.ts` › « reduced motion » |
| Focus du bilan via `requestAnimationFrame` | Focus parfois non placé sur le titre du bilan | Focus direct dans l'effet post-rendu | `accessibility.spec.ts` › « guided exercise is fully operable by keyboard » |

## E. Limites restantes

**Implémenté et testé** : les 10 exercices, moteur de séance, pause/reprise, fin anticipée, abandon,
reprise après rechargement, historique persistant, statistiques, filtres, export CSV/JSON, import JSON,
suppression, préférences, objectif hebdomadaire, confidentialité, mise en page 320–1440 px, accessibilité
automatisée.

**Implémenté mais pas entièrement vérifiable ici**
- Son (carillon Web Audio), vibrations et synthèse vocale : déclenchements implémentés, mais aucun son ni
  vibration n'est perceptible dans Chromium headless ; non testés autrement qu'en absence d'erreur.
- Vérification visuelle par rapport aux `screen.png` Stitch : comparaison humaine des captures, pas de
  diff pixel automatisé (les maquettes contiennent des données fictives et des simulateurs d'états).
- Lecteurs d'écran réels (NVDA, VoiceOver) non testés ; seuls axe-core et des vérifications ARIA/clavier.
- Un seul moteur de navigateur (Chromium) ; Firefox/WebKit non installés dans l'environnement.
- Aucune mesure Lighthouse (outil absent) ; seul le chargement local a été mesuré.

**Non implémenté**
- « Nappe sonore apaisante » (bruit blanc) du prototype bureau.
- Découpage du bundle par route : 164 kB gzip en un seul fichier (avertissement Vite > 500 kB non minifié).
- 3 alertes `npm audit` de sévérité modérée, uniquement dans des dépendances de développement
  (`postcss-selector-parser` via Tailwind 3) ; aucune n'est livrée dans le build.

Ces pratiques visent la détente et ne remplacent pas un avis médical. L'application n'est pas un
dispositif médical.
