import type { IconName } from '../ui/icons.generated';
import type { CategoryId, ExerciseConfig, ExerciseId, ProtocolKind } from './types';

export interface Category {
  id: CategoryId;
  label: string;
  icon: IconName;
  /** Tailwind classes for the category chip (from the Stitch library cards). */
  chipClass: string;
}

export const CATEGORIES: readonly Category[] = [
  { id: 'respiration', label: 'Respiration', icon: 'air', chipClass: 'bg-secondary-container text-on-secondary-container' },
  {
    id: 'relaxation',
    label: 'Relaxation corporelle',
    icon: 'accessibility_new',
    chipClass: 'bg-tertiary-fixed text-on-tertiary-fixed',
  },
  { id: 'ancrage', label: 'Attention & Ancrage', icon: 'adjust', chipClass: 'bg-surface-variant text-primary' },
  {
    id: 'mouvement',
    label: 'Mouvement doux',
    icon: 'directions_walk',
    chipClass: 'bg-secondary-fixed text-on-secondary-fixed-variant',
  },
];

export function getCategory(id: CategoryId): Category {
  const category = CATEGORIES.find((c) => c.id === id);
  if (!category) throw new Error(`Catégorie inconnue : ${id}`);
  return category;
}

/** A named step / zone / prompt of a guided exercise. */
export interface UnitContent {
  key: string;
  title: string;
  instruction: string;
  hint?: string;
  icon?: IconName;
}

export interface NumberRange {
  min: number;
  max: number;
}

export interface ConfigOptions {
  /** Proposed session durations in seconds (chips). */
  durations?: readonly number[];
  /** Allows a custom duration (minutes input) within this range (seconds). */
  customDuration?: NumberRange;
  inhale?: readonly number[] | NumberRange;
  exhale?: readonly number[] | NumberRange;
  hold?: NumberRange;
  repetitions?: readonly number[] | NumberRange;
  autoPace?: boolean;
  secondInhale?: boolean;
  pmrPresets?: boolean;
  excludableUnits?: boolean;
}

export interface Exercise {
  id: ExerciseId;
  title: string;
  category: CategoryId;
  protocol: ProtocolKind;
  icon: IconName;
  /** Duration / volume badge shown on library cards. */
  durationLabel: string;
  durationIcon: IconName;
  summary: string;
  tags: readonly { icon: IconName; label: string }[];
  instructions: string;
  benefits: string;
  /** Small uppercase line above the title on practice screens. */
  eyebrow: string;
  safety: string;
  /** Short cue shown during practice. */
  cue: string;
  defaults: ExerciseConfig;
  options: ConfigOptions;
  units?: readonly UnitContent[];
}

export const BASE_CONFIG: ExerciseConfig = {
  durationSec: 300,
  inhaleSec: 4,
  exhaleSec: 6,
  holdInEnabled: false,
  holdInSec: 4,
  holdOutEnabled: false,
  holdOutSec: 4,
  repetitions: 3,
  autoPace: true,
  secondInhale: true,
  pmrPreset: 'standard',
  excludedUnits: [],
};

const SAFETY_GENERAL =
  "Pratiquez sans forcer. Ne bloquez pas votre respiration si cela vous gêne. Si vous ressentez des vertiges, un engourdissement, un essoufflement ou un malaise, arrêtez l'exercice et reprenez une respiration naturelle. Ces pratiques peuvent favoriser la détente, mais ne remplacent pas un avis médical.";

