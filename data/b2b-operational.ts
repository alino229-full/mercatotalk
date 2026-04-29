export type B2BMood = 'cordial' | 'presse' | 'mefiant' | 'irrite' | 'professionnel';

export type ListenActionQuestion = {
  id: string;
  audioIt: string;
  answerId: string;
  choices: { id: string; label: string }[];
};

export type RoadmapMilestone = {
  day: number;
  title: string;
  promise: string;
  gate: string;
};

export type TechnicalTerm = {
  id: string;
  it: string;
  fr: string;
  category: 'container' | 'logistique' | 'legal' | 'finance';
};

export type DailyB2BNews = {
  title: string;
  it: string;
  keywords: string[];
};

export const b2bMoods: { id: B2BMood; label: string; tone: string }[] = [
  { id: 'mefiant', label: 'client méfiant', tone: 'questions courtes, besoin de preuves, peu de patience' },
  { id: 'presse', label: 'client pressé', tone: 'phrases rapides, interruptions, demande une réponse directe' },
  { id: 'cordial', label: 'client cordial', tone: 'ouvert mais exige une prochaine étape claire' },
  { id: 'irrite', label: 'client irrité', tone: 'ton sec, objections fortes, refuse le flou' },
  { id: 'professionnel', label: 'client professionnel', tone: 'précis, rationnel, compare les conditions' },
];

export const listenActionQuestions: ListenActionQuestion[] = [
  {
    id: 'listen-action-quote',
    audioIt: 'Mi mandi il preventivo entro oggi, con consegna e scarico separati, per favore.',
    answerId: 'send_quote',
    choices: [
      { id: 'send_quote', label: 'Envoyer un devis détaillé avec consegna et scarico séparés' },
      { id: 'call_back', label: 'Rappeler demain pour reprendre la discussion' },
      { id: 'refuse', label: 'Refuser car le devis est impossible aujourd\'hui' },
      { id: 'qualify', label: 'Demander d\'abord son budget' },
    ],
  },
  {
    id: 'listen-action-callback',
    audioIt: 'Adesso sono in riunione. Mi richiami domani mattina dopo le nove.',
    answerId: 'call_back',
    choices: [
      { id: 'send_quote', label: 'Lui envoyer la brochure tout de suite' },
      { id: 'call_back', label: 'Planifier un rappel demain matin après 9h' },
      { id: 'discount', label: 'Lui proposer une remise pour le retenir' },
      { id: 'close', label: 'Demander la signature avant qu\'il raccroche' },
    ],
  },
  {
    id: 'listen-action-qualify',
    audioIt: 'Prima di parlare di prezzo, devo capire se potete consegnare a Bologna entro il quindici marzo.',
    answerId: 'qualify',
    choices: [
      { id: 'qualify', label: 'Confirmer qu\'on peut livrer Bologne avant le 15 mars' },
      { id: 'refuse', label: 'Dire que c\'est impossible dans ce délai' },
      { id: 'smalltalk', label: 'Faire une phrase de courtoisie sur Bologne' },
      { id: 'price', label: 'Donner le prix tout de suite' },
    ],
  },
  {
    id: 'listen-action-refuse',
    audioIt: 'No, grazie. Abbiamo già un fornitore e non vogliamo cambiare quest\'anno.',
    answerId: 'refuse',
    choices: [
      { id: 'close', label: 'Pousser la signature malgré son refus' },
      { id: 'refuse', label: 'Accuser réception et proposer un suivi dans 6 mois' },
      { id: 'send_quote', label: 'Envoyer un devis non sollicité' },
      { id: 'delivery', label: 'Confirmer une livraison qu\'il n\'a pas demandée' },
    ],
  },
];

export const warmupPhrases = [
  'Buongiorno, sono Pierre di MercatoTalk. Le disturbo un momento?',
  'Quale utilizzo prevede per il container?',
  'Le invio un preventivo dettagliato entro oggi.',
  'La consegna e lo scarico sono indicati separatamente.',
  'Capisco la Sua preoccupazione sul prezzo.',
  'Possiamo fissare una breve chiamata tecnica?',
];

