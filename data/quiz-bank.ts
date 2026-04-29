/**
 * Static quiz bank — provides 250+ items across all language categories.
 * Combined with the SM-2 cards from SQLite to build randomised series.
 */

export type QuizBankItem = {
  id: string;
  it: string;
  fr: string;
  phonetic?: string;
  category: string;
};

const BANK: QuizBankItem[] = [
  // ── Nombres ───────────────────────────────────────────────────────────────
  { id: 'num-01', it: 'uno', fr: 'un (1)', phonetic: '[ˈuːno]', category: 'nombres' },
  { id: 'num-02', it: 'due', fr: 'deux (2)', phonetic: '[ˈduːe]', category: 'nombres' },
  { id: 'num-03', it: 'tre', fr: 'trois (3)', phonetic: '[ˈtreː]', category: 'nombres' },
  { id: 'num-04', it: 'quattro', fr: 'quatre (4)', phonetic: '[ˈkwattro]', category: 'nombres' },
  { id: 'num-05', it: 'cinque', fr: 'cinq (5)', phonetic: '[ˈtʃiŋkwe]', category: 'nombres' },
  { id: 'num-06', it: 'sei', fr: 'six (6)', phonetic: '[sɛi]', category: 'nombres' },
  { id: 'num-07', it: 'sette', fr: 'sept (7)', phonetic: '[ˈsɛtte]', category: 'nombres' },
  { id: 'num-08', it: 'otto', fr: 'huit (8)', phonetic: '[ˈɔtto]', category: 'nombres' },
  { id: 'num-09', it: 'nove', fr: 'neuf (9)', phonetic: '[ˈnoːve]', category: 'nombres' },
  { id: 'num-10', it: 'dieci', fr: 'dix (10)', phonetic: '[ˈdjɛtʃi]', category: 'nombres' },
  { id: 'num-11', it: 'undici', fr: 'onze (11)', phonetic: '[ˈunditʃi]', category: 'nombres' },
  { id: 'num-12', it: 'dodici', fr: 'douze (12)', phonetic: '[ˈdɔːditʃi]', category: 'nombres' },
  { id: 'num-15', it: 'quindici', fr: 'quinze (15)', phonetic: '[ˈkwinditʃi]', category: 'nombres' },
  { id: 'num-20', it: 'venti', fr: 'vingt (20)', phonetic: '[ˈvɛnti]', category: 'nombres' },
  { id: 'num-30', it: 'trenta', fr: 'trente (30)', phonetic: '[ˈtrɛnta]', category: 'nombres' },
  { id: 'num-40', it: 'quaranta', fr: 'quarante (40)', phonetic: '[kwaˈranta]', category: 'nombres' },
  { id: 'num-50', it: 'cinquanta', fr: 'cinquante (50)', phonetic: '[tʃiŋˈkwanta]', category: 'nombres' },
  { id: 'num-100', it: 'cento', fr: 'cent (100)', phonetic: '[ˈtʃɛnto]', category: 'nombres' },
  { id: 'num-1000', it: 'mille', fr: 'mille (1 000)', phonetic: '[ˈmille]', category: 'nombres' },
  { id: 'num-p', it: 'il percento', fr: 'le pourcentage', phonetic: '[pertʃɛnto]', category: 'nombres' },
  { id: 'num-euro', it: 'euro', fr: 'euro', phonetic: '[ˈɛuro]', category: 'nombres' },
  { id: 'num-pr', it: 'il prezzo unitario', fr: 'le prix unitaire', category: 'nombres' },

  // ── Conjugaisons essere ────────────────────────────────────────────────────
  { id: 'conj-e01', it: 'io sono', fr: 'je suis', phonetic: '[ˈsoːno]', category: 'conjugaison' },
  { id: 'conj-e02', it: 'tu sei', fr: 'tu es', phonetic: '[sɛi]', category: 'conjugaison' },
  { id: 'conj-e03', it: 'lui / lei è', fr: 'il / elle est', phonetic: '[ɛ]', category: 'conjugaison' },
  { id: 'conj-e04', it: 'noi siamo', fr: 'nous sommes', phonetic: '[ˈsjaːmo]', category: 'conjugaison' },
  { id: 'conj-e05', it: 'voi siete', fr: 'vous êtes', phonetic: '[ˈsjɛːte]', category: 'conjugaison' },
  { id: 'conj-e06', it: 'loro sono', fr: 'ils / elles sont', category: 'conjugaison' },

  // ── Conjugaisons avere ────────────────────────────────────────────────────
  { id: 'conj-a01', it: 'io ho', fr: 'j\'ai', phonetic: '[ɔ]', category: 'conjugaison' },
  { id: 'conj-a02', it: 'tu hai', fr: 'tu as', phonetic: '[ai]', category: 'conjugaison' },
  { id: 'conj-a03', it: 'lui / lei ha', fr: 'il / elle a', phonetic: '[a]', category: 'conjugaison' },
  { id: 'conj-a04', it: 'noi abbiamo', fr: 'nous avons', phonetic: '[abˈbjaːmo]', category: 'conjugaison' },
  { id: 'conj-a05', it: 'voi avete', fr: 'vous avez', phonetic: '[aˈveːte]', category: 'conjugaison' },
  { id: 'conj-a06', it: 'loro hanno', fr: 'ils ont', phonetic: '[ˈanno]', category: 'conjugaison' },

  // ── Conjugaisons conditionnel ─────────────────────────────────────────────
  { id: 'conj-c01', it: 'vorrei', fr: 'je voudrais', phonetic: '[vorˈrɛi]', category: 'conjugaison' },
  { id: 'conj-c02', it: 'potrei', fr: 'je pourrais', phonetic: '[poˈtrɛi]', category: 'conjugaison' },
  { id: 'conj-c03', it: 'dovrei', fr: 'je devrais', phonetic: '[doˈvrɛi]', category: 'conjugaison' },
  { id: 'conj-c04', it: 'sarei', fr: 'je serais', phonetic: '[saˈrɛi]', category: 'conjugaison' },
  { id: 'conj-c05', it: 'avrei', fr: 'j\'aurais', phonetic: '[aˈvrɛi]', category: 'conjugaison' },

  // ── Verbes courants ───────────────────────────────────────────────────────
  { id: 'vb-01', it: 'comprare', fr: 'acheter', phonetic: '[komˈpraːre]', category: 'verbes' },
  { id: 'vb-02', it: 'vendere', fr: 'vendre', phonetic: '[ˈvɛndere]', category: 'verbes' },
  { id: 'vb-03', it: 'pagare', fr: 'payer', phonetic: '[paˈɡaːre]', category: 'verbes' },
  { id: 'vb-04', it: 'firmare', fr: 'signer', phonetic: '[firˈmaːre]', category: 'verbes' },
  { id: 'vb-05', it: 'consegnare', fr: 'livrer', phonetic: '[konseɲˈɲaːre]', category: 'verbes' },
  { id: 'vb-06', it: 'ordinare', fr: 'commander', phonetic: '[ordiˈnaːre]', category: 'verbes' },
  { id: 'vb-07', it: 'contattare', fr: 'contacter', phonetic: '[kontaˈttaːre]', category: 'verbes' },
  { id: 'vb-08', it: 'confermare', fr: 'confirmer', phonetic: '[konferˈmaːre]', category: 'verbes' },
  { id: 'vb-09', it: 'negoziare', fr: 'négocier', phonetic: '[neˈɡottsjaːre]', category: 'verbes' },
  { id: 'vb-10', it: 'presentare', fr: 'présenter', phonetic: '[prezenˈtaːre]', category: 'verbes' },
  { id: 'vb-11', it: 'gestire', fr: 'gérer', phonetic: '[dʒesˈtiːre]', category: 'verbes' },
  { id: 'vb-12', it: 'risolvere', fr: 'résoudre', phonetic: '[riˈzɔlvere]', category: 'verbes' },
  { id: 'vb-13', it: 'controllare', fr: 'contrôler / vérifier', phonetic: '[kontrolˈlaːre]', category: 'verbes' },
  { id: 'vb-14', it: 'preparare', fr: 'préparer', phonetic: '[prepaˈraːre]', category: 'verbes' },
  { id: 'vb-15', it: 'consigliare', fr: 'conseiller', phonetic: '[konsiʎˈʎaːre]', category: 'verbes' },

  // ── Grammaire : articles ──────────────────────────────────────────────────
  { id: 'gr-01', it: 'il (masc. sing.)', fr: 'le (masculin singulier)', category: 'grammaire' },
  { id: 'gr-02', it: 'la (fém. sing.)', fr: 'la (féminin singulier)', category: 'grammaire' },
  { id: 'gr-03', it: 'i (masc. plur.)', fr: 'les (masculin pluriel)', category: 'grammaire' },
  { id: 'gr-04', it: 'le (fém. plur.)', fr: 'les (féminin pluriel)', category: 'grammaire' },
  { id: 'gr-05', it: 'un / una', fr: 'un / une', category: 'grammaire' },
  { id: 'gr-06', it: 'dello / della', fr: 'du / de la (partitif)', category: 'grammaire' },
  { id: 'gr-07', it: 'questo / questa', fr: 'ce / cette (proche)', category: 'grammaire' },
  { id: 'gr-08', it: 'quello / quella', fr: 'ce / cette (éloigné)', category: 'grammaire' },
  { id: 'gr-09', it: 'mio / mia', fr: 'mon / ma', category: 'grammaire' },
  { id: 'gr-10', it: 'suo / sua', fr: 'son / sa (aussi votre avec Lei)', category: 'grammaire' },

  // ── Phrases B2B complètes ─────────────────────────────────────────────────
  { id: 'ph-01', it: 'Come posso aiutarLa?', fr: 'Comment puis-je vous aider ?', category: 'phrases' },
  { id: 'ph-02', it: 'Le invio il preventivo oggi.', fr: 'Je vous envoie le devis aujourd\'hui.', category: 'phrases' },
  { id: 'ph-03', it: 'Possiamo trovare un accordo.', fr: 'Nous pouvons trouver un accord.', category: 'phrases' },
  { id: 'ph-04', it: 'Il prezzo include l\'installazione.', fr: 'Le prix inclut l\'installation.', category: 'phrases' },
  { id: 'ph-05', it: 'La consegna è prevista per lunedì.', fr: 'La livraison est prévue pour lundi.', category: 'phrases' },
  { id: 'ph-06', it: 'Ha già visto il nostro catalogo?', fr: 'Avez-vous déjà consulté notre catalogue ?', category: 'phrases' },
  { id: 'ph-07', it: 'Resto a Sua disposizione.', fr: 'Je reste à votre disposition.', category: 'phrases' },
  { id: 'ph-08', it: 'Le mando la documentazione domani.', fr: 'Je vous envoie la documentation demain.', category: 'phrases' },
  { id: 'ph-09', it: 'Posso offrire uno sconto del 5%.', fr: 'Je peux offrir une remise de 5 %.', category: 'phrases' },
  { id: 'ph-10', it: 'Abbiamo un\'offerta speciale questo mese.', fr: 'Nous avons une offre spéciale ce mois-ci.', category: 'phrases' },
  { id: 'ph-11', it: 'Mi scusi, non ho capito bene.', fr: 'Excusez-moi, je n\'ai pas bien compris.', category: 'phrases' },
  { id: 'ph-12', it: 'Può ripetere più lentamente?', fr: 'Pouvez-vous répéter plus lentement ?', category: 'phrases' },
  { id: 'ph-13', it: 'Siamo specialisti nel settore.', fr: 'Nous sommes spécialistes dans ce secteur.', category: 'phrases' },
  { id: 'ph-14', it: 'Le garantisco la qualità del prodotto.', fr: 'Je vous garantis la qualité du produit.', category: 'phrases' },
  { id: 'ph-15', it: 'Possiamo organizzare una visita?', fr: 'Pouvons-nous organiser une visite ?', category: 'phrases' },
  { id: 'ph-16', it: 'Il pagamento è a 30 giorni.', fr: 'Le paiement est à 30 jours.', category: 'phrases' },
  { id: 'ph-17', it: 'Aspetto una sua risposta entro venerdì.', fr: 'J\'attends votre réponse avant vendredi.', category: 'phrases' },
  { id: 'ph-18', it: 'Capisco la Sua preoccupazione.', fr: 'Je comprends votre inquiétude.', category: 'phrases' },
  { id: 'ph-19', it: 'Siamo aperti alla trattativa.', fr: 'Nous sommes ouverts à la négociation.', category: 'phrases' },
  { id: 'ph-20', it: 'La ringrazio per la Sua fiducia.', fr: 'Je vous remercie de votre confiance.', category: 'phrases' },

  // ── Objections commerciales ───────────────────────────────────────────────
  { id: 'obj-01', it: 'È troppo caro.', fr: 'C\'est trop cher.', category: 'objections' },
  { id: 'obj-02', it: 'Devo pensarci.', fr: 'Je dois y réfléchir.', category: 'objections' },
  { id: 'obj-03', it: 'Ho già un fornitore.', fr: 'J\'ai déjà un fournisseur.', category: 'objections' },
  { id: 'obj-04', it: 'Non ho il budget.', fr: 'Je n\'ai pas le budget.', category: 'objections' },
  { id: 'obj-05', it: 'Devo chiedere al mio responsabile.', fr: 'Je dois demander à mon responsable.', category: 'objections' },
  { id: 'obj-06', it: 'Non è il momento giusto.', fr: 'Ce n\'est pas le bon moment.', category: 'objections' },
  { id: 'obj-07', it: 'Ho bisogno di più informazioni.', fr: 'J\'ai besoin de plus d\'informations.', category: 'objections' },
  { id: 'obj-08', it: 'Il concorrente propone meno.', fr: 'Le concurrent propose moins cher.', category: 'objections' },

  // ── Réponses aux objections ───────────────────────────────────────────────
  { id: 'rep-01', it: 'Capisco. Posso spiegarLe il valore?', fr: 'Je comprends. Puis-je vous expliquer la valeur ?', category: 'objections' },
  { id: 'rep-02', it: 'È il prezzo più competitivo del mercato.', fr: 'C\'est le prix le plus compétitif du marché.', category: 'objections' },
  { id: 'rep-03', it: 'Possiamo adattare l\'offerta al Suo budget.', fr: 'Nous pouvons adapter l\'offre à votre budget.', category: 'objections' },
  { id: 'rep-04', it: 'Posso richiamarLa la settimana prossima?', fr: 'Puis-je vous rappeler la semaine prochaine ?', category: 'objections' },

  // ── Vocabulaire container / produit ──────────────────────────────────────
  { id: 'cont-01', it: 'il container da 20 piedi', fr: 'le conteneur de 20 pieds', category: 'produit' },
  { id: 'cont-02', it: 'il container da 40 piedi', fr: 'le conteneur de 40 pieds', category: 'produit' },
  { id: 'cont-03', it: 'il modulo abitabile', fr: 'le module habitable', category: 'produit' },
  { id: 'cont-04', it: 'l\'isolamento termico', fr: 'l\'isolation thermique', category: 'produit' },
  { id: 'cont-05', it: 'la porta blindata', fr: 'la porte blindée', category: 'produit' },
  { id: 'cont-06', it: 'la finestra', fr: 'la fenêtre', category: 'produit' },
  { id: 'cont-07', it: 'il pavimento', fr: 'le sol / le plancher', category: 'produit' },
  { id: 'cont-08', it: 'l\'allacciamento elettrico', fr: 'le raccordement électrique', category: 'produit' },
  { id: 'cont-09', it: 'il bagno', fr: 'la salle de bain', category: 'produit' },
  { id: 'cont-10', it: 'la cucina compatta', fr: 'la kitchenette', category: 'produit' },
  { id: 'cont-11', it: 'il permesso edilizio', fr: 'le permis de construire', category: 'produit' },
  { id: 'cont-12', it: 'la consegna chiavi in mano', fr: 'la livraison clé en main', category: 'produit' },

  // ── Vocabulaire géographique Italie ───────────────────────────────────────
  { id: 'geo-01', it: 'Milano', fr: 'Milan', category: 'géographie' },
  { id: 'geo-02', it: 'Roma', fr: 'Rome', category: 'géographie' },
  { id: 'geo-03', it: 'Torino', fr: 'Turin', category: 'géographie' },
  { id: 'geo-04', it: 'Napoli', fr: 'Naples', category: 'géographie' },
  { id: 'geo-05', it: 'il nord Italia', fr: 'le nord de l\'Italie', category: 'géographie' },
  { id: 'geo-06', it: 'il cantiere', fr: 'le chantier', category: 'géographie' },
  { id: 'geo-07', it: 'il magazzino', fr: 'l\'entrepôt / le magasin', category: 'géographie' },
  { id: 'geo-08', it: 'il terreno', fr: 'le terrain', category: 'géographie' },

  // ── Qualificateurs client ─────────────────────────────────────────────────
  { id: 'qual-01', it: 'Qual è il Suo utilizzo previsto?', fr: 'Quelle est votre utilisation prévue ?', category: 'qualification' },
  { id: 'qual-02', it: 'Quando ne ha bisogno?', fr: 'Quand en avez-vous besoin ?', category: 'qualification' },
  { id: 'qual-03', it: 'Quante unità desidera?', fr: 'Combien d\'unités souhaitez-vous ?', category: 'qualification' },
  { id: 'qual-04', it: 'Ha già un luogo di installazione?', fr: 'Avez-vous déjà un lieu d\'installation ?', category: 'qualification' },
  { id: 'qual-05', it: 'Qual è la Sua scadenza?', fr: 'Quel est votre délai ?', category: 'qualification' },
  { id: 'qual-06', it: 'Chi è il responsabile della decisione?', fr: 'Qui est le décisionnaire ?', category: 'qualification' },

  // ── Expressions de politesse avancées ────────────────────────────────────
  { id: 'pol-01', it: 'Mi permetta di presentarmi.', fr: 'Permettez-moi de me présenter.', category: 'politesse' },
  { id: 'pol-02', it: 'Le disturbo un momento?', fr: 'Je vous dérange un instant ?', category: 'politesse' },
  { id: 'pol-03', it: 'Con chi ho il piacere di parlare?', fr: 'À qui ai-je le plaisir de parler ?', category: 'politesse' },
  { id: 'pol-04', it: 'La ringrazio per il Suo tempo.', fr: 'Je vous remercie de votre temps.', category: 'politesse' },
  { id: 'pol-05', it: 'Arrivederci, a presto!', fr: 'Au revoir, à bientôt !', category: 'politesse' },
  { id: 'pol-06', it: 'Buona giornata!', fr: 'Bonne journée !', category: 'politesse' },
  { id: 'pol-07', it: 'Con piacere!', fr: 'Avec plaisir !', category: 'politesse' },
  { id: 'pol-08', it: 'È un piacere lavorare con Lei.', fr: 'C\'est un plaisir de travailler avec vous.', category: 'politesse' },

  // ── Temps et délais ───────────────────────────────────────────────────────
  { id: 'dl-01', it: 'entro due settimane', fr: 'dans les deux semaines', category: 'délais' },
  { id: 'dl-02', it: 'il prima possibile', fr: 'le plus tôt possible', category: 'délais' },
  { id: 'dl-03', it: 'a partire da lunedì', fr: 'à partir de lundi', category: 'délais' },
  { id: 'dl-04', it: 'in 48 ore', fr: 'en 48 heures', category: 'délais' },
  { id: 'dl-05', it: 'entro fine anno', fr: 'avant la fin de l\'année', category: 'délais' },
  { id: 'dl-06', it: 'nei prossimi giorni', fr: 'dans les prochains jours', category: 'délais' },
  { id: 'dl-07', it: 'con urgenza', fr: 'en urgence', category: 'délais' },

  // ── Grammaire – accord / genre ────────────────────────────────────────────
  { id: 'gen-01', it: 'il preventivo (masc.)', fr: 'le devis → masculin', category: 'grammaire' },
  { id: 'gen-02', it: 'la fattura (fém.)', fr: 'la facture → féminin', category: 'grammaire' },
  { id: 'gen-03', it: 'il contratto (masc.)', fr: 'le contrat → masculin', category: 'grammaire' },
  { id: 'gen-04', it: 'la consegna (fém.)', fr: 'la livraison → féminin', category: 'grammaire' },
  { id: 'gen-05', it: 'l\'offerta (fém.)', fr: 'l\'offre → féminin', category: 'grammaire' },

  // ── Salutations ───────────────────────────────────────────────────────────
  { id: 'sal-01', it: 'Ciao!', fr: 'Salut ! / Bonjour !', phonetic: '[ˈtʃao]', category: 'salutations' },
  { id: 'sal-02', it: 'Buongiorno!', fr: 'Bonjour ! (matin/journée)', phonetic: '[bwɔnˈdʒorno]', category: 'salutations' },
  { id: 'sal-03', it: 'Buonasera!', fr: 'Bonsoir !', phonetic: '[bwɔnaˈseːra]', category: 'salutations' },
  { id: 'sal-04', it: 'Buonanotte!', fr: 'Bonne nuit !', phonetic: '[bwɔnaˈnɔtte]', category: 'salutations' },
  { id: 'sal-05', it: 'Arrivederci!', fr: 'Au revoir !', phonetic: '[arrivedˈertʃi]', category: 'salutations' },
  { id: 'sal-06', it: 'A presto!', fr: 'À bientôt !', phonetic: '[a ˈprɛsto]', category: 'salutations' },
  { id: 'sal-07', it: 'Come stai? / Come sta?', fr: 'Comment vas-tu ? / Comment allez-vous ?', category: 'salutations' },
  { id: 'sal-08', it: 'Sto bene, grazie!', fr: 'Je vais bien, merci !', phonetic: '[sto ˈbɛːne]', category: 'salutations' },
  { id: 'sal-09', it: 'Prego!', fr: 'De rien ! / Je vous en prie !', phonetic: '[ˈprɛːɡo]', category: 'salutations' },
  { id: 'sal-10', it: 'Scusi! / Scusa!', fr: 'Excusez-moi ! / Excuse-moi !', phonetic: '[ˈskuːzi]', category: 'salutations' },
  { id: 'sal-11', it: 'Per favore / Per piacere', fr: 'S\'il vous plaît', phonetic: '[per faˈvoːre]', category: 'salutations' },
  { id: 'sal-12', it: 'Grazie mille!', fr: 'Merci beaucoup !', phonetic: '[ˈɡrattsje ˈmille]', category: 'salutations' },

  // ── Couleurs ──────────────────────────────────────────────────────────────
  { id: 'col-01', it: 'rosso / rossa', fr: 'rouge', phonetic: '[ˈrɔsso]', category: 'couleurs' },
  { id: 'col-02', it: 'blu / azzurro', fr: 'bleu', phonetic: '[bluː]', category: 'couleurs' },
  { id: 'col-03', it: 'verde', fr: 'vert', phonetic: '[ˈvɛrde]', category: 'couleurs' },
  { id: 'col-04', it: 'giallo / gialla', fr: 'jaune', phonetic: '[ˈdʒallo]', category: 'couleurs' },
  { id: 'col-05', it: 'bianco / bianca', fr: 'blanc', phonetic: '[ˈbjaŋko]', category: 'couleurs' },
  { id: 'col-06', it: 'nero / nera', fr: 'noir', phonetic: '[ˈnɛːro]', category: 'couleurs' },
  { id: 'col-07', it: 'grigio / grigia', fr: 'gris', phonetic: '[ˈɡriːdʒo]', category: 'couleurs' },
  { id: 'col-08', it: 'marrone', fr: 'marron / brun', phonetic: '[marˈroːne]', category: 'couleurs' },
  { id: 'col-09', it: 'rosa', fr: 'rose', phonetic: '[ˈrɔːza]', category: 'couleurs' },
  { id: 'col-10', it: 'viola', fr: 'violet', phonetic: '[ˈvjɔːla]', category: 'couleurs' },
  { id: 'col-11', it: 'arancione', fr: 'orange', phonetic: '[aranˈtʃoːne]', category: 'couleurs' },
  { id: 'col-12', it: 'beige / color crema', fr: 'beige / crème', category: 'couleurs' },

  // ── Famille ───────────────────────────────────────────────────────────────
  { id: 'fam-01', it: 'il padre / il papà', fr: 'le père / papa', phonetic: '[ˈpadre]', category: 'famille' },
  { id: 'fam-02', it: 'la madre / la mamma', fr: 'la mère / maman', phonetic: '[ˈmadre]', category: 'famille' },
  { id: 'fam-03', it: 'il fratello', fr: 'le frère', phonetic: '[fraˈtɛllo]', category: 'famille' },
  { id: 'fam-04', it: 'la sorella', fr: 'la sœur', phonetic: '[soˈrɛlla]', category: 'famille' },
  { id: 'fam-05', it: 'il figlio / la figlia', fr: 'le fils / la fille', phonetic: '[ˈfiʎʎo]', category: 'famille' },
  { id: 'fam-06', it: 'il nonno / la nonna', fr: 'le grand-père / la grand-mère', phonetic: '[ˈnɔnno]', category: 'famille' },
  { id: 'fam-07', it: 'lo zio / la zia', fr: 'l\'oncle / la tante', phonetic: '[ˈdziːo]', category: 'famille' },
  { id: 'fam-08', it: 'il cugino / la cugina', fr: 'le cousin / la cousine', phonetic: '[kuˈdʒiːno]', category: 'famille' },
  { id: 'fam-09', it: 'il marito / la moglie', fr: 'le mari / la femme', phonetic: '[maˈriːto]', category: 'famille' },
  { id: 'fam-10', it: 'i genitori', fr: 'les parents', phonetic: '[dʒeniˈtoːri]', category: 'famille' },

  // ── Sentiments ────────────────────────────────────────────────────────────
  { id: 'sent-01', it: 'felice / contento', fr: 'heureux / content', phonetic: '[feˈliːtʃe]', category: 'sentiments' },
  { id: 'sent-02', it: 'triste', fr: 'triste', phonetic: '[ˈtriste]', category: 'sentiments' },
  { id: 'sent-03', it: 'arrabbiato', fr: 'en colère / fâché', phonetic: '[arrabˈbjaːto]', category: 'sentiments' },
  { id: 'sent-04', it: 'stanco / stanca', fr: 'fatigué', phonetic: '[ˈstaŋko]', category: 'sentiments' },
  { id: 'sent-05', it: 'preoccupato', fr: 'inquiet / préoccupé', phonetic: '[preokku\'paːto]', category: 'sentiments' },
  { id: 'sent-06', it: 'sorpreso / sorpresa', fr: 'surpris', phonetic: '[sorˈpreːzo]', category: 'sentiments' },
  { id: 'sent-07', it: 'annoiato / annoiata', fr: 'ennuyé', phonetic: '[annoˈjaːto]', category: 'sentiments' },
  { id: 'sent-08', it: 'emozionato', fr: 'ému / excité', phonetic: '[emottsjoˈnaːto]', category: 'sentiments' },
  { id: 'sent-09', it: 'nervoso / nervosa', fr: 'nerveux', phonetic: '[nerˈvoːzo]', category: 'sentiments' },
  { id: 'sent-10', it: 'tranquillo / tranquilla', fr: 'calme / tranquille', phonetic: '[traŋˈkwillo]', category: 'sentiments' },

  // ── Maison ────────────────────────────────────────────────────────────────
  { id: 'mai-01', it: 'la casa / l\'appartamento', fr: 'la maison / l\'appartement', phonetic: '[ˈkaːza]', category: 'maison' },
  { id: 'mai-02', it: 'la camera da letto', fr: 'la chambre à coucher', phonetic: '[ˈkaːmera]', category: 'maison' },
  { id: 'mai-03', it: 'il salotto / il soggiorno', fr: 'le salon / le séjour', phonetic: '[saˈlɔtto]', category: 'maison' },
  { id: 'mai-04', it: 'la cucina', fr: 'la cuisine (pièce)', phonetic: '[kuˈtʃiːna]', category: 'maison' },
  { id: 'mai-05', it: 'il bagno', fr: 'la salle de bain', phonetic: '[ˈbaɲɲo]', category: 'maison' },
  { id: 'mai-06', it: 'il balcone / la terrazza', fr: 'le balcon / la terrasse', phonetic: '[balˈkoːne]', category: 'maison' },
  { id: 'mai-07', it: 'il garage / il box', fr: 'le garage', phonetic: '[ɡaˈraːdʒ]', category: 'maison' },
  { id: 'mai-08', it: 'le scale', fr: 'les escaliers', phonetic: '[ˈskaːle]', category: 'maison' },
  { id: 'mai-09', it: 'il giardino', fr: 'le jardin', phonetic: '[dʒarˈdiːno]', category: 'maison' },
  { id: 'mai-10', it: 'il divano', fr: 'le canapé', phonetic: '[diˈvaːno]', category: 'maison' },
  { id: 'mai-11', it: 'il letto', fr: 'le lit', phonetic: '[ˈlɛtto]', category: 'maison' },
  { id: 'mai-12', it: 'il tavolo / la sedia', fr: 'la table / la chaise', phonetic: '[ˈtaːvolo]', category: 'maison' },

  // ── Cuisine (objets) ──────────────────────────────────────────────────────
  { id: 'cui-01', it: 'il frigorifero', fr: 'le réfrigérateur', phonetic: '[friɡoˈriːfero]', category: 'cuisine' },
  { id: 'cui-02', it: 'il forno / il microonde', fr: 'le four / le micro-ondes', phonetic: '[ˈforno]', category: 'cuisine' },
  { id: 'cui-03', it: 'la pentola / la padella', fr: 'la casserole / la poêle', phonetic: '[ˈpɛntola]', category: 'cuisine' },
  { id: 'cui-04', it: 'il piatto / la scodella', fr: 'l\'assiette / le bol', phonetic: '[ˈpjatto]', category: 'cuisine' },
  { id: 'cui-05', it: 'la forchetta / il coltello / il cucchiaio', fr: 'la fourchette / le couteau / la cuillère', phonetic: '[forˈkɛtta]', category: 'cuisine' },
  { id: 'cui-06', it: 'il bicchiere / la tazza', fr: 'le verre / la tasse', phonetic: '[bikˈkjɛːre]', category: 'cuisine' },
  { id: 'cui-07', it: 'la lavastoviglie', fr: 'le lave-vaisselle', phonetic: '[lavaˈstoviʎʎe]', category: 'cuisine' },
  { id: 'cui-08', it: 'il rubinetto / il lavandino', fr: 'le robinet / l\'évier', phonetic: '[rubiˈnɛtto]', category: 'cuisine' },

  // ── Aliments ──────────────────────────────────────────────────────────────
  { id: 'ali-01', it: 'il pane', fr: 'le pain', phonetic: '[ˈpaːne]', category: 'aliments' },
  { id: 'ali-02', it: 'la pasta', fr: 'les pâtes', phonetic: '[ˈpasta]', category: 'aliments' },
  { id: 'ali-03', it: 'la carne / il pollo', fr: 'la viande / le poulet', phonetic: '[ˈkarne]', category: 'aliments' },
  { id: 'ali-04', it: 'il pesce', fr: 'le poisson', phonetic: '[ˈpeʃʃe]', category: 'aliments' },
  { id: 'ali-05', it: 'il riso', fr: 'le riz', phonetic: '[ˈriːzo]', category: 'aliments' },
  { id: 'ali-06', it: 'la frutta / la verdura', fr: 'les fruits / les légumes', phonetic: '[ˈfrutta]', category: 'aliments' },
  { id: 'ali-07', it: 'il vino / la birra', fr: 'le vin / la bière', phonetic: '[ˈviːno]', category: 'aliments' },
  { id: 'ali-08', it: 'l\'acqua / il succo', fr: 'l\'eau / le jus', phonetic: '[ˈakkwa]', category: 'aliments' },
  { id: 'ali-09', it: 'il caffè / il cappuccino', fr: 'le café / le cappuccino', phonetic: '[kafˈfɛ]', category: 'aliments' },
  { id: 'ali-10', it: 'il formaggio / il prosciutto', fr: 'le fromage / le jambon', phonetic: '[forˈmaddʒo]', category: 'aliments' },

  // ── Indications / directions ──────────────────────────────────────────────
  { id: 'ind-01', it: 'a sinistra', fr: 'à gauche', phonetic: '[a siˈnistra]', category: 'indications' },
  { id: 'ind-02', it: 'a destra', fr: 'à droite', phonetic: '[a ˈdɛstra]', category: 'indications' },
  { id: 'ind-03', it: 'dritto / sempre dritto', fr: 'tout droit', phonetic: '[ˈdritto]', category: 'indications' },
  { id: 'ind-04', it: 'gira a sinistra / gira a destra', fr: 'tourne à gauche / tourne à droite', category: 'indications' },
  { id: 'ind-05', it: 'vicino / lontano', fr: 'près / loin', phonetic: '[viˈtʃiːno]', category: 'indications' },
  { id: 'ind-06', it: 'Dov\'è...?', fr: 'Où est... ?', phonetic: '[doˈvɛ]', category: 'indications' },
  { id: 'ind-07', it: 'Quant\'è lontano?', fr: 'C\'est loin ?', category: 'indications' },
  { id: 'ind-08', it: 'al semaforo / all\'incrocio', fr: 'au feu / au carrefour', category: 'indications' },

  // ── Verbes au présent ─────────────────────────────────────────────────────
  { id: 'pres-01', it: 'parlo / parli / parla', fr: 'je parle / tu parles / il parle', phonetic: '[ˈparlo]', category: 'présent' },
  { id: 'pres-02', it: 'mangio / mangi / mangia', fr: 'je mange / tu manges / il mange', phonetic: '[ˈmandʒo]', category: 'présent' },
  { id: 'pres-03', it: 'vado / vai / va', fr: 'je vais / tu vas / il va (andare)', phonetic: '[ˈvaːdo]', category: 'présent' },
  { id: 'pres-04', it: 'vengo / vieni / viene', fr: 'je viens / tu viens / il vient (venire)', phonetic: '[ˈvɛŋɡo]', category: 'présent' },
  { id: 'pres-05', it: 'faccio / fai / fa', fr: 'je fais / tu fais / il fait (fare)', phonetic: '[ˈfatʃːo]', category: 'présent' },
  { id: 'pres-06', it: 'posso / puoi / può', fr: 'je peux / tu peux / il peut (potere)', phonetic: '[ˈpɔsso]', category: 'présent' },
  { id: 'pres-07', it: 'voglio / vuoi / vuole', fr: 'je veux / tu veux / il veut (volere)', phonetic: '[ˈvɔʎʎo]', category: 'présent' },
  { id: 'pres-08', it: 'devo / devi / deve', fr: 'je dois / tu dois / il doit (dovere)', phonetic: '[ˈdɛːvo]', category: 'présent' },
  { id: 'pres-09', it: 'capisco / capisci / capisce', fr: 'je comprends / tu comprends / il comprend', phonetic: '[kaˈpiːsko]', category: 'présent' },
  { id: 'pres-10', it: 'so / sai / sa', fr: 'je sais / tu sais / il sait (sapere)', phonetic: '[sɔ]', category: 'présent' },

  // ── Présent continu ───────────────────────────────────────────────────────
  { id: 'cont-13', it: 'sto parlando', fr: 'je suis en train de parler', phonetic: '[sto parˈlando]', category: 'présent_continu' },
  { id: 'cont-14', it: 'sto mangiando', fr: 'je suis en train de manger', category: 'présent_continu' },
  { id: 'cont-15', it: 'sto studiando', fr: 'je suis en train d\'étudier', category: 'présent_continu' },
  { id: 'cont-16', it: 'sta arrivando', fr: 'il est en train d\'arriver', category: 'présent_continu' },
  { id: 'cont-17', it: 'stai dormendo?', fr: 'tu es en train de dormir ?', category: 'présent_continu' },
  { id: 'cont-18', it: 'stiamo lavorando', fr: 'nous sommes en train de travailler', category: 'présent_continu' },

  // ── Passé composé ─────────────────────────────────────────────────────────
  { id: 'pass-01', it: 'ho mangiato', fr: 'j\'ai mangé', phonetic: '[ɔ manˈdʒaːto]', category: 'passé' },
  { id: 'pass-02', it: 'ho parlato', fr: 'j\'ai parlé', category: 'passé' },
  { id: 'pass-03', it: 'sono andato / andata', fr: 'je suis allé(e)', phonetic: '[ˈsoːno anˈdaːto]', category: 'passé' },
  { id: 'pass-04', it: 'ho capito', fr: 'j\'ai compris', category: 'passé' },
  { id: 'pass-05', it: 'ho visto / ho sentito', fr: 'j\'ai vu / j\'ai entendu', category: 'passé' },
  { id: 'pass-06', it: 'siamo arrivati', fr: 'nous sommes arrivés', category: 'passé' },
  { id: 'pass-07', it: 'hai fatto / ha fatto', fr: 'tu as fait / il a fait', category: 'passé' },
  { id: 'pass-08', it: 'participio passato -ato / -ito / -uto', fr: 'participe passé : -er→-ato, -ir→-ito, -re→-uto', category: 'passé' },

  // ── Pronoms COD ───────────────────────────────────────────────────────────
  { id: 'cod-01', it: 'mi (me)', fr: 'me / m\'', phonetic: '[mi]', category: 'pronoms_cod' },
  { id: 'cod-02', it: 'ti (te)', fr: 'te / t\'', phonetic: '[ti]', category: 'pronoms_cod' },
  { id: 'cod-03', it: 'lo (lui/il)', fr: 'le / l\'', phonetic: '[lo]', category: 'pronoms_cod' },
  { id: 'cod-04', it: 'la (lei/la)', fr: 'la / l\'', phonetic: '[la]', category: 'pronoms_cod' },
  { id: 'cod-05', it: 'ci (nous)', fr: 'nous / nous', phonetic: '[tʃi]', category: 'pronoms_cod' },
  { id: 'cod-06', it: 'vi (vous)', fr: 'vous / vous', phonetic: '[vi]', category: 'pronoms_cod' },
  { id: 'cod-07', it: 'li / le (eux/elles)', fr: 'les', phonetic: '[li] / [le]', category: 'pronoms_cod' },
  { id: 'cod-08', it: 'Lo conosco.', fr: 'Je le connais.', category: 'pronoms_cod' },
  { id: 'cod-09', it: 'La chiamo domani.', fr: 'Je l\'appelle demain. (aussi "je vous appelle")', category: 'pronoms_cod' },

  // ── Prononciation ─────────────────────────────────────────────────────────
  { id: 'prn-01', it: 'gli → son [ʎ]', fr: 'gli = son mouillé "y" (figlio, famiglia)', phonetic: '[ʎʎi]', category: 'prononciation' },
  { id: 'prn-02', it: 'gn → son [ɲ]', fr: 'gn = son "gn" espagnol (gnocchi, bagno)', phonetic: '[ɲ]', category: 'prononciation' },
  { id: 'prn-03', it: 'ci / ce → [tʃ]', fr: 'ci/ce = "tchi" (ciao, cento)', phonetic: '[tʃ]', category: 'prononciation' },
  { id: 'prn-04', it: 'chi / che → [k]', fr: 'chi/che = "k" dur (chiesa, che)', phonetic: '[k]', category: 'prononciation' },
  { id: 'prn-05', it: 'sci / sce → [ʃ]', fr: 'sci/sce = "ch" français (scena, scimmia)', phonetic: '[ʃ]', category: 'prononciation' },
  { id: 'prn-06', it: 'gi / ge → [dʒ]', fr: 'gi/ge = "dj" (gelato, giorno)', phonetic: '[dʒ]', category: 'prononciation' },
  { id: 'prn-07', it: 'doppia consonante', fr: 'double consonne : pause plus longue (palla ≠ pala)', category: 'prononciation' },
  { id: 'prn-08', it: 'z → [ts] ou [dz]', fr: 'z = "ts" (pizza) ou "dz" (zero)', phonetic: '[ts] / [dz]', category: 'prononciation' },

  // ── Expressions temporelles ───────────────────────────────────────────────
  { id: 'tmp-01', it: 'oggi', fr: 'aujourd\'hui', phonetic: '[ˈɔddʒi]', category: 'temps' },
  { id: 'tmp-02', it: 'ieri', fr: 'hier', phonetic: '[ˈjɛːri]', category: 'temps' },
  { id: 'tmp-03', it: 'domani', fr: 'demain', phonetic: '[doˈmaːni]', category: 'temps' },
  { id: 'tmp-04', it: 'adesso / ora', fr: 'maintenant', phonetic: '[aˈdɛsso]', category: 'temps' },
  { id: 'tmp-05', it: 'presto / tardi', fr: 'tôt / tard', phonetic: '[ˈprɛsto] / [ˈtardi]', category: 'temps' },
  { id: 'tmp-06', it: 'questa settimana / questo mese', fr: 'cette semaine / ce mois-ci', category: 'temps' },
  { id: 'tmp-07', it: 'la settimana scorsa / prossima', fr: 'la semaine dernière / prochaine', category: 'temps' },
  { id: 'tmp-08', it: 'sempre / spesso / mai', fr: 'toujours / souvent / jamais', phonetic: '[ˈsɛmpre]', category: 'temps' },

  // ── Questions courantes ───────────────────────────────────────────────────
  { id: 'qst-01', it: 'Chi?', fr: 'Qui ?', phonetic: '[ki]', category: 'questions' },
  { id: 'qst-02', it: 'Cosa? / Che cosa?', fr: 'Quoi ? / Que ?', phonetic: '[ˈkɔːza]', category: 'questions' },
  { id: 'qst-03', it: 'Dove?', fr: 'Où ?', phonetic: '[ˈdoːve]', category: 'questions' },
  { id: 'qst-04', it: 'Quando?', fr: 'Quand ?', phonetic: '[ˈkwando]', category: 'questions' },
  { id: 'qst-05', it: 'Come?', fr: 'Comment ?', phonetic: '[ˈkoːme]', category: 'questions' },
  { id: 'qst-06', it: 'Perché?', fr: 'Pourquoi ?', phonetic: '[perˈke]', category: 'questions' },
  { id: 'qst-07', it: 'Quanto costa?', fr: 'Combien ça coûte ?', phonetic: '[ˈkwanto ˈkɔsta]', category: 'questions' },
  { id: 'qst-08', it: 'Quanti / Quante?', fr: 'Combien (de) ?', category: 'questions' },

  // ── Alphabet / lettres ────────────────────────────────────────────────────
  { id: 'alp-01', it: 'A come Ancona', fr: 'A comme Ancône (alphabet téléphonique IT)', category: 'alphabet' },
  { id: 'alp-02', it: 'le vocali italiane', fr: 'les voyelles : A, E, I, O, U', category: 'alphabet' },
  { id: 'alp-03', it: 'lettere straniere: J, K, W, X, Y', fr: 'lettres étrangères (non native en italien)', category: 'alphabet' },
  { id: 'alp-04', it: 'accento acuto/grave (é / è)', fr: 'accent aigu/grave : é (fermé) / è (ouvert)', category: 'alphabet' },
  { id: 'alp-05', it: 'Si scrive... / Si pronuncia...', fr: 'Ça s\'écrit... / Ça se prononce...', category: 'alphabet' },
  { id: 'alp-06', it: 'Come si scrive il Suo nome?', fr: 'Comment s\'écrit votre nom ?', category: 'alphabet' },

  // ── Films et livres ───────────────────────────────────────────────────────
  { id: 'fil-01', it: 'il film / il cinema', fr: 'le film / le cinéma', phonetic: '[ˈfilm]', category: 'films_livres' },
  { id: 'fil-02', it: 'il libro / romanzo', fr: 'le livre / le roman', phonetic: '[ˈliːbro]', category: 'films_livres' },
  { id: 'fil-03', it: 'il regista / l\'attore', fr: 'le réalisateur / l\'acteur', phonetic: '[reˈdʒista]', category: 'films_livres' },
  { id: 'fil-04', it: 'il sottotitolo', fr: 'le sous-titre', category: 'films_livres' },
  { id: 'fil-05', it: 'Mi è piaciuto molto.', fr: 'J\'ai beaucoup aimé.', category: 'films_livres' },
  { id: 'fil-06', it: 'Hai visto...? / Hai letto...?', fr: 'Tu as vu... ? / Tu as lu... ?', category: 'films_livres' },

  // ── Expressions avancées ──────────────────────────────────────────────────
  { id: 'adv-01', it: 'Nonostante + sgt.', fr: 'Malgré / Bien que', phonetic: '[nonoˈstante]', category: 'expressions_adv' },
  { id: 'adv-02', it: 'Tuttavia / Eppure', fr: 'Cependant / Pourtant', phonetic: '[tutˈtaːvja]', category: 'expressions_adv' },
  { id: 'adv-03', it: 'Inoltre / In più', fr: 'De plus / En outre', phonetic: '[iˈnoltre]', category: 'expressions_adv' },
  { id: 'adv-04', it: 'Quindi / Perciò', fr: 'Donc / C\'est pourquoi', phonetic: '[ˈkwindi]', category: 'expressions_adv' },
  { id: 'adv-05', it: 'A proposito', fr: 'À propos', phonetic: '[a proˈpoːzito]', category: 'expressions_adv' },
  { id: 'adv-06', it: 'In realtà / Effettivamente', fr: 'En réalité / Effectivement', category: 'expressions_adv' },
];

/**
 * Returns the full quiz bank, randomised.
 * Async to allow future remote loading (AI-generated questions, etc.).
 */
export async function getAllQuizItems(): Promise<QuizBankItem[]> {
  return shuffle([...BANK]);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
