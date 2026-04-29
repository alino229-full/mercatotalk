export type LearningPhase = {
  id: string;
  title: string;
  weeks: string;
  goal: string;
  progress: number;
  accentColor: string;
  lessons: string[];
};

export type PracticeItem = {
  id: string;
  type: 'audio' | 'quiz' | 'call' | 'dictation';
  title: string;
  subtitle: string;
  duration: string;
  cost: 'gratuit' | 'faible' | 'premium';
};

export type CostTier = {
  id: string;
  label: string;
  provider: string;
  usage: string;
  monthlyEstimate: string;
  priority: number;
};

export const phases: LearningPhase[] = [
  {
    id: 'phase-prono',
    title: 'Prononciation italienne',
    weeks: 'Semaines 1-2',
    goal: 'Maitriser les sons specifiques a l\'italien: gli, gn, ci, ge, sc, doubles consonnes.',
    progress: 0,
    accentColor: '#8B5CF6',
    lessons: ['Mots simples et accents', 'CH / CA / CO / CU', 'CI / CE / GI / GE', 'GH / GL / GN', 'SC / H / S / Z', 'Lettres doubles'],
  },
  {
    id: 'phase-gen1',
    title: 'Vie quotidienne — bases',
    weeks: 'Semaines 1-4',
    goal: 'Saluer, compter, nommer les couleurs, dire l\'heure et connaitre l\'alphabet.',
    progress: 0,
    accentColor: '#58CC02',
    lessons: ['Salutations', 'Bonnes manieres', 'Alphabet', 'Compter 1-100', 'Les couleurs', 'L\'heure'],
  },
  {
    id: 'phase-gen2',
    title: 'Communication du quotidien',
    weeks: 'Semaines 3-6',
    goal: 'Parler de sa famille, exprimer ses sentiments, s\'orienter, decrire sa maison.',
    progress: 0,
    accentColor: '#1CB0F6',
    lessons: ['Poser des questions', 'La famille', 'Sentiments et emotions', 'Articles italiens', 'Indications et direction', 'La maison', 'La cuisine', 'La salle de bain'],
  },
  {
    id: 'phase-gen3',
    title: 'Grammaire et structures',
    weeks: 'Semaines 5-8',
    goal: 'Conjuguer au present, au passe, au futur et utiliser les pronoms COD.',
    progress: 0,
    accentColor: '#FF9600',
    lessons: ['Verbes au present', 'Present continu', 'Pronoms COD', 'Passe compose', 'Passe continu', 'Le futur'],
  },
  {
    id: 'phase-vocab',
    title: 'Vocabulaire thematique',
    weeks: 'Semaines 7-10',
    goal: 'Maitriser le vocabulaire des transports, loisirs, maison et accessoires.',
    progress: 0,
    accentColor: '#FF4B4B',
    lessons: ['Transports', 'Oceans et maritime', 'Films et livres', 'Loisirs et sports', 'Adverbes de lieu', 'Accessoires', 'Salon et chambre', 'Phrases utiles'],
  },
  {
    id: 'phase-adv',
    title: 'Maitrise et perfection',
    weeks: 'Semaines 9-12',
    goal: 'Comparaisons, superlatifs, possessifs, demonstratifs, gouts et expressions avancees.',
    progress: 0,
    accentColor: '#CE82FF',
    lessons: ['Comparaisons', 'Superlatif', 'Egalite', 'Adjectifs possessifs', 'Pronoms demonstratifs', 'Gouts et degouts', 'Traduction', 'Expressions avancees'],
  },
  {
    id: 'phase-1',
    title: 'B2B — Fondations',
    weeks: 'Semaines 2-5',
    goal: 'Pronoms formels, auxiliaires, nombres et politesse au telephone commercial.',
    progress: 0.38,
    accentColor: '#22c55e',
    lessons: ['Pronoms io/tu/Lei', 'Essere et avere', 'Nombres et prix', 'Sons gli, gn, chi'],
  },
  {
    id: 'phase-2',
    title: 'B2B — Communication commerciale',
    weeks: 'Semaines 5-8',
    goal: 'Construire une conversation B2B complete et gerer les objections.',
    progress: 0.12,
    accentColor: '#38bdf8',
    lessons: ['Ouverture appel', 'Qualification client', 'Devis et prix', 'Objections courantes'],
  },
  {
    id: 'phase-tech-b2b',
    title: 'B2B — Vocabulaire technique',
    weeks: 'Semaines 6-10',
    goal: 'Parler container, logistique, legal et finance sans hesitation pendant un appel client.',
    progress: 0,
    accentColor: '#0F766E',
    lessons: ['20/40 pieds, HC, OS, RF', 'Livraison, scarico, gru', 'CILA et permis', 'Partita IVA, facture, acompte'],
  },
  {
    id: 'phase-3',
    title: 'B2B — Maitrise avancee',
    weeks: 'Semaines 9-12',
    goal: 'Negociation, imprevu, email pro et scripts d\'appels complets avec IA.',
    progress: 0.04,
    accentColor: '#f59e0b',
    lessons: ['Conditionnel', 'Passe compose', 'Email pro', 'Commande et livraison', 'Connecteurs', 'Negociation', 'Imprevus', 'Script complet'],
  },
  {
    id: 'phase-culture',
    title: 'Culture et civilisation italienne',
    weeks: 'Semaines 13-15',
    goal: 'Maitrise culturelle: geographie, gastronomie, art, sport, fetes et proverbes pour briser la glace.',
    progress: 0,
    accentColor: '#D97706',
    lessons: ['Geographie italienne', 'Gastronomie', 'Art et Renaissance', 'Sport et passion', 'Fetes et traditions', 'Proverbes et sagesse'],
  },
  {
    id: 'phase-4',
    title: 'B2B — Communication avancee',
    weeks: 'Semaines 13-17',
    goal: 'Reunions virtuelles, secteurs industriels, contrats, fidelisation, voyage d\'affaires et marketing.',
    progress: 0,
    accentColor: '#0D9488',
    lessons: ['Reunion et presentiel', 'Secteurs industriels', 'Contrats et juridique', 'Fidelisation client', 'Voyage d\'affaires', 'Marketing et communication'],
  },
  {
    id: 'phase-5',
    title: 'Maitrise orale et improvisation',
    weeks: 'Semaines 17-20',
    goal: 'Ecoute active, reformulation, gestion du silence, accents regionaux, closing avance et improvisation.',
    progress: 0,
    accentColor: '#7C3AED',
    lessons: ['Ecoute active', 'Gestion des pauses', 'Humour et cordialite', 'Accents regionaux', 'Closing avance', 'Improvisation complete'],
  },
];