export const PMR_GROUPS: readonly UnitContent[] = [
  {
    key: 'mains',
    title: 'Mains et poignets',
    instruction: 'Serrez doucement les poings en sentant la paume, sans crisper les ongles.',
    hint: 'Serrer les poings doucement, puis relâcher doigts ouverts',
    icon: 'front_hand',
  },
  {
    key: 'bras',
    title: 'Bras et avant-bras',
    instruction: 'Pliez les coudes et rapprochez les poings des épaules très doucement.',
    hint: 'Plier les coudes, ramener les mains vers les épaules',
    icon: 'fitness_center',
  },
  {
    key: 'epaules',
    title: 'Épaules et nuque',
    instruction:
      'Haussez délicatement les deux épaules vers les oreilles. Ressentez la tension sans bloquer votre respiration.',
    hint: "Hausser les épaules, relâcher avec l'expiration",
    icon: 'accessibility_new',
  },
  {
    key: 'visage',
    title: 'Visage et mâchoire',
    instruction: 'Plissez doucement le front, puis desserrez les dents et relâchez la mâchoire.',
    hint: 'Plisser le front et relâcher la bouche entrouverte',
    icon: 'mood',
  },
  {
    key: 'abdomen',
    title: 'Abdomen et cage thoracique',
    instruction: "Durcissez légèrement les abdominaux tout en laissant l'air circuler.",
    hint: 'Légère fermeté abdominale puis relâchement du ventre',
    icon: 'air',
  },
  {
    key: 'cuisses',
    title: 'Cuisses et fessiers',
    instruction: 'Appuyez doucement les cuisses et les talons contre le support en sentant le contact.',
    hint: 'Plaquer doucement les cuisses contre le support',
    icon: 'nordic_walking',
  },
  {
    key: 'pieds',
    title: 'Pieds et orteils',
    instruction: 'Relevez doucement les orteils vers les tibias, sans provoquer de crampe.',
    hint: 'Relever les orteils vers les tibias',
    icon: 'footprint',
  },
];

export const BODY_SCAN_ZONES: readonly UnitContent[] = [
  {
    key: 'pieds',
    title: 'Pieds & ancrage',
    instruction:
      'Prenez conscience du contact des pieds avec le sol ou le matelas. Ressentez les talons, la voûte plantaire et le bout des orteils.',
    hint: 'Sans tension : ressentez simplement la gravité et les points de contact.',
  },
  {
    key: 'jambes',
    title: 'Bas des jambes',
    instruction: 'Déplacez doucement votre attention vers les chevilles, les tibias et la rondeur des mollets.',
    hint: "Laissez ces muscles s'alourdir paisiblement.",
  },
  {
    key: 'bassin',
    title: 'Cuisses & bassin',
    instruction:
      "Explorez les sensations dans les cuisses, l'arrière des jambes et le bassin reposant solidement.",
    hint: "Remarquez le relâchement qui s'installe naturellement dans les hanches.",
  },
  {
    key: 'abdomen',
    title: 'Abdomen',
    instruction:
      "Observez simplement les sensations présentes, sans chercher à les modifier. Remarquez la montée et la descente naturelles de l'abdomen.",
    hint: "Si aucune sensation vive n'apparaît, c'est tout à fait normal. La présence bienveillante suffit.",
  },
  {
    key: 'poitrine',
    title: 'Poitrine & dos',
    instruction:
      "Ressentez l'expansion délicate de la cage thoracique et l'appui réconfortant de votre colonne vertébrale.",
    hint: 'Le dos soutient le corps en toute quiétude.',
  },
  {
    key: 'epaules',
    title: 'Épaules & bras',
    instruction:
      "Portez votre attention sur les épaules, les bras, les avant-bras jusqu'au creux de la paume des mains.",
    hint: 'Déposez tout le poids inutile accumulé dans les épaules.',
  },
  {
    key: 'visage',
    title: 'Cou & visage',
    instruction: 'Relâchez la mâchoire, la nuque, le contour des yeux et lissez mentalement le front.',
    hint: "Laissez une expression douce et détendue s'installer.",
  },
  {
    key: 'ensemble',
    title: 'Ensemble du corps',
    instruction:
      "Élargissez votre conscience à l'ensemble du corps, de la tête jusqu'aux pieds, unifié dans le souffle.",
    hint: 'Ressentez cette présence globale, harmonieuse et sereine.',
  },
];

export const WALKING_PROMPTS: readonly UnitContent[] = [
  { key: 'pieds', title: 'Remarquez le contact de vos pieds avec le sol.', instruction: '', icon: 'footprint' },
  { key: 'pas', title: 'Sentez le rythme naturel de vos pas.', instruction: '', icon: 'directions_walk' },
  { key: 'sons', title: 'Observez les sons et la brise autour de vous.', instruction: '', icon: 'air' },
  {
    key: 'regard',
    title: 'Portez un regard bienveillant sur votre environnement.',
    instruction: '',
    icon: 'nature_people',
  },
  {
    key: 'epaules',
    title: 'Relâchez vos épaules et laissez vos bras se balancer naturellement.',
    instruction: '',
    icon: 'self_improvement',
  },
];