export const roadmap120: RoadmapMilestone[] = [
  { day: 30, title: 'J30', promise: '200 mots utiles, je décroche un appel simple', gate: 'Quiz nombres + politesse ≥ 75%' },
  { day: 60, title: 'J60', promise: 'Je qualifie un prospect sans sous-titres', gate: 'Écoute chronométrée ≥ 80%' },
  { day: 90, title: 'J90', promise: 'Je gère une objection prix ou délai', gate: 'Simulation difficile ≥ 75/100' },
  { day: 120, title: 'J120', promise: 'Premier vrai appel client B2B', gate: 'Test final 30 min ≥ 80%' },
];

export const phonemeTargets = [
  { id: 'gli', label: 'gli', examples: ['famiglia', 'consigliare', 'meglio', 'dettagli'] },
  { id: 'gn', label: 'gn', examples: ['bisogno', 'consegna', 'Bologna', 'bagno'] },
  { id: 'sci', label: 'sci/sce', examples: ['scelta', 'scendere', 'lasciare', 'conoscere'] },
  { id: 'double', label: 'doubles consonnes', examples: ['anno', 'offerta', 'fattura', 'allacciamento'] },
  { id: 'r', label: 'r roulé', examples: ['preventivo', 'fornitore', 'scarico', 'garanzia'] },
];

export const technicalTerms: TechnicalTerm[] = [
  { id: 'tc-20', it: 'container da 20 piedi', fr: 'container 20 pieds', category: 'container' },
  { id: 'tc-40', it: 'container da 40 piedi', fr: 'container 40 pieds', category: 'container' },
  { id: 'tc-hc', it: 'High Cube', fr: 'plus haut que le standard', category: 'container' },
  { id: 'tc-os', it: 'Open Side', fr: 'ouverture latérale', category: 'container' },
  { id: 'tc-rf', it: 'container frigorifero', fr: 'container réfrigéré', category: 'container' },
  { id: 'lg-01', it: 'scarico', fr: 'déchargement', category: 'logistique' },
  { id: 'lg-02', it: 'gru', fr: 'grue', category: 'logistique' },
  { id: 'lg-03', it: 'transpallet', fr: 'transpalette', category: 'logistique' },
  { id: 'lg-04', it: 'consegna in cantiere', fr: 'livraison sur chantier', category: 'logistique' },
  { id: 'le-01', it: 'CILA asseverata', fr: 'déclaration de travaux assermentée', category: 'legal' },
  { id: 'le-02', it: 'permesso di costruire', fr: 'permis de construire', category: 'legal' },
  { id: 'le-03', it: 'certificato di conformità', fr: 'certificat de conformité', category: 'legal' },
  { id: 'fi-01', it: 'partita IVA', fr: 'numéro de TVA italien', category: 'finance' },
  { id: 'fi-02', it: 'fattura pro forma', fr: 'facture pro forma', category: 'finance' },
  { id: 'fi-03', it: 'scadenza pagamento', fr: 'échéance de paiement', category: 'finance' },
  { id: 'fi-04', it: 'acconto', fr: 'acompte', category: 'finance' },
];

export const dailyB2BNews: DailyB2BNews = {
  title: 'Logistica e cantieri: tempi chiari prima del preventivo',
  it: 'Le aziende italiane chiedono sempre più spesso date di consegna precise, costi di scarico separati e condizioni di pagamento trasparenti prima di confermare un ordine.',
  keywords: ['consegna', 'scarico', 'preventivo', 'ordine', 'pagamento'],
};

export const cultureCards = [
  {
    title: 'Lei en B2B',
    body: 'En premier appel, utilisez Lei jusqu\'à ce que le client propose explicitement un ton plus informel.',
  },
  {
    title: 'Août ralentit',
    body: 'Ferragosto et les congés d\'août peuvent ralentir devis, logistique et signatures. Anticipez vos relances.',
  },
  {
    title: 'Nord, Centre, Sud',
    body: 'Les attentes de délai et de relation varient beaucoup selon les régions. Reformulez toujours la priorité du client.',
  },
  {
    title: 'Écrit après appel',
    body: 'Un récapitulatif email clair est très apprécié : prix, délai, inclus, exclus, prochaine action.',
  },
];
