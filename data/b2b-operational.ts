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
  category: 'container' | 'logistique' | 'legal' | 'finance' | 'telephone' | 'temps';
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
  {
    id: 'listen-action-price-confirm',
    audioIt: 'Mi conferma il totale? Tremilacinquecento euro IVA esclusa, giusto?',
    answerId: 'confirm',
    choices: [
      { id: 'confirm', label: 'Confirmer 3 500 € hors TVA et préciser les conditions de paiement' },
      { id: 'discount', label: 'Proposer immédiatement une remise non demandée' },
      { id: 'redo', label: 'Refaire le devis depuis zéro' },
      { id: 'transfer', label: 'Transférer l\'appel à la comptabilité' },
    ],
  },
  {
    id: 'listen-action-spell',
    audioIt: 'Mi scusi, il mio cognome è Lombardi: L come Livorno, O come Otranto, M come Milano.',
    answerId: 'spell_back',
    choices: [
      { id: 'spell_back', label: "Confirmer en répétant l'épellation pour valider" },
      { id: 'ask_email', label: "Demander seulement l'email" },
      { id: 'send_quote', label: 'Envoyer le devis sans confirmer le nom' },
      { id: 'hang_up', label: 'Raccrocher pour gagner du temps' },
    ],
  },
  {
    id: 'listen-action-deadline',
    audioIt: 'Mi serve la consegna entro venerdì prossimo, è possibile?',
    answerId: 'check_logistics',
    choices: [
      { id: 'check_logistics', label: 'Confirmer après vérification rapide du planning logistique' },
      { id: 'promise_yes', label: 'Promettre oui sans vérifier' },
      { id: 'reject', label: 'Refuser sans explorer la solution' },
      { id: 'price', label: 'Pivoter aussitôt sur le prix' },
    ],
  },
  {
    id: 'listen-action-line-cut',
    audioIt: 'Pronto? Pronto? Mi sente? Credo che la linea sia caduta...',
    answerId: 'callback',
    choices: [
      { id: 'callback', label: "Rappeler immédiatement et s'excuser brièvement" },
      { id: 'wait', label: 'Attendre que le client rappelle' },
      { id: 'send_email', label: 'Envoyer un email à la place' },
      { id: 'ignore', label: 'Considérer l\'appel comme terminé' },
    ],
  },
  {
    id: 'listen-action-not-now',
    audioIt: 'Adesso non è il momento giusto. Mi richiami fra due settimane.',
    answerId: 'reschedule',
    choices: [
      { id: 'reschedule', label: 'Noter la date exacte et confirmer le créneau' },
      { id: 'insist', label: 'Insister pour parler tout de suite' },
      { id: 'send_quote', label: 'Envoyer le devis sans son accord' },
      { id: 'goodbye', label: 'Raccrocher sans plan de suivi' },
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
  'Le confermo: tremilacinquecento euro IVA esclusa, consegna entro venerdì.',
  'Mi scusi, può ripetere il numero più lentamente?',
  'Quindi, se ho capito bene, Le serve per il quindici marzo.',
  'Le faccio lo spelling: M come Milano, A come Ancona, R come Roma.',
  'Su questo punto preferisco non improvvisare. Le richiamo entro un\'ora.',
  'La prossima tappa è la firma del contratto. Le mando l\'email di riepilogo.',
  'Possiamo applicare uno sconto del cinque per cento sul totale.',
  'Resto a Sua disposizione per qualsiasi chiarimento.',
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
  { id: 'z', label: 'z [ts] / [dz]', examples: ['prezzo', 'azienda', 'scadenza', 'pranzo'] },
  { id: 'ce-ci', label: 'ce / ci [tʃ]', examples: ['certo', 'centesimi', 'cinque', 'ciao'] },
  { id: 'ge-gi', label: 'ge / gi [dʒ]', examples: ['giorno', 'giugno', 'gentile', 'oggi'] },
  { id: 'open-e', label: 'è ouvert vs é fermé', examples: ['è', 'caffè', 'perché', 'venerdì'] },
  { id: 'tonic', label: 'accent tonique', examples: ['telefono', 'numero', 'subito', 'azienda'] },
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
  { id: 'fi-05', it: 'saldo', fr: 'solde (à payer)', category: 'finance' },
  { id: 'fi-06', it: 'bonifico bancario', fr: 'virement bancaire', category: 'finance' },
  { id: 'fi-07', it: 'IVA al 22%', fr: 'TVA à 22 %', category: 'finance' },
  { id: 'fi-08', it: 'sconto del 5%', fr: 'remise de 5 %', category: 'finance' },
  { id: 'fi-09', it: 'pagamento a 30 giorni', fr: 'paiement à 30 jours', category: 'finance' },
  { id: 'fi-10', it: 'fattura elettronica', fr: 'facture électronique (obligatoire en Italie)', category: 'finance' },
  { id: 'tel-01', it: 'Pronto?', fr: 'Allô ? (uniquement pour décrocher)', category: 'telephone' },
  { id: 'tel-02', it: 'Mi sente?', fr: "M'entendez-vous ?", category: 'telephone' },
  { id: 'tel-03', it: 'Resti in linea', fr: 'Restez en ligne', category: 'telephone' },
  { id: 'tel-04', it: 'Le passo il collega', fr: 'Je vous passe mon collègue', category: 'telephone' },
  { id: 'tel-05', it: 'È caduta la linea', fr: 'La ligne a coupé', category: 'telephone' },
  { id: 'tel-06', it: 'Mi può richiamare?', fr: 'Pouvez-vous me rappeler ?', category: 'telephone' },
  { id: 'tel-07', it: 'Lascio un messaggio', fr: 'Je laisse un message', category: 'telephone' },
  { id: 'tel-08', it: 'Le faccio lo spelling', fr: 'Je vous épelle', category: 'telephone' },
  { id: 'tmp-01', it: 'entro venerdì', fr: 'avant vendredi (deadline)', category: 'temps' },
  { id: 'tmp-02', it: 'fra due settimane', fr: 'dans deux semaines', category: 'temps' },
  { id: 'tmp-03', it: 'lunedì prossimo', fr: 'lundi prochain', category: 'temps' },
  { id: 'tmp-04', it: 'in giornata', fr: 'dans la journée', category: 'temps' },
  { id: 'tmp-05', it: 'a fine mese', fr: 'en fin de mois', category: 'temps' },
  { id: 'tmp-06', it: 'alle dieci e mezza', fr: 'à 10 h 30', category: 'temps' },
  { id: 'tmp-07', it: 'alle quindici in punto', fr: 'à 15 h pile (format 24 h)', category: 'temps' },
  { id: 'tmp-08', it: 'la scadenza dell\'offerta', fr: "la validité de l'offre", category: 'temps' },
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
  {
    title: 'Format dates et heures',
    body: 'En italien pro: dates en jour/mois, format 24 h fréquent ("alle quindici"). Seul le 1er du mois est ordinal ("il primo maggio"), les autres sont cardinaux ("il 15 marzo").',
  },
  {
    title: 'Épeler avec les villes',
    body: "Pour confirmer un nom au téléphone, les Italiens utilisent l'alphabet des villes: A come Ancona, B come Bologna, M come Milano. Indispensable pour emails, codes client et références devis.",
  },
  {
    title: 'Prononcer les chiffres',
    body: "À l'oral, un grand nombre se découpe pour la clarté: 3 547 = «tre mila... cinque cento... quaranta sette». Toujours répéter le total à la fin: «Le ripeto: tremilacinquecento euro IVA esclusa».",
  },
  {
    title: 'Conclure un appel',
    body: "Ne raccrochez jamais sans avoir nommé la prochaine étape: \"La prossima tappa è...\" + email récapitulatif sous 1 h. C'est attendu en B2B italien.",
  },
];