/** Exact 5-4-3-2-1 progression. */
export const GROUNDING_STEPS: readonly (UnitContent & { count: number; sense: string; suggestions: string[] })[] = [
  {
    key: 'vue',
    count: 5,
    sense: 'La Vue & Découverte visuelle',
    icon: 'visibility',
    title: '5 choses que vous voyez',
    instruction:
      'Portez un regard doux autour de vous. Remarquez 5 éléments visuels : une ombre, un reflet, un motif, une couleur…',
    suggestions: [
      "Un jeu d'ombre et de lumière",
      "La couleur chaude d'un mur",
      'Un détail géométrique discret',
      'Le reflet sur une vitre',
      "Le vert apaisant d'une plante",
    ],
  },
  {
    key: 'toucher',
    count: 4,
    sense: 'Le Toucher & Sensations',
    icon: 'touch_app',
    title: '4 choses que vous pouvez toucher ou ressentir physiquement',
    instruction:
      "Sentez le contact de vos pieds sur le sol, le tissu sur votre peau, la texture d'un objet sous vos doigts…",
    suggestions: [
      'Le tissu doux du vêtement',
      "Le contact ferme de l'assise",
      'La tiédeur de mes paumes',
      "L'air frais sur mes mains",
      "La texture lisse d'une table",
    ],
  },
  {
    key: 'ouie',
    count: 3,
    sense: "L'Ouïe & Paysage sonore",
    icon: 'hearing',
    title: '3 sons que vous entendez',
    instruction:
      "Tendez l'oreille aux bruits proches ou lointains : une respiration, le vent, une horloge, le silence ambiant…",
    suggestions: [
      "Le murmure d'une respiration",
      "Un bruissement lointain à l'extérieur",
      'Le souffle feutré de la ventilation',
      "Le silence qui s'installe",
    ],
  },
  {
    key: 'odorat',
    count: 2,
    sense: "L'Odorat & Présence de l'air",
    icon: 'air',
    title: '2 odeurs que vous remarquez',
    instruction:
      "Sentez l'air autour de vous : une tasse de thé, l'air frais, une odeur de savon, ou simplement la fraîcheur neutre de la pièce…",
    suggestions: [
      "L'odeur de thé ou d'infusion",
      "La fraîcheur neutre de l'air",
      'La senteur discrète de bois ou de tissu',
      'Le parfum subtil de savon doux',
    ],
  },
  {
    key: 'gout',
    count: 1,
    sense: 'Le Goût & Sens intérieur',
    icon: 'water_drop',
    title: '1 goût que vous pouvez percevoir',
    instruction:
      "Portez votre attention sur l'intérieur de votre bouche : une trace d'eau fraîche, un goût résiduel, ou la neutralité présente…",
    suggestions: [
      "La neutralité fraîche de l'instant",
      "Le souvenir d'une boisson chaude",
      'La salivation détendue',
      'Une fraîcheur mentholée',
    ],
  },
];

/** The four guided steps of one alternate-nostril cycle. */
export const ALTERNATE_STEPS: readonly (UnitContent & {
  nostril: 'gauche' | 'droite';
  action: 'inhale' | 'exhale';
  finger: string;
  next: string;
})[] = [
  {
    key: 'in-gauche',
    nostril: 'gauche',
    action: 'inhale',
    title: 'Inspirez doucement par la narine gauche.',
    instruction: 'La narine droite reste délicatement obturée par le pouce, sans appuyer fort.',
    finger: 'Pouce droit posé à droite',
    next: "Ensuite : fermer à gauche avec l'annulaire et expirer à droite.",
  },
  {
    key: 'out-droite',
    nostril: 'droite',
    action: 'exhale',
    title: 'Fermez la narine gauche et expirez à droite.',
    instruction: "Posez doucement l'annulaire sur la narine gauche et relâchez le pouce à droite.",
    finger: 'Annulaire posé à gauche',
    next: 'Ensuite : inspirer par cette même narine droite.',
  },
  {
    key: 'in-droite',
    nostril: 'droite',
    action: 'inhale',
    title: 'Inspirez doucement par la narine droite.',
    instruction: "Gardez la narine gauche fermée avec l'annulaire, sans tension dans l'épaule.",
    finger: 'Annulaire posé à gauche',
    next: 'Ensuite : fermer la narine droite avec le pouce et expirer à gauche.',
  },
  {
    key: 'out-gauche',
    nostril: 'gauche',
    action: 'exhale',
    title: 'Fermez la narine droite et expirez à gauche.',
    instruction: "Reposez doucement le pouce sur la narine droite et relâchez l'annulaire.",
    finger: 'Pouce droit posé à droite',
    next: 'Ensuite : nouveau cycle, inspirez à gauche.',
  },
];

