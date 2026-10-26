# Calme — exercices guidés de respiration et de relaxation

Application web (React + TypeScript + Vite) en français, implémentée à partir de l'export Stitch
« Calme » (`stitch_calme_guided_breathing_app (1).zip`). Dix exercices, un moteur de séance commun,
un suivi persistant et des contrôles de confidentialité. Aucune donnée ne quitte l'appareil.

## Démarrer

```bash
npm ci
npm run dev        # serveur de développement
npm run build      # build de production (dist/)
npm run preview    # sert le build de production sur http://localhost:4173
```

## Vérifications

| Commande | Rôle |
| --- | --- |
| `npm run typecheck` | TypeScript strict (application, configuration, tests e2e) |
| `npm run lint` | ESLint (typescript-eslint, react-hooks, jsx-a11y), 0 avertissement toléré |
| `npm test` | Vitest : tests unitaires, d'intégration et de composants (jsdom, fuseau `Europe/Paris`) |
| `npm run test:e2e` | Playwright : construit l'app, la sert avec `vite preview` et la teste dans Chromium |
| `npm run check` | Enchaîne tout ce qui précède |

Les tests e2e utilisent un contexte de navigateur neuf par test (stockage isolé) et une horloge
virtuelle (`page.clock`), ce qui évite d'attendre de vraies minutes. Ils échouent automatiquement
sur toute erreur console, exception non interceptée, requête en échec ou requête vers un hôte externe.
Les captures d'écran réactives sont écrites dans `test-results/screens/`.

Playwright est épinglé sur la version du navigateur Chromium préinstallé (`@playwright/test@1.63.0`).
Sur une autre machine : `npx playwright install chromium`.

## Architecture

```
src/
  domain/      catalogue des 10 exercices, normalisation des réglages, statistiques, export CSV/JSON, routine
  engine/      moteur de séance pur (aucune lecture d'horloge) + construction des protocoles
  storage/     adaptateur localStorage : historique versionné, préférences, séance active
  app/         contextes React (données, séance), retours sensoriels, hooks
  practice/    vues propres à chaque exercice, formulaire de réglages, écrans « prêt » et « bilan »
  pages/       Accueil, Exercices, Détail, Pratique, Mon suivi, Paramètres, 404
  ui/          primitives accessibles (Dialog, Switch, ChoiceGroup, Stepper, icônes SVG)
e2e/           scénarios Playwright (parcours, 10 exercices, données, réactif, accessibilité, performances)
```

### Protocoles

| Exercice | Identifiant | Protocole | Défaut |
| --- | --- | --- | --- |
| Respiration lente | `respiration-lente` | `paced` | 4 s / 6 s, 5 min |
| Respiration carrée | `respiration-carree` | `paced` | 4-4 (pauses désactivées), 4 min |
| Expiration à lèvres pincées | `expiration-levres-pincees` | `paced` | 2 s / 4 s, 2 min |
| Expiration avec fredonnement | `expiration-fredonnement` | `repetitions` | 5 × (3 s + 8 s) |
| Respiration alternée | `respiration-alternee` | `steps` | 3 min ≈ 9 cycles de 4 étapes |
| Soupir physiologique doux | `soupir-physiologique` | `repetitions` | 3 × (3 s + 1,5 s + 6 s) |
| Relaxation musculaire progressive | `relaxation-musculaire` | `steps` | 7 zones × 3 (5 s + 10 s) + 20 s |
| Scan corporel bienveillant | `scan-corporel` | `steps` | 8 zones, 5 min |
| Marche attentive | `marche-attentive` | `prompts` | 10 min, invites toutes les 90 s, souffle libre |
| Ancrage sensoriel 5-4-3-2-1 | `ancrage-sensoriel` | `steps` | 5 étapes sans minuterie |

### Règles de temps

- Le moteur reçoit l'instant `now` à chaque action ; le temps actif vaut
  `accumulé + (now − reprise)` pendant la pratique et reste figé en pause. Les pauses sont
  comptées à part et ne s'ajoutent jamais au temps de pratique.
- Phases, étapes, cycles et fin de séance sont **dérivés** du temps actif : un rappel de minuterie
  retardé (onglet en arrière-plan) ne crée aucune dérive, la séance se rattrape au tick suivant et
  se termine exactement à la durée cible.
