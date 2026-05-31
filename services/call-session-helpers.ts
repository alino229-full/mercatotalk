import type { CorrectionRow } from '@/database/italpro-local-db';
import type { GuidedReplyChoice } from '@/services/guided-choices-ai-client';

export const CALL_PHASES = ['Accroche', 'Qualification', 'Objection', 'Closing'] as const;

type HintSet = { best: string; approx: string; wrong: [string, string] };

const HINT_SETS: Record<string, HintSet> = {
  identification: {
    best: 'Buongiorno, sono Pierre di MercatoTalk. Ci occupiamo di soluzioni container modulari per il settore edile e logistico.',
    approx: 'Sono un commerciale. Le volevo presentare la nostra offerta.',
    wrong: ['La consegna è prevista entro 48 ore dalla conferma dell\'ordine.', 'Posso offrire uno sconto del 5% per ordini multipli.'],
  },
  cold_open: {
    best: 'Buongiorno, sono Pierre di MercatoTalk. Le disturbo un momento? Volevamo presentarLe le nostre soluzioni container.',
    approx: 'Pronto. Chiamo da MercatoTalk per presentarLe la nostra gamma.',
    wrong: ['Il pagamento è a 30 giorni dalla data di fattura.', 'Abbiamo la certificazione IICL su tutti i container.'],
  },
  price: {
    best: 'Per un 20 piedi standard siamo intorno ai 2.500 euro. Il prezzo include il trasporto. Posso inviarLe un preventivo personalizzato oggi stesso?',
    approx: 'Il prezzo dipende dal modello e dalle opzioni scelte. È molto competitivo.',
    wrong: ['La consegna avviene entro 48 ore se il prodotto è in stock.', 'Abbiamo oltre 200 clienti soddisfatti in Italia.'],
  },
  delivery: {
    best: 'Se il container è in stock, la consegna è entro 48 ore. Quando ne avrebbe bisogno esattamente e qual è la Sua zona?',
    approx: 'I tempi di consegna variano in base alla disponibilità e alla distanza.',
    wrong: ['Il prezzo base è di 2.100 euro per un 20 piedi usato grade A.', 'Le garanzie coprono 12 mesi dall\'installazione.'],
  },
  quality: {
    best: 'I nostri container sono certificati IICL e forniti con rapporto di ispezione fotografico. Posso inviarLe la documentazione tecnica?',
    approx: 'La qualità è garantita. Tutti i container vengono ispezionati prima della consegna.',
    wrong: ['Il prezzo include il trasporto fino a 200 km.', 'La consegna avviene entro 48 ore in tutta Italia.'],
  },
  comfort_trust: {
    best: 'Capisco il Suo dubbio. I moduli da 20 piedi sono isolati, ventilati e collaudati prima della consegna. Posso inviarLe foto reali, scheda tecnica e referenze clienti?',
    approx: 'Sì, possono essere comodi e affidabili se sono ben isolati e controllati. Le mando la documentazione tecnica.',
    wrong: ['Il pagamento si effettua con acconto del 30% e saldo alla consegna.', 'Il container da 40 piedi costa di più ma offre più spazio interno.'],
  },
  winter_comfort: {
    best: "Sì, resta caldo se l'isolamento è dimensionato correttamente. Le mando la scheda tecnica dei materiali, foto di moduli già installati e, se vuole, organizziamo una visita o videochiamata.",
    approx: "Sì, con un buon isolamento il container può restare confortevole anche in inverno. Le invio qualche foto reale.",
    wrong: ['Possiamo consegnarlo in 48 ore se il trasportatore è disponibile.', 'Il colore RAL può essere verde, grigio o bianco secondo il Suo gusto.'],
  },
  availability: {
    best: 'Sì, abbiamo unità disponibili in stock. Quale dimensione cerca — 20 o 40 piedi — e per quale utilizzo?',
    approx: 'Dipende dal modello. Può dirmi di cosa ha bisogno esattamente?',
    wrong: ['Il pagamento si effettua a 30 giorni dalla data di fattura.', 'Offriamo uno sconto del 5% per pagamento anticipato.'],
  },
  competitor: {
    best: 'Capisco che stia confrontando le offerte. Cosa è prioritario per Lei: il prezzo, la qualità o la rapidità di consegna?',
    approx: 'Siamo competitivi. Posso mostrarLe i nostri punti di forza rispetto al mercato.',
    wrong: ['La certificazione ATP è inclusa nel prezzo del container frigorifero.', 'L\'installazione avviene su plots réglables o su base in cemento.'],
  },
  trust: {
    best: 'Comprendo la Sua cautela. Siamo operativi dal 2009. Posso fornirLe il nostro numero SIRET, referenze clienti e organizzare un\'ispezione prima di qualsiasi pagamento.',
    approx: 'Siamo un\'azienda seria con garanzie contrattuali su ogni ordine.',
    wrong: ['Il prezzo per un 40 piedi nuovo è di 6.200 euro.', 'La consegna in tutta Italia avviene in 48-72 ore.'],
  },
  discount: {
    best: 'Possiamo valutare uno sconto del 5% per pagamento anticipato o per ordini da 2 unità o più. Cosa si adatta meglio alla Sua situazione?',
    approx: 'La nostra offerta è già molto vantaggiosa. Vediamo cosa possiamo fare.',
    wrong: ['La consegna è inclusa per distanze fino a 200 km.', 'Il container è certificato IICL con rapporto di ispezione.'],
  },
  regulation: {
    best: 'Per un\'installazione temporanea fino a 3 anni basta la CILA asseverata; oltre i 3 anni serve il permesso di costruire. Si tratta di un uso temporaneo o permanente?',
    approx: 'Dipende dall\'uso e dalla durata. Le invio una scheda riepilogativa sulle normative italiane.',
    wrong: ['Il sistema di filtraggio ha una portata di 8 m³/h.', 'Il container frigorifero funziona con un attacco da 32 ampere.'],
  },
  installation: {
    best: 'L\'installazione avviene su plots réglables in acciaio zincato o su una soletta in cemento da 15 cm. I raccordi elettrici e idrici sono a cura del cliente. Vuole un preventivo chiavi in mano?',
    approx: 'Forniamo tutta la documentazione tecnica. Il posizionamento richiede 2-3 ore.',
    wrong: ['Il prezzo per un 20 piedi usato grade A è di 2.100 euro.', 'Offriamo uno sconto del 5% per ordini multipli.'],
  },
  technical: {
    best: 'Le invio la scheda tecnica completa. Per il 20 piedi: 5,90 x 2,35 x 2,39 m interni, carico utile 28 t. Quale modello La interessa di più?',
    approx: 'Dipende dal modello. Abbiamo 20 e 40 piedi con varie configurazioni. Quale si adatta al Suo uso?',
    wrong: ['Il preventivo è valido per 30 giorni dalla data di emissione.', 'Offriamo il pagamento a 30% all\'ordine e 70% alla consegna.'],
  },
  mobile: {
    best: 'Sì, abbiamo container su rimorchio omologato: il 20 piedi pesa meno di 3,5 t, quindi basta la patente B. Il dispiegamento richiede circa 30 minuti. Vuole sapere di più sull\'allestimento?',
    approx: 'Abbiamo soluzioni mobili su rimorchio. Dipende dal peso e dall\'uso previsto.',
    wrong: ['Il container frigorifero mantiene la temperatura tra -25°C e +10°C.', 'La CILA asseverata è sufficiente per installazioni fino a 3 anni.'],
  },
  objection_price: {
    best: 'Capisco. Il prezzo include garanzia, inspection e trasporto. Possiamo però scaglionare il pagamento in due rate. Cosa sarebbe più utile per Lei?',
    approx: 'È un investimento che si ammortizza rapidamente. Posso mostrarLe il calcolo.',
    wrong: ['La consegna è inclusa per distanze fino a 200 km.', 'Siamo certificati ISO 9001 per tutti i processi produttivi.'],
  },
  closing: {
    best: 'Ottimo! Posso inviarLe il contratto e il preventivo definitivo oggi stesso. Ha un indirizzo email a cui mandarli?',
    approx: 'Perfetto. Quando potremmo procedere alla firma? Le mando tutto per email.',
    wrong: ['La nostra azienda è specializzata nei settori edile e logistico dal 2009.', 'Offriamo anche container refrigerati e container piscina su misura.'],
  },
  generic: {
    best: 'Ho capito la Sua richiesta. Posso spiegarLe meglio il prodotto e le condizioni di fornitura. Cosa vuole sapere esattamente?',
    approx: 'Certo, Le rispondo subito. Può darmi qualche dettaglio in più?',
    wrong: ['Il container è disponibile nei colori verde, grigio o bianco RAL.', 'Abbiamo punti di consegna in tutta Italia con tempi ridotti.'],
  },
};

