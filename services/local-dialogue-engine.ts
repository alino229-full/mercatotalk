import type { DialogueMessageRow, ScenarioRow } from '@/database/italpro-local-db';
import type { B2BMood } from '@/data/b2b-operational';

export type LocalCorrection = {
  score: number;
  correctedIt: string;
  feedbackFr: string;
  nextFocus: string[];
  /** Granular breakdown of the score (0–100 each) */
  breakdown: {
    grammaire: number;
    vocabulaire: number;
    politesse: number;
  };
};

export type LocalClientReply = {
  contentIt: string;
  contentFr: string;
  coachingNote: string;
};

export type GuidedChoiceQuality = 'best' | 'approx' | 'wrong';

// ─── Markers ─────────────────────────────────────────────────────────────────

const politeMarkers = ['lei', 'le', 'la', 'vorrebbe', 'posso', 'possiamo', 'desidera'];
const reassuranceMarkers = [
  'garanzia', 'certificato', 'isolamento', 'sicuro', 'affidabile', 'assistenza', 'collaudo',
  'referenze', 'siret', 'ispezione', 'contratto', 'pagamento sicuro',
];
const qualificationMarkers = [
  'dove', 'quando', 'budget', 'uso', 'terreno', 'permesso', 'quante', 'necessita',
];

// Vocabulary markers: B2B terms that show professional command
const vocabMarkers = [
  'preventivo', 'proposta', 'consegna', 'contratto', 'fattura', 'sconto',
  'offerta', 'pagamento', 'fornitore', 'garanzia', 'certamente', 'capisco',
  'comprendere', 'spiegare', 'dettaglio', 'disponibile',
];