- Précision interne : la milliseconde. L'historique enregistre des secondes entières (arrondi
  inférieur). L'affichage du temps écoulé arrondit à l'inférieur, le temps restant au supérieur.
- Changement de cadence en cours de séance : au prochain début de cycle (ou immédiatement,
  avec une nouvelle inspiration, si la séance est en pause).

### Statuts et enregistrement

- `terminée` : objectif atteint (durée, répétitions, étapes). Les étapes « passées » sont comptées
  à part.
- `terminée plus tôt` : l'utilisateur termine avant l'objectif ; enregistrée si au moins 5 s de
  pratique active.
- `abandonnée` : jamais enregistrée (« Abandonner sans enregistrer », « Recommencer », ou
  démarrage d'un autre exercice après confirmation).
- L'enregistrement est idempotent (identifiant unique de séance) : clics répétés, fin simultanée
  au minuteur ou rechargements ne créent jamais de doublon.

### Reprise après rechargement

- La séance en cours est sauvegardée à chaque transition et par point de contrôle toutes les
  10 s pendant la pratique (ainsi qu'au masquage/fermeture de la page) — jamais à chaque tick.
- Une séance **en cours** au moment du rechargement est restaurée **en pause** ; seul le temps
  pratiqué jusqu'au dernier point de contrôle est crédité, le reste compte comme pause.
- Une séance restaurée n'est jamais terminée automatiquement (sauf si l'objectif était déjà atteint
  au dernier point de contrôle). Les instantanés invalides ou de plus de 24 h sont ignorés.
- Quitter l'écran de pratique met la séance en pause ; un bandeau permet de la reprendre.

### Statistiques

- Calculées uniquement depuis l'historique stocké ; aucune valeur fictive.
- Temps de pratique = temps actif des séances terminées et terminées plus tôt.
  « Séances terminées » ne compte que les séances terminées.
- Une séance appartient au jour local où elle a commencé (une séance à cheval sur minuit compte
  pour le jour de début). Les semaines commencent le lundi.

### Stockage, migrations, export

- Clés : `calme.history` (`{ schemaVersion: 1, sessions }`), `calme.preferences`, `calme.activeSession`.
- Ancien format (tableau nu) : migré en v1. JSON illisible ou version plus récente : copie de
  sauvegarde (`calme.history.backup.<horodatage>`) puis nouvel historique ; si la copie est
  impossible, l'écriture est suspendue pour ne rien écraser.
- Enregistrement individuel invalide : mis de côté (non affiché, non compté, jamais supprimé sans
  action de l'utilisateur).
- Échec d'écriture (quota) : message explicite, l'état affiché reste cohérent, « Réessayer ».
- Export CSV (UTF-8 avec BOM, RFC 4180, protection contre l'injection de formules) et JSON.
- Import JSON : fusion seulement (jamais de remplacement), doublons ignorés, aperçu et confirmation,
  versions non prises en charge refusées avec un message.
- Les observations de l'ancrage 5-4-3-2-1 restent en mémoire du composant : jamais stockées ni exportées.

## Écarts assumés par rapport aux prototypes Stitch

- Les barres « Mode aperçu » / « Simulateur d'états » des prototypes sont remplacées par les vrais
  états du moteur (prêt, en cours, en pause, bilan, réglages).
- La carte « Respiration abdominale » de l'accueil (hors catalogue) est remplacée par le soupir
  physiologique ; les statistiques d'accueil sont réelles (vides au premier lancement).
- Le logo (image non accessible publiquement) est remplacé par un logo SVG ; la photo de profil
  fictive par un bouton « Paramètres ».
- Les icônes Material Symbols sont rendues en SVG embarqué (aucune police d'icônes téléchargée) ;
  la police Manrope est servie localement.
- Certaines affirmations médicales des prototypes (« stimule le nerf vague », « harmonise les deux
  hémisphères ») ont été adoucies.
- La « nappe sonore » (bruit blanc) du prototype bureau n'est pas implémentée ; le guide sonore
  (carillon synthétisé), les vibrations et la voix (synthèse vocale) le sont.
- Respiration alternée : les durées proposées (2/3/5 min) donnent 6/9/15 cycles de 20 s
  (4 s inspiration, 6 s expiration), au lieu des valeurs incohérentes du prototype.

Ces pratiques visent la détente et ne remplacent pas un avis médical.