const PHASE_INTRO_HINTS: Record<typeof CALL_PHASES[number], HintSet> = {
  Accroche: {
    best: 'Buongiorno, sono Pierre di MercatoTalk. Le disturbo un momento? Volevamo presentarLe le nostre soluzioni modulari.',
    approx: 'Pronto, sono Pierre. Chiamo da MercatoTalk per un\'offerta.',
    wrong: ['La consegna è prevista entro 48 ore.', 'Il prezzo base è di 2.100 euro per un container usato.'],
  },
  Qualification: {
    best: 'Cosa cerca esattamente per il Suo progetto? E\' Lei il responsabile degli acquisti?',
    approx: 'Di cosa ha bisogno? Abbiamo diverse soluzioni container.',
    wrong: ['Offriamo uno sconto del 5% per pagamento anticipato.', 'La certificazione IICL è inclusa su tutti i prodotti.'],
  },
  Objection: {
    best: 'Capisco la Sua preoccupazione. Posso spiegarLe perché il nostro prezzo è giustificato rispetto alla qualità offerta?',
    approx: 'Possiamo trovare una soluzione che si adatta al Suo budget.',
    wrong: ['La consegna avviene entro 48 ore in tutta Italia.', 'Abbiamo clienti soddisfatti da Nord a Sud.'],
  },
  Closing: {
    best: 'Posso inviarLe il preventivo definitivo oggi stesso. Ha un indirizzo email?',
    approx: 'Quando possiamo procedere? Le mando tutto per email.',
    wrong: ['Il container è disponibile in verde, grigio o bianco.', 'Siamo operativi dal 2009 con oltre 200 clienti in Italia.'],
  },
};