export const EXERCISES: readonly Exercise[] = [
  {
    id: 'respiration-lente',
    title: 'Respiration lente',
    category: 'respiration',
    protocol: 'paced',
    icon: 'air',
    durationLabel: '5 min',
    durationIcon: 'schedule',
    summary:
      'Inhalation 4s douce, expiration 6s lente avec un pacer animé pour rééquilibrer le rythme cardiaque et dissiper les tensions.',
    tags: [
      { icon: 'waves', label: 'Pacer animé 4-6' },
      { icon: 'favorite', label: 'Cohérence' },
    ],
    instructions:
      "Asseyez-vous confortablement. Inspirez doucement par le nez pendant 4 secondes en laissant l'abdomen s'ouvrir naturellement, puis expirez pendant 6 secondes par la bouche ou le nez, sans effort musculaire.",
    benefits:
      'Une expiration plus longue que l’inspiration aide à ralentir le rythme et favorise une sensation de détente.',
    eyebrow: 'Rythme apaisant',
    cue: "Respirez avec fluidité par le nez, sans forcer l'amplitude pulmonaire.",
    safety:
      "Pratiquez sans forcer l'inspiration ni l'expiration. Si vous ressentez une gêne ou un vertige, arrêtez l'exercice et reprenez une respiration naturelle. Ne remplace pas un avis médical.",
    defaults: { ...BASE_CONFIG, durationSec: 300, inhaleSec: 4, exhaleSec: 6 },
    options: {
      durations: [180, 300, 600],
      customDuration: { min: 60, max: 3600 },
      inhale: [3, 4, 5],
      exhale: [5, 6, 7, 8],
    },
  },
  {
    id: 'respiration-carree',
    title: 'Respiration carrée',
    category: 'respiration',
    protocol: 'paced',
    icon: 'crop_square',
    durationLabel: '4 min',
    durationIcon: 'schedule',
    summary:
      '4 phases équilibrées : inspire 4s, pause 4s, expire 4s, pause 4s. Rétentions douces et facultatives, désactivées par défaut.',
    tags: [
      { icon: 'crop_square', label: 'Cycle 4-4-4-4' },
      { icon: 'psychology', label: 'Clarté mentale' },
    ],
    instructions:
      'Visualisez un carré. Inspirez 4s en montant le premier côté, marquez une pause poumons pleins, expirez 4s en descendant, puis observez une pause poumons vides. Les pauses sont facultatives : si elles sont inconfortables, laissez-les désactivées.',
    benefits: "Clarifie l'esprit, recentre l'attention et aide à canaliser le trac ou les pensées envahissantes.",
    eyebrow: 'Cohérence & Apaisement',
    cue: 'Gardez les épaules basses et la cage thoracique libre et décontractée.',
    safety:
      "Pratiquez sans forcer. Ne bloquez jamais votre respiration si cela vous gêne. En cas de vertige ou de sensation désagréable, reprenez aussitôt votre souffle naturel. Ces pratiques de confort ne remplacent pas un avis médical.",
    defaults: {
      ...BASE_CONFIG,
      durationSec: 240,
      inhaleSec: 4,
      exhaleSec: 4,
      holdInEnabled: false,
      holdInSec: 4,
      holdOutEnabled: false,
      holdOutSec: 4,
    },
    options: {
      durations: [180, 240, 480],
      inhale: { min: 2, max: 8 },
      exhale: { min: 2, max: 8 },
      hold: { min: 2, max: 8 },
    },
  },
  {
    id: 'expiration-levres-pincees',
    title: 'Expiration à lèvres pincées',
    category: 'respiration',
    protocol: 'paced',
    icon: 'filter_drama',
    durationLabel: '1-3 min',
    durationIcon: 'schedule',
    summary:
      "Inhalation par le nez 2s, expiration à travers les lèvres entrouvertes 4s, libérant la cage thoracique sans vider de force.",
    tags: [{ icon: 'flare', label: 'Soulagement express' }],
    instructions:
      "Inspirez tranquillement par le nez pendant 2 secondes. Pincez légèrement vos lèvres comme pour souffler sur une bougie sans l'éteindre, et expirez très lentement pendant 4 secondes.",
    benefits: "Ralentit le souffle et peut soulager la sensation d'essoufflement en douceur.",
    eyebrow: 'Régulation respiratoire • Apaisement',
    cue: "Ne cherchez pas à vider complètement vos poumons. L'expiration doit rester fluide, confortable et sans aucune crispation thoracique.",
    safety:
      "Si vous ressentez une sensation de tête qui tourne ou le moindre inconfort, relâchez vos lèvres et reprenez votre souffle naturel. Ce programme d'apaisement ne remplace pas un avis médical.",
    defaults: { ...BASE_CONFIG, durationSec: 120, inhaleSec: 2, exhaleSec: 4 },
    options: {
      durations: [60, 120, 180],
      inhale: [2, 3],
      exhale: [4, 6],
    },
  },
  {
    id: 'expiration-fredonnement',
    title: 'Expiration avec fredonnement',
    category: 'respiration',
    protocol: 'repetitions',
    icon: 'graphic_eq',
    durationLabel: '5-10 répétitions',
    durationIcon: 'repeat',
    summary:
      "Inhalation nasale, suivie d'une expiration continue avec un « mmmm » vibrant. Une vibration douce et apaisante, sans micro ni enregistrement.",
    tags: [
      { icon: 'graphic_eq', label: 'Vibration douce' },
      { icon: 'counter_5', label: 'Compteur intégré' },
    ],
    instructions:
      "Prenez une inspiration nasale naturelle. En expirant, gardez les lèvres closes et produisez un son continu « mmmm ». Ressentez la vibration apaisante dans le visage et la poitrine.",
    benefits: 'Allonge naturellement l’expiration et recentre l’attention sur une sensation agréable.',
    eyebrow: 'Vibration apaisante',
    cue: "Inspiration douce par le nez, vibration apaisante « mmmm » à l'expiration.",
    safety:
      "Pratiquez sans chercher à forcer la hauteur de note ou vider excessivement les poumons. La vibration doit rester naturelle et relaxante au niveau du visage et de la poitrine. Aucun enregistrement ni micro requis.",
    defaults: { ...BASE_CONFIG, repetitions: 5, autoPace: true, inhaleSec: 3, exhaleSec: 8 },
    options: { repetitions: { min: 5, max: 10 }, autoPace: true },
  },
  {
    id: 'respiration-alternee',
    title: 'Respiration alternée',
    category: 'respiration',
    protocol: 'steps',
    icon: 'sync_alt',
    durationLabel: '2-5 min',
    durationIcon: 'schedule',
    summary:
      'Alternance douce et fluide entre narine gauche et narine droite, sans apnée forcée. Guide visuel pour positionner les doigts.',
    tags: [
      { icon: 'pan_tool', label: 'Guide des doigts' },
      { icon: 'balance', label: 'Équilibre' },
    ],
    instructions:
      "Posez le pouce droit sur la narine droite, inspirez par la narine gauche. Bouchez la narine gauche avec l'annulaire et expirez par la narine droite. Inspirez ensuite par la narine droite, bouchez-la et expirez par la gauche. Gardez un souffle doux, sans rétention.",
    benefits: "Recentre l'attention grâce à un rythme fluide et régulier.",
    eyebrow: 'Pratique douce • Équilibre',
    cue: 'Harmonisez votre souffle et recentrez votre attention grâce à un rythme fluide, sans rétention de souffle forcée.',
    safety:
      "Gardez un souffle doux et continu sans forcer l'amplitude. Si une narine est temporairement obstruée ou en cas de gêne, respirez naturellement par les deux narines.",
    defaults: { ...BASE_CONFIG, durationSec: 180, inhaleSec: 4, exhaleSec: 6, autoPace: true },
    options: { durations: [120, 180, 300], autoPace: true },
    units: ALTERNATE_STEPS,
  },
  {
    id: 'soupir-physiologique',
    title: 'Soupir physiologique doux',
    category: 'respiration',
    protocol: 'repetitions',
    icon: 'cloud',
    durationLabel: '1-5 répétitions',
    durationIcon: 'bolt',
    summary:
      "Deux inspirations successives par le nez (une ample suivie d'une petite), suivies d'une longue expiration libératrice par la bouche.",
    tags: [{ icon: 'sentiment_satisfied', label: 'Décompression rapide' }],
    instructions:
      "Prenez une première inspiration normale par le nez, puis enchaînez avec une seconde petite inspiration d'appoint. Relâchez ensuite l'air dans un long soupir détendu.",
    benefits: 'Un geste bref et simple pour relâcher une montée de tension.',
    eyebrow: 'Pratique guidée par répétitions',
    cue: 'Le soupir physiologique est conçu pour être bref : 1 à 3 répétitions douces suffisent, sans hyperventilation.',
    safety:
      "Ne forcez jamais vos poumons. Ne répétez pas plus de 3 à 5 fois d'affilée. En cas de vertige, de gêne ou de sensation désagréable, cessez immédiatement et respirez à votre rythme habituel.",
    defaults: { ...BASE_CONFIG, repetitions: 3, secondInhale: true, autoPace: true },
    options: { repetitions: [1, 2, 3, 5], secondInhale: true, autoPace: true },
  },
  {
    id: 'relaxation-musculaire',
    title: 'Relaxation musculaire progressive',
    category: 'relaxation',
    protocol: 'steps',
    icon: 'bed',
    durationLabel: '≈ 8 min',
    durationIcon: 'schedule',
    summary:
      'Méthode Jacobson adaptée : contraction très douce de 5s suivie de 10s de relâchement profond par groupe musculaire.',
    tags: [{ icon: 'bedtime', label: 'Détente profonde' }],
    instructions:
      'Isolez un groupe musculaire (les poings, puis les épaules, puis le visage…). Contractez très doucement (environ 20 à 30 % de votre force) pendant 5 secondes, puis relâchez complètement pendant 10 secondes en goûtant la détente.',
    benefits: 'Aide à percevoir la différence entre contraction et relâchement, et à déposer les tensions accumulées.',
    eyebrow: 'Méthode Jacobson adaptée',
    cue: 'Serrez très légèrement, sans jamais forcer.',
    safety:
      "Ne forcez jamais au-delà de 20 à 30 % de votre force. Si une zone est endolorie ou sensible, passez-la ou observez-la simplement sans contracter. " +
      SAFETY_GENERAL,
    defaults: { ...BASE_CONFIG, pmrPreset: 'standard', excludedUnits: [] },
    options: { pmrPresets: true, excludableUnits: true },
    units: PMR_GROUPS,
  },
  {
    id: 'scan-corporel',
    title: 'Scan corporel bienveillant',
    category: 'ancrage',
    protocol: 'steps',
    icon: 'self_improvement',
    durationLabel: '3-15 min',
    durationIcon: 'schedule',
    summary:
      "Voyage attentionnel doux des pieds jusqu'au sommet du crâne. Observez chaque zone sans jugement ni obligation de modifier votre souffle.",
    tags: [
      { icon: 'spa', label: 'Présence pleine' },
      { icon: 'volume_up', label: 'Guidage vocal' },
    ],
    instructions:
      "Fermez les yeux ou baissez le regard. Déplacez votre attention comme un faisceau lumineux chaud : pieds, jambes, bassin, ventre, poitrine, épaules, visage, puis l'ensemble du corps. Ne cherchez rien à corriger, constatez simplement.",
    benefits: "Favorise la détente et une attention bienveillante aux sensations du corps.",
    eyebrow: 'Rythme du souffle libre et naturel',
    cue: 'Observez simplement les sensations présentes, sans chercher à les modifier.',
    safety:
      'Prenez quelques instants avant de vous relever. Si une zone est inconfortable, revenez à une sensation neutre comme le contact des mains. ' +
      SAFETY_GENERAL,
    defaults: { ...BASE_CONFIG, durationSec: 300 },
    options: { durations: [180, 300, 600, 900] },
    units: BODY_SCAN_ZONES,
  },
  {
    id: 'marche-attentive',
    title: 'Marche attentive',
    category: 'mouvement',
    protocol: 'prompts',
    icon: 'directions_walk',
    durationLabel: '5-15 min',
    durationIcon: 'schedule',
    summary:
      'Ancrage dans les sensations des pieds au contact du sol et écoute bienveillante des sons environnants. Idéal pour pratiquer en extérieur.',
    tags: [
      { icon: 'park', label: 'Plein air' },
      { icon: 'headphones', label: 'Mode nomade' },
    ],
    instructions:
      'Marchez à allure modérée. Portez votre attention au contact de la plante des pieds avec le sol (talon, déroulé, orteils), puis aux sons et aux textures qui vous entourent. Respirez librement : aucun rythme respiratoire n’est imposé.',
    benefits: 'Idéal lors des pauses ou des transitions de la journée pour dissiper la fatigue mentale.',
    eyebrow: 'Méditation en mouvement',
    cue: 'Ancrez votre esprit dans la cadence naturelle de votre corps. Sans chrono pressé, sans rythme respiratoire forcé.',
    safety:
      'Marchez dans un lieu sécurisé et restez attentif à ce qui vous entoure. Gardez un regard doux et disponible sur votre environnement direct.',
    defaults: { ...BASE_CONFIG, durationSec: 600 },
    options: { durations: [300, 600, 900] },
    units: WALKING_PROMPTS,
  },
  {
    id: 'ancrage-sensoriel',
    title: 'Ancrage sensoriel 5-4-3-2-1',
    category: 'ancrage',
    protocol: 'steps',
    icon: 'visibility',
    durationLabel: 'Rythme libre',
    durationIcon: 'schedule',
    summary:
      "Reconnectez-vous à l'instant : 5 choses que vous voyez, 4 que vous touchez, 3 que vous entendez, 2 que vous sentez, 1 que vous goûtez.",
    tags: [
      { icon: 'visibility', label: 'Visuel & Tactile' },
      { icon: 'healing', label: 'Anti-surcharge' },
    ],
    instructions:
      'Nommez mentalement ou à voix basse : 5 objets que vous voyez, 4 textures que vous touchez, 3 sons que vous entendez, 2 odeurs dans l’air, et 1 goût ou sensation dans votre bouche.',
    benefits: 'Aide à interrompre une boucle de pensées en ramenant l’attention vers le présent.',
    eyebrow: "Ancrage dans l'instant",
    cue: 'Il n’y a aucun compte à rebours. Vous pouvez passer une étape ou explorer un détail aussi longtemps que nécessaire.',
    safety: SAFETY_GENERAL,
    defaults: { ...BASE_CONFIG },
    options: {},
    units: GROUNDING_STEPS,
  },
];

const EXERCISE_MAP = new Map<ExerciseId, Exercise>(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: ExerciseId): Exercise {
  const exercise = EXERCISE_MAP.get(id);
  if (!exercise) throw new Error(`Exercice inconnu : ${id}`);
  return exercise;
}

export function findExercise(id: string | undefined | null): Exercise | undefined {
  return id ? EXERCISE_MAP.get(id as ExerciseId) : undefined;
}

export const SAFETY_NOTE = SAFETY_GENERAL;

/** Search across title, summary, category, tags and instructions (accent-insensitive). */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function searchExercises(query: string, category: CategoryId | 'all'): Exercise[] {
  const q = normalizeSearch(query);
  return EXERCISES.filter((exercise) => {
    if (category !== 'all' && exercise.category !== category) return false;
    if (!q) return true;
    const haystack = normalizeSearch(
      [
        exercise.title,
        exercise.summary,
        getCategory(exercise.category).label,
        exercise.durationLabel,
        exercise.instructions,
        ...exercise.tags.map((t) => t.label),
      ].join(' '),
    );
    return q.split(/\s+/).every((word) => haystack.includes(word));
  });
}
