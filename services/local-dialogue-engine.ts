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

// ─── Markers ─────────────────────────────────────────────────────────────────

const politeMarkers = ['lei', 'le', 'la', 'vorrebbe', 'posso', 'possiamo', 'desidera'];
const reassuranceMarkers = [
  'garanzia', 'certificato', 'isolamento', 'sicuro', 'affidabile', 'assistenza', 'collaudo',
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

// ─── Local Client Reply Generator ────────────────────────────────────────────

export function buildLocalClientReply(params: {
  scenario: ScenarioRow;
  learnerReply: string;
  history: DialogueMessageRow[];
  mood?: B2BMood;
}): LocalClientReply {
  const turn = params.history.filter((message) => message.role === 'learner').length;
  const normalized = params.learnerReply.toLowerCase();
  const mood = params.mood ?? 'professionnel';

  if (mood === 'presse' && turn <= 2) {
    return {
      contentIt: 'Mi scusi, ho poco tempo. Mi dica subito prezzo, tempi e cosa e incluso.',
      contentFr: 'Excusez-moi, j ai peu de temps. Dites-moi directement le prix, les delais et ce qui est inclus.',
      coachingNote: 'Reponds en 3 points courts : prix, delai, inclus/exclus.',
    };
  }

  if (mood === 'irrite' && turn <= 2) {
    return {
      contentIt: 'Guardi, ho gia perso tempo con altri fornitori. Se non e chiaro, chiudiamo qui.',
      contentFr: 'Ecoutez, j ai deja perdu du temps avec d autres fournisseurs. Si ce n est pas clair, on s arrete la.',
      coachingNote: 'Calme le ton, reformule et donne une preuve concrete.',
    };
  }

  if (mood === 'mefiant' && !normalized.includes('garanzia') && !normalized.includes('certific')) {
    return {
      contentIt: 'Prima di parlare di ordine, come faccio a sapere che siete affidabili?',
      contentFr: 'Avant de parler commande, comment savoir que vous etes fiables ?',
      coachingNote: 'Apporte des garanties : reference, inspection, contrat, paiement securise.',
    };
  }

  if (turn <= 1) {
    return {
      contentIt:
        'Capisco. Però ho un dubbio importante: in inverno il container resta caldo? Non vorrei comprare qualcosa che sembra bello solo in foto.',
      contentFr:
        'Je comprends. Mais j\'ai un doute important : en hiver, le container reste-t-il chaud ? Je ne veux pas acheter quelque chose qui semble beau seulement en photo.',
      coachingNote: 'Réponds avec une preuve concrète : isolation, matériaux, visite, garantie ou exemple client.',
    };
  }

  if (normalized.includes('prezzo') || normalized.includes('costo') || normalized.includes('preventivo')) {
    return {
      contentIt:
        'Il prezzo mi interessa, ma ho paura dei costi nascosti. La consegna, l\'installazione e gli allacciamenti sono inclusi?',
      contentFr:
        'Le prix m\'intéresse, mais j\'ai peur des frais cachés. La livraison, l\'installation et les raccordements sont-ils inclus ?',
      coachingNote: 'Clarifie sans inventer : distingue inclus, optionnel et devis personnalisé.',
    };
  }

  if (normalized.includes('isolamento') || normalized.includes('garanzia') || normalized.includes('certific')) {
    return {
      contentIt:
        'Questo mi rassicura. E per i permessi? Se voglio metterlo su un terreno privato, mi accompagnate nelle verifiche?',
      contentFr:
        'Cela me rassure. Et pour les autorisations ? Si je veux le poser sur un terrain privé, m\'accompagnez-vous dans les vérifications ?',
      coachingNote: 'Ne donne pas un avis juridique absolu. Propose un accompagnement et une vérification locale.',
    };
  }

  if (normalized.includes('terreno') || normalized.includes('permesso') || normalized.includes('comune')) {
    return {
      contentIt:
        'Va bene. Ultima domanda: quanto tempo serve di solito tra il primo contatto e la consegna del modulo abitabile?',
      contentFr:
        'Très bien. Dernière question : combien de temps faut-il en général entre le premier contact et la livraison du module habitable ?',
      coachingNote: 'Donne une fourchette prudente et propose un rendez-vous technique.',
    };
  }

  return {
    contentIt:
      'Mi può spiegare in modo semplice quali sono i prossimi passi se voglio ricevere una proposta seria per un container da 20 piedi?',
    contentFr:
      'Pouvez-vous m\'expliquer simplement les prochaines étapes si je veux recevoir une proposition sérieuse pour un container de 20 pieds ?',
    coachingNote: 'Structure en 3 étapes : besoin, faisabilité, devis.',
  };
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