// Grammar indicators: correct conjugation patterns for formal Italian
const grammarIndicators = [
  /\b(sono|siamo|e'|ha|ho|vorrei|potrei|posso|possiamo|devo|dobbiamo)\b/i,
  /\b(la|le|la\s+informo|la\s+assicuro|le\s+spiego|le\s+propongo)\b/i,
  /\bgrazie\b/i,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

function capitalizeSentence(value: string): string {
  const trimmed = value.trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : trimmed;
}

function hasClientAsked(history: DialogueMessageRow[], pattern: RegExp): boolean {
  return history.some((message) => message.role === 'client' && pattern.test(message.contentIt.toLowerCase()));
}

function hasLearnerAddressedTrust(text: string): boolean {
  return /garanzi|referenz|siret|ispezion|contratt|pagamento\s+sicuro|affidabil|certificat/i.test(text);
}

function hasLearnerClosingIntent(text: string): boolean {
  return /contratto|preventivo definitivo|email|indirizzo email|procediamo|firma|richiam|appuntamento|riepilogo/i.test(text);
}

function hasLearnerAddressedComfort(text: string): boolean {
  return /isolament|isolat|ventilat|collaud|material|caldo|inverno|foto real|scheda tecnica/i.test(text);
}

// ─── Granular Correction Engine ───────────────────────────────────────────────

/**
 * Evaluates a learner's reply on three independent axes:
 * - Grammaire: verb conjugation + sentence structure indicators
 * - Vocabulaire: professional B2B vocabulary density
 * - Politesse: correct use of Italian formal register (Lei)
 *
 * The final score is a weighted average:  Grammar 35%, Vocab 35%, Politesse 30%
 */
export function buildLocalCorrection(reply: string): LocalCorrection {
  const normalized = reply.toLowerCase();
  const words = normalized.split(/\s+/);
  const nextFocus: string[] = [];

  // ── Grammaire (0–100) ────────────────────────────────────────────────────
  let grammaire = 42; // base

  if (reply.trim().length > 40) grammaire += 12; // reasonable length
  if (reply.trim().length > 80) grammaire += 8;  // elaborate answer
  const grammarHits = countMatches(normalized, grammarIndicators);
  grammaire += grammarHits * 10;
  if (normalized.includes('?')) grammaire += 8; // question mark shows structure
  grammaire = Math.min(grammaire, 100);

  // ── Vocabulaire (0–100) ──────────────────────────────────────────────────
  let vocabulaire = 40; // base
  const vocabHits = vocabMarkers.filter((w) => normalized.includes(w)).length;
  vocabulaire += vocabHits * 12;
  if (hasAny(normalized, reassuranceMarkers)) vocabulaire += 14;
  if (normalized.includes('20 piedi') || normalized.includes('container')) vocabulaire += 8;
  vocabulaire = Math.min(vocabulaire, 100);

  // ── Politesse / Registre (0–100) ─────────────────────────────────────────
  let politesse = 38; // base
  const politeHits = politeMarkers.filter((w) => normalized.includes(w)).length;
  politesse += politeHits * 14;
  if (/\b(buongiorno|salve|certamente|capisco)\b/i.test(normalized)) politesse += 10;
  politesse = Math.min(politesse, 100);

  // ── Next Focus ────────────────────────────────────────────────────────────
  if (!hasAny(normalized, politeMarkers)) {
    nextFocus.push('Utiliser Lei/Le pour maintenir le registre professionnel formel.');
  }
  if (!hasAny(normalized, qualificationMarkers) && !normalized.includes('?')) {
    nextFocus.push('Poser une question de qualification avant de présenter l\'offre.');
  }
  if (!hasAny(normalized, reassuranceMarkers)) {
    nextFocus.push('Ajouter une preuve rassurante : garantie, isolation, assistance ou contrôle qualité.');
  }
  if (words.length < 8) {
    nextFocus.push('Étoffer la réponse : au téléphone, une phrase courte manque de conviction.');
  }

  // ── Final weighted score ──────────────────────────────────────────────────
  const score = Math.min(
    Math.round(grammaire * 0.35 + vocabulaire * 0.35 + politesse * 0.30),
    96,
  );

  const correctedIt = normalizeCommercialItalian(reply);

  const levelLabel =
    score >= 80 ? 'Excellente réponse commerciale.' :
    score >= 65 ? 'Bonne base, à affiner sur le registre formel.' :
    'Réponse exploitable, mais le ton et le vocabulaire B2B doivent progresser.';

  const feedbackFr =
    nextFocus.length === 0
      ? 'Ton professionnel, rassurant et orienté prochaine étape. Très bien !'
      : `${levelLabel} Points à améliorer : ${nextFocus.join(' ')}`;

  return {
    score,
    correctedIt,
    feedbackFr,
    nextFocus: nextFocus.length > 0 ? nextFocus : ['Conserver ce niveau et raccourcir légèrement la phrase au téléphone.'],
    breakdown: { grammaire, vocabulaire, politesse },
  };
}

// ─── Mood-specific reply banks ────────────────────────────────────────────────

type MoodReply = { contentIt: string; contentFr: string; coachingNote: string };

const MOOD_CLOSING: Record<string, MoodReply> = {
  mefiant: {
    contentIt: 'Va bene. Ma prima di decidere voglio vedere tutto per iscritto: prezzo, tempi e garanzie. Poi valutiamo.',
    contentFr: 'D\'accord. Mais avant de décider je veux tout par écrit : prix, délais et garanties. Ensuite on évalue.',
    coachingNote: 'Le client méfiant accepte, mais exige tout par écrit. Envoie un récapitulatif complet avec preuves.',
  },
  presse: {
    contentIt: 'Ok, veloce. Mi mandi tutto via email entro oggi, decido domani mattina.',
    contentFr: 'Ok, vite. Envoyez-moi tout par email aujourd\'hui, je décide demain matin.',
    coachingNote: 'Le client pressé veut une décision rapide. Email concis aujourd\'hui, relance demain.',
  },
  cordial: {
    contentIt: 'Perfetto, mi ha convinto. Mi mandi pure il riepilogo e procediamo con calma.',
    contentFr: 'Parfait, vous m\'avez convaincu. Envoyez-moi le récapitulatif et on avance tranquillement.',
    coachingNote: 'Le client cordial est convaincu. Conclure avec un email chaleureux et une prochaine étape claire.',
  },
  irrite: {
    contentIt: 'Finalmente qualcosa di chiaro. Mi mandi il preventivo scritto, senza sorprese.',
    contentFr: 'Enfin quelque chose de clair. Envoyez-moi le devis écrit, sans surprises.',
    coachingNote: 'Le client irrité apprécie la clarté. Devis précis, sans fioritures ni ventes additionnelles.',
  },
  professionnel: {
    contentIt: 'Bene. Le invio le specifiche tecniche richieste. Mi mandi un\'offerta dettagliata entro domani.',
    contentFr: 'Bien. Je vous envoie les spécifications demandées. Envoyez-moi une offre détaillée avant demain.',
    coachingNote: 'Le client professionnel demande une offre structurée. Réponds avec des données précises et un délai ferme.',
  },
};

const MOOD_EARLY: Record<string, MoodReply> = {
  mefiant: {
    contentIt: 'Prima di andare avanti: avete referenze verificabili? Non compro da aziende che non conosco.',
    contentFr: 'Avant d\'aller plus loin : avez-vous des références vérifiables ? Je n\'achète pas à des entreprises que je ne connais pas.',
    coachingNote: 'Client méfiant dès le début. Donne une référence concrète, un numéro SIRET ou une inspection avant toute chose.',
  },
  presse: {
    contentIt: 'Mi scusi, ho poco tempo. Prezzo, tempi di consegna, cosa è incluso. Tre punti, vai.',
    contentFr: 'Excusez-moi, peu de temps. Prix, délai de livraison, ce qui est inclus. Trois points, allez-y.',
    coachingNote: 'Réponds en 3 points maximum, sans introduction. Le client pressé n\'écoute pas les préambules.',
  },
  cordial: {
    contentIt: 'Buongiorno! Mi fa piacere. Senta, ho sentito parlare bene di voi. Mi spieghi un po\' cosa offrite.',
    contentFr: 'Bonjour ! Avec plaisir. Dites-moi, j\'ai entendu parler de vous en bien. Expliquez-moi un peu ce que vous proposez.',
    coachingNote: 'Client cordial et ouvert. Commence par une question de qualification pour cibler son besoin.',
  },
  irrite: {
    contentIt: 'Guardi, ho già perso tempo con altri fornitori. Se non è chiaro e veloce, chiudiamo subito.',
    contentFr: 'Écoutez, j\'ai déjà perdu du temps avec d\'autres fournisseurs. Si ce n\'est pas clair et rapide, on s\'arrête là.',
    coachingNote: 'Client irrité : ton direct, pas d\'intro. Donne une réponse courte, précise, sans jargon.',
  },
  professionnel: {
    contentIt: 'Buongiorno. Mi dica subito: qual è la vostra gamma, i prezzi indicativi e i tempi medi di consegna?',
    contentFr: 'Bonjour. Dites-moi directement : quelle est votre gamme, les prix indicatifs et les délais moyens de livraison ?',
    coachingNote: 'Client professionnel : il veut des données dès le début. Réponds avec des chiffres précis.',
  },
};

const MOOD_MID: Record<string, MoodReply[]> = {
  mefiant: [
    {
      contentIt: 'Ho capito, ma come posso verificare quello che mi dice? Potrebbe essere solo marketing.',
      contentFr: 'Je comprends, mais comment vérifier ce que vous me dites ? Ça pourrait n\'être que du marketing.',
      coachingNote: 'Propose une preuve concrète : documentation technique, inspection, visite ou référence client contactable.',
    },
    {
      contentIt: 'E se ho un problema dopo la consegna, chi mi aiuta? Non voglio restare solo.',
      contentFr: 'Et si j\'ai un problème après la livraison, qui m\'aide ? Je ne veux pas me retrouver seul.',
      coachingNote: 'Rassure sur le SAV : contrat, délai de réponse, interlocuteur dédié.',
    },
    {
      contentIt: 'Avete testimonianze scritte di clienti soddisfatti? Qualcosa che posso leggere o contattare?',
      contentFr: 'Avez-vous des témoignages écrits de clients satisfaits ? Quelque chose que je peux lire ou contacter ?',
      coachingNote: 'Propose des références vérifiables : email client, avis, ou visite d\'un chantier existant.',
    },
  ],
  presse: [
    {
      contentIt: 'Sì sì, ma il prezzo esatto? Non voglio una forbice, voglio un numero.',
      contentFr: 'Oui oui, mais le prix exact ? Je ne veux pas une fourchette, je veux un chiffre.',
      coachingNote: 'Le pressé veut un chiffre précis, pas une fourchette. Donne le prix de base + conditions claires.',
    },
    {
      contentIt: 'Va bene. Quanto tempo per avere il preventivo definitivo? Ore, non giorni.',
      contentFr: 'D\'accord. Combien de temps pour avoir le devis définitif ? En heures, pas en jours.',
      coachingNote: 'Engage sur un délai précis en heures. S\'il faut vérifier, dis "je vous rappelle dans 2h".',
    },
    {
      contentIt: 'Ok. Mandi tutto per email, decido da solo. Non ho tempo per un\'altra chiamata.',
      contentFr: 'Ok. Envoyez tout par email, je décide seul. Je n\'ai pas le temps pour un autre appel.',
      coachingNote: 'Clôture en proposant un email de synthèse immédiat avec tous les éléments de décision.',
    },
  ],
  cordial: [
    {
      contentIt: 'Interessante! E come si comporta il container d\'estate? Non ho mai visto un modulo abitabile dal vivo.',
      contentFr: 'Intéressant ! Et comment se comporte le container en été ? Je n\'ai jamais vu un module habitable en vrai.',
      coachingNote: 'Le cordial est curieux et ouvert. Propose une visite ou des photos/vidéos réelles.',
    },
    {
      contentIt: 'Bello! E avete esempi di clienti come me, privati o piccole aziende?',
      contentFr: 'Super ! Et avez-vous des exemples de clients comme moi, particuliers ou petites entreprises ?',
      coachingNote: 'Donne des exemples proches de son profil. Le cordial aime se projeter dans des cas concrets.',
    },
    {
      contentIt: 'Capisco. E il servizio post-vendita? Siete disponibili anche dopo la firma?',
      contentFr: 'Je vois. Et le service après-vente ? Vous êtes disponibles même après la signature ?',
      coachingNote: 'Le cordial veut une relation durable. Mets en avant le suivi, l\'interlocuteur dédié.',
    },
  ],
  irrite: [
    {
      contentIt: 'Ho già sentito queste promesse. Il mio ultimo fornitore mi ha lasciato con un container difettoso. Come mi garantisce che non succede?',
      contentFr: 'J\'ai déjà entendu ces promesses. Mon dernier fournisseur m\'a laissé avec un container défectueux. Comment vous garantissez que ça n\'arrive pas ?',
      coachingNote: 'Reconnais l\'expérience négative sans défendre le concurrent. Propose une garantie contractuelle précise.',
    },
    {
      contentIt: 'Non mi interessa il discorso commerciale. Mi dica cosa succede se la consegna è in ritardo.',
      contentFr: 'Je ne m\'intéresse pas au discours commercial. Dites-moi ce qui se passe si la livraison est en retard.',
      coachingNote: 'Réponds clairement sur les pénalités de retard ou la politique de compensation. Sois honnête.',
    },
    {
      contentIt: 'Bene, ma voglio tutto nel contratto. Niente accordi verbali.',
      contentFr: 'Bien, mais je veux tout dans le contrat. Pas d\'accords verbaux.',
      coachingNote: 'Confirme que toutes les conditions sont formalisées dans le contrat. Propose d\'envoyer un modèle.',
    },
  ],
  professionnel: [
    {
      contentIt: 'Ho confrontato tre fornitori. I vostri prezzi sono nella media. Cosa vi differenzia concretamente?',
      contentFr: 'J\'ai comparé trois fournisseurs. Vos prix sont dans la moyenne. Qu\'est-ce qui vous différencie concrètement ?',
      coachingNote: 'Mets en avant un différenciateur précis : délai, certification, SAV, ou flexibilité de paiement.',
    },
    {
      contentIt: 'Mi dica le specifiche tecniche esatte del 20 piedi: dimensioni interne, portata, isolamento in mm.',
      contentFr: 'Donnez-moi les specs techniques exactes du 20 pieds : dimensions intérieures, portée, isolation en mm.',
      coachingNote: 'Donne des chiffres précis. Si tu n\'es pas sûr, dis "je vous envoie la fiche technique dans l\'heure".',
    },
    {
      contentIt: 'Quali sono le condizioni di pagamento? Accettate pagamento a 60 giorni?',
      contentFr: 'Quelles sont les conditions de paiement ? Acceptez-vous un paiement à 60 jours ?',
      coachingNote: 'Réponds sur les conditions standard et la marge de négociation possible. Ne promets rien sans confirmer.',
    },
  ],
};

function getMoodMidReply(mood: string, turn: number): MoodReply | null {
  const bank = MOOD_MID[mood];
  if (!bank || bank.length === 0) return null;
  return bank[Math.min(turn - 2, bank.length - 1)] ?? bank[bank.length - 1]!;
}

// ─── Local Client Reply Generator ────────────────────────────────────────────

export function buildLocalClientReply(params: {
  scenario: ScenarioRow;
  learnerReply: string;
  history: DialogueMessageRow[];
  mood?: B2BMood;
  guidedChoiceQuality?: GuidedChoiceQuality;
}): LocalClientReply {
  const turn = params.history.filter((message) => message.role === 'learner').length;
  const normalized = params.learnerReply.toLowerCase();
  const mood = params.mood ?? 'professionnel';
  const trustAlreadyAsked = hasClientAsked(params.history, /come faccio a sapere|affidabili|fidarmi|garanzie|referenze/);

  // ── Guided quality overrides (mood-flavored) ──────────────────────────────
  if (params.guidedChoiceQuality === 'wrong') {
    const irrite = mood === 'irrite' || mood === 'mefiant';
    return {
      contentIt: irrite
        ? 'No. Non mi risponde. Le ho fatto una domanda precisa, voglio una risposta concreta.'
        : 'Mi scusi, ma non risponde alla mia domanda. Può darmi una risposta concreta, senza cambiare argomento?',
      contentFr: irrite
        ? 'Non. Vous ne me répondez pas. Je vous ai posé une question précise, je veux une réponse concrète.'
        : 'Excusez-moi, mais cela ne répond pas à ma question. Pouvez-vous me donner une réponse concrète sans changer de sujet ?',
      coachingNote: 'La réponse choisie était hors sujet. Reviens à la question exacte du client et réponds en une phrase claire.',
    };
  }

  if (params.guidedChoiceQuality === 'approx') {
    const strict = mood === 'professionnel' || mood === 'irrite';
    return {
      contentIt: strict
        ? 'Troppo vago. Ho bisogno di numeri precisi, non di generalità.'
        : 'Va bene, ma è ancora un po\' generico. Mi può dare un esempio concreto o una prova verificabile?',
      contentFr: strict
        ? 'Trop vague. J\'ai besoin de chiffres précis, pas de généralités.'
        : 'D\'accord, mais cela reste un peu général. Pouvez-vous me donner un exemple concret ou une preuve vérifiable ?',
      coachingNote: 'Une approximation garde le dialogue ouvert, mais le client demande maintenant une preuve précise.',
    };
  }

  // ── Closing ───────────────────────────────────────────────────────────────
  if (turn >= 6 || hasLearnerClosingIntent(normalized)) {
    return MOOD_CLOSING[mood] ?? MOOD_CLOSING['professionnel']!;
  }

  // ── Early turns (0-1): set the mood from the start ────────────────────────
  if (turn <= 1) {
    return MOOD_EARLY[mood] ?? MOOD_EARLY['professionnel']!;
  }

  // ── Méfiant: always challenge trust if not yet addressed ──────────────────
  if (mood === 'mefiant' && !trustAlreadyAsked && !hasLearnerAddressedTrust(normalized)) {
    return {
      contentIt: 'Prima di andare avanti, come faccio a sapere che siete affidabili? Ho bisogno di prove concrete.',
      contentFr: 'Avant d\'aller plus loin, comment savoir que vous êtes fiables ? J\'ai besoin de preuves concrètes.',
      coachingNote: 'Apporte des garanties : référence client, inspection, SIRET, contrat ou paiement sécurisé.',
    };
  }

  // ── Content-specific triggers (mood-flavored) ─────────────────────────────
  if (hasLearnerAddressedComfort(normalized) && hasLearnerAddressedTrust(normalized)) {
    const moodFlavor: Record<string, string> = {
      mefiant: 'Bene, ma voglio vedere queste prove. Mi mandi la documentazione vera, non il depliant commerciale.',
      cordial: 'Ottimo, mi rassicura molto! Allora possiamo parlare di prezzi e tempi?',
      irrite: 'Va bene. Finalmente qualcosa di concreto. Mandatemi tutto per iscritto.',
      professionnel: 'Bene. Inviatemi la scheda tecnica completa e le referenze. Poi decido.',
      presse: 'Ok ok. Allora mandi scheda tecnica e preventivo oggi stesso.',
    };
    return {
      contentIt: moodFlavor[mood] ?? 'Questo mi rassicura. Mi mandi foto reali, scheda tecnica e referenze cliente. Poi parliamo di prezzo e tempi.',
      contentFr: {
        mefiant: 'Bien, mais je veux voir ces preuves. Envoyez-moi la vraie documentation, pas le dépliant commercial.',
        cordial: 'Excellent, ça me rassure beaucoup ! Alors on peut parler prix et délais ?',
        irrite: 'D\'accord. Enfin quelque chose de concret. Envoyez-moi tout par écrit.',
        professionnel: 'Bien. Envoyez-moi la fiche technique complète et les références. Ensuite je décide.',
        presse: 'Ok ok. Envoyez fiche technique et devis aujourd\'hui même.',
      }[mood] ?? 'Cela me rassure. Envoyez-moi des photos réelles, la fiche technique et des références client. Ensuite prix et délais.',
      coachingNote: 'Le client valide la preuve. Transition vers prix, délais et prochaine étape concrète.',
    };
  }

  if (normalized.includes('prezzo') || normalized.includes('costo') || normalized.includes('preventivo')) {
    const moodFlavor: Record<string, { it: string; fr: string }> = {
      mefiant: { it: 'Il prezzo sembra alto. Come giustificate questo costo rispetto alla concorrenza?', fr: 'Le prix semble élevé. Comment justifiez-vous ce coût par rapport à la concurrence ?' },
      presse: { it: 'Ok il prezzo. La consegna è inclusa? Sì o no.', fr: 'Ok le prix. La livraison est incluse ? Oui ou non.' },
      cordial: { it: 'Il prezzo mi sembra ragionevole. Ma la consegna e l\'installazione sono incluse?', fr: 'Le prix me semble raisonnable. Mais la livraison et l\'installation sont incluses ?' },
      irrite: { it: 'Sento che ci saranno costi nascosti. Cosa è incluso ESATTAMENTE?', fr: 'Je sens qu\'il y aura des frais cachés. Qu\'est-ce qui est inclus EXACTEMENT ?' },
      professionnel: { it: 'IVA esclusa o inclusa? E la consegna, lo scarico, il montaggio: indicatemi i prezzi separati.', fr: 'TVA incluse ou exclue ? Et la livraison, le déchargement, le montage : donnez-moi les prix séparés.' },
    };
    const flavor = moodFlavor[mood];
    return {
      contentIt: flavor?.it ?? 'Il prezzo mi interessa, ma ho paura dei costi nascosti. La consegna e l\'installazione sono incluse?',
      contentFr: flavor?.fr ?? 'Le prix m\'intéresse, mais j\'ai peur des frais cachés. La livraison et l\'installation sont-elles incluses ?',
      coachingNote: 'Clarifie sans inventer : distingue inclus, optionnel et devis personnalisé.',
    };
  }

  if (normalized.includes('isolamento') || hasLearnerAddressedTrust(normalized)) {
    const moodFlavor: Record<string, { it: string; fr: string }> = {
      mefiant: { it: 'Bene. E per i permessi comunali? Non voglio rischiare sanzioni.', fr: 'Bien. Et pour les permis communaux ? Je ne veux pas risquer des sanctions.' },
      presse: { it: 'Ok. I permessi quanto tempo richiedono? Datemi una stima.', fr: 'Ok. Les permis combien de temps ? Donnez-moi une estimation.' },
      cordial: { it: 'Perfetto, grazie! E per le autorizzazioni comunali, mi aiutate?', fr: 'Parfait, merci ! Et pour les autorisations communales, vous m\'aidez ?' },
      irrite: { it: 'Va bene. Ora mi parli dei permessi. Non voglio brutte sorprese burocratiche.', fr: 'Bien. Maintenant parlez-moi des permis. Je ne veux pas de mauvaises surprises bureaucratiques.' },
      professionnel: { it: 'Bene. Quali sono le normative applicabili per un\'installazione su terreno privato in zona industriale?', fr: 'Bien. Quelles sont les normes applicables pour une installation sur terrain privé en zone industrielle ?' },
    };
    const flavor = moodFlavor[mood];
    return {
      contentIt: flavor?.it ?? 'Questo mi rassicura. E per i permessi? Se lo metto su un terreno privato, mi accompagnate nelle verifiche?',
      contentFr: flavor?.fr ?? 'Cela me rassure. Et pour les autorisations ? Si je le pose sur un terrain privé, m\'accompagnez-vous dans les vérifications ?',
      coachingNote: 'Ne donne pas un avis juridique absolu. Propose un accompagnement et une vérification locale.',
    };
  }

  if (normalized.includes('terreno') || normalized.includes('permesso') || normalized.includes('comune')) {
    const moodFlavor: Record<string, { it: string; fr: string }> = {
      mefiant: { it: 'E se il comune blocca tutto? Chi si assume la responsabilità?', fr: 'Et si la mairie bloque tout ? Qui prend la responsabilité ?' },
      presse: { it: 'Quanto ci vuole per i permessi? Mesi o settimane?', fr: 'Combien de temps pour les permis ? Mois ou semaines ?' },
      cordial: { it: 'Capito. E dal vostro lato, quanto tempo serve dalla firma alla consegna?', fr: 'Compris. Et de votre côté, combien de temps de la signature à la livraison ?' },
      irrite: { it: 'Non voglio ritardi per burocrazia. Avete esperienza con i comuni del nord Italia?', fr: 'Je ne veux pas de retards pour la bureaucratie. Vous avez de l\'expérience avec les communes du nord de l\'Italie ?' },
      professionnel: { it: 'Qual è la tempistica standard dalla firma del contratto alla consegna installata?', fr: 'Quel est le délai standard de la signature du contrat à la livraison installée ?' },
    };
    const flavor = moodFlavor[mood];
    return {
      contentIt: flavor?.it ?? 'Va bene. Quanto tempo serve tra il primo contatto e la consegna del modulo?',
      contentFr: flavor?.fr ?? 'Très bien. Combien de temps entre le premier contact et la livraison du module ?',
      coachingNote: 'Donne une fourchette prudente et propose un rendez-vous technique.',
    };
  }

  // ── Mid-conversation: rotate mood-specific replies ────────────────────────
  const midReply = getMoodMidReply(mood, turn);
  if (midReply) return midReply;

  // ── Fallback générique mood-aware ─────────────────────────────────────────
  const fallbacks: Record<string, MoodReply> = {
    mefiant: {
      contentIt: 'Mi spiega tutto questo, ma ho bisogno di vedere prove scritte prima di andare avanti.',
      contentFr: 'Vous m\'expliquez tout ça, mais j\'ai besoin de voir des preuves écrites avant d\'aller plus loin.',
      coachingNote: 'Le méfiant veut toujours du concret. Propose un document, une référence ou une visite.',
    },
    presse: {
      contentIt: 'Veloce: quali sono i prossimi passi concreti? Non ho tempo per dettagli inutili.',
      contentFr: 'Vite : quelles sont les prochaines étapes concrètes ? Je n\'ai pas le temps pour des détails inutiles.',
      coachingNote: 'Le pressé veut une roadmap courte. Max 3 étapes, avec des délais précis.',
    },
    cordial: {
      contentIt: 'Molto interessante! Ha altri esempi di utilizzo per piccole strutture o uso privato?',
      contentFr: 'Très intéressant ! Avez-vous d\'autres exemples d\'utilisation pour petites structures ou usage privé ?',
      coachingNote: 'Le cordial aime les exemples concrets. Propose un cas d\'usage proche de son projet.',
    },
    irrite: {
      contentIt: 'Ok. Adesso mi dica cosa succede se qualcosa va storto. Qual è la vostra procedura?',
      contentFr: 'Ok. Maintenant dites-moi ce qui se passe si quelque chose tourne mal. Quelle est votre procédure ?',
      coachingNote: 'L\'irrité veut savoir comment les problèmes sont gérés. Sois direct sur la procédure SAV.',
    },
    professionnel: {
      contentIt: 'Mi può spiegare quali sono i prossimi passi per ricevere un\'offerta tecnica completa e vincolante?',
      contentFr: 'Pouvez-vous m\'expliquer les prochaines étapes pour recevoir une offre technique complète et contraignante ?',
      coachingNote: 'Structure en 3 étapes : validation du besoin, fiche technique, offre ferme avec délai.',
    },
  };

  return fallbacks[mood] ?? fallbacks['professionnel']!;
}

// ─── Italian commercial normalizer ───────────────────────────────────────────

function normalizeCommercialItalian(reply: string): string {
  const cleaned = capitalizeSentence(reply.replace(/\s+/g, ' '));
  const withGreeting = /buongiorno|salve|certamente/i.test(cleaned) ? cleaned : `Certamente, ${cleaned}`;
  const withPoliteClose = /lei|le|suo|sua|possiamo/i.test(withGreeting)
    ? withGreeting
    : `${withGreeting} Possiamo anche verificare insieme le Sue esigenze.`;

  return withPoliteClose.endsWith('.') || withPoliteClose.endsWith('?')
    ? withPoliteClose
    : `${withPoliteClose}.`;
}