export const dailyPractices: PracticeItem[] = [
  {
    id: 'tts-model',
    type: 'audio',
    title: 'Ecouter le modele natif',
    subtitle: 'TTS local expo-speech, zero cout API.',
    duration: '3 min',
    cost: 'gratuit',
  },
  {
    id: 'sm2-review',
    type: 'quiz',
    title: 'Revision SM-2',
    subtitle: '12 cartes dues sur pronoms et prix.',
    duration: '7 min',
    cost: 'gratuit',
  },
  {
    id: 'dictation',
    type: 'dictation',
    title: 'Dictee commerciale',
    subtitle: 'Comparer localement puis demander une correction IA si utile.',
    duration: '8 min',
    cost: 'faible',
  },
  {
    id: 'call-sim',
    type: 'call',
    title: 'Mini appel objection',
    subtitle: 'Mode texte d abord, voix premium uniquement sur demande.',
    duration: '10 min',
    cost: 'faible',
  },
];

export const costTiers: CostTier[] = [
  {
    id: 'local-first',
    label: 'Local first',
    provider: 'expo-speech + SM-2 client',
    usage: 'Ecoute, flashcards, scoring simple, revision offline.',
    monthlyEstimate: '0 euro',
    priority: 1,
  },
  {
    id: 'open-source',
    label: 'Open source',
    provider: 'Whisper local ou serveur GPU ponctuel',
    usage: 'Transcription par lot, entrainement intensif hors temps reel.',
    monthlyEstimate: '0-5 euros',
    priority: 2,
  },
  {
    id: 'cheap-cloud',
    label: 'Cloud economique',
    provider: 'Gemini Flash/Lite, Groq, OpenRouter, Together',
    usage: 'Correction grammaticale, roleplay texte, feedback court.',
    monthlyEstimate: '5-20 euros',
    priority: 3,
  },
  {
    id: 'premium-voice',
    label: 'Premium ponctuel',
    provider: 'Claude Sonnet + ElevenLabs',
    usage: 'Examens finaux, rapport detaille, voix italienne naturelle.',
    monthlyEstimate: 'Sur declenchement',
    priority: 4,
  },
];

export const heroPhrase = {
  italian: 'Buongiorno, sono Pierre di MercatoTalk. Posso parlarLe del nostro preventivo?',
  french: 'Bonjour, je suis Pierre de MercatoTalk. Puis-je vous parler de notre devis ?',
  phonetic: 'Bouon-djor-no, so-no Pi-er-re di MercatoTalk. Pos-so par-lar-le del nos-tro pre-ven-ti-vo?',
};