export function classifyClientMessage(contentIt: string, contentFr: string): string {
  const text = `${contentIt} ${contentFr}`.toLowerCase();

  if (/chi (è|sei|parla)|non (la|ti) conosco|chi siete|che azienda/.test(text)) return 'identification';
  if (/pronto\?|chi è\?|cosa vuole|non (la|ti) (conosco|conosc)/.test(text)) return 'cold_open';
  if (/(inverno|freddo|caldo|resta caldo|riscald|bello solo in foto|sembra bello solo in foto|hiver|chaud|froid)/.test(text)) return 'winter_comfort';
  if (/(comod|confort|confortable|comfortable).*(affidabil|fiable|fiducia|garanzi)|(?:affidabil|fiable|fiducia|garanzi).*(comod|confort|confortable|comfortable)/.test(text)) return 'comfort_trust';
  if (/truffat|arnaque|truffe|garanzie serie|fidarsi|sicuro che non|come faccio a sapere|affidabil|fiable/.test(text)) return 'trust';
  if (/(quanto|costo|prezzo|budget|spend|cher|prix|coût|euro|cost)/.test(text)) {
    if (/(trop.*cher|troppo.*car|non posso|eccede|non ho|beyond|dépasse)/.test(text)) return 'objection_price';
    return 'price';
  }
  if (/(sconto|remise|riduzion|rabais|abbass|réduct|discount)/.test(text)) return 'discount';
  if (/(consegna|quando.*arriv|livraison|tempi|délai|quando.*avr|entro quando)/.test(text)) return 'delivery';
  if (/(certif|garanzi|qualit|norme|haccp|atp|iicl|standard|conform)/.test(text)) return 'quality';
  if (/(disponibil|avete|stock|l'avete|ce l'avez|en stock)/.test(text)) return 'availability';
  if (/(concorrent|altro.*fornitore|confronto|concurrent|altri prezzi|compare)/.test(text)) return 'competitor';
  if (/(permesso|autorizzazione|cila|permis|bureaucrazia|réglementation|costruire)/.test(text)) return 'regulation';
  if (/(installaz|fondament|raccordo|installation|fondation|montage|pose)/.test(text)) return 'installation';
  if (/(filtraz|corrente|pompa|kw|tecnico|scheda tecnica|specifiche|technique|dimension)/.test(text)) return 'technical';
  if (/(rimorchio|remorque|mobile|itinerant|spostare|deplacer|patente|permis.*conduire)/.test(text)) return 'mobile';
  if (/(d'accordo|capito|bene.*proceed|andiamo avanti|procediamo|firmar|accord|décider)/.test(text)) return 'closing';
  return 'generic';
}

function buildHintOptions(set: HintSet, type: string): GuidedReplyChoice[] {
  const options: GuidedReplyChoice[] = [
    { id: `${type}-best`, text: set.best, quality: 'best' },
    { id: `${type}-approx`, text: set.approx, quality: 'approx' },
    { id: `${type}-wrong-1`, text: set.wrong[0], quality: 'wrong' },
    { id: `${type}-wrong-2`, text: set.wrong[1], quality: 'wrong' },
  ];

  for (let index = options.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = options[index]!;
    options[index] = options[swapIndex]!;
    options[swapIndex] = current;
  }

  return options;
}

export function getContextualHints(
  latestClientMsg: { contentIt: string; contentFr: string } | undefined,
  phaseIndex: number,
): GuidedReplyChoice[] {
  if (!latestClientMsg) {
    const phase = CALL_PHASES[phaseIndex] ?? CALL_PHASES[0];
    return buildHintOptions(PHASE_INTRO_HINTS[phase], `phase-${phase}`);
  }

  const type = classifyClientMessage(latestClientMsg.contentIt, latestClientMsg.contentFr);
  const set = HINT_SETS[type] ?? HINT_SETS.generic;
  return buildHintOptions(set, type);
}

export function buildCallReport(corrections: CorrectionRow[]) {
  const averageScore =
    corrections.length > 0
      ? Math.round(corrections.reduce((sum, correction) => sum + correction.score, 0) / corrections.length)
      : null;
  const focusCounts = new Map<string, number>();

  for (const correction of corrections) {
    for (const focus of correction.nextFocus) {
      focusCounts.set(focus, (focusCounts.get(focus) ?? 0) + 1);
    }
  }

  return {
    averageScore,
    recurringErrors: [...focusCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label]) => label),
    bestTurns: corrections
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 3),
  };
}
