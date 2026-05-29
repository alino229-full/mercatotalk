import type { B2BMission } from '@/data/b2b-missions';
import { getExpoApiBaseUrl } from '@/services/api-base-url';

export type GeneratedListenQuestion = {
  audioIt: string;
  choices: { id: string; label: string }[];
  answerId: string;
};

type ListenQuestionsResponse = {
  questions?: GeneratedListenQuestion[];
};

const configuredApiUrl =
  process.env.EXPO_PUBLIC_ITALPRO_API_URL ?? process.env.EXPO_PUBLIC_ITALPRO_AI_URL;

function getApiBaseUrl(): string | null {
  return getExpoApiBaseUrl(configuredApiUrl);
}

const localListenQuestionPool: GeneratedListenQuestion[] = [
  {
    audioIt: 'Mi mandi il preventivo entro oggi, separando consegna, scarico e IVA, per favore.',
    choices: [
      { id: 'local-0-a', label: 'Envoyer un devis détaillé aujourd’hui' },
      { id: 'local-0-b', label: 'Demander seulement son budget' },
      { id: 'local-0-c', label: 'Repousser le devis à demain' },
      { id: 'local-0-d', label: 'Parler des couleurs disponibles' },
    ],
    answerId: 'local-0-a',
  },
  {
    audioIt: 'Per un container da venti piedi, mi conferma due mila novecento euro IVA esclusa?',
    choices: [
      { id: 'local-1-a', label: 'Proposer une remise immédiate' },
      { id: 'local-1-b', label: 'Confirmer le prix hors TVA' },
      { id: 'local-1-c', label: 'Changer de modèle de container' },
      { id: 'local-1-d', label: 'Demander une nouvelle adresse' },
    ],
    answerId: 'local-1-b',
  },
  {
    audioIt: 'Il container deve entrare in un cortile stretto: mi servono lunghezza, larghezza e altezza precise.',
    choices: [
      { id: 'local-2-a', label: 'Envoyer les dimensions techniques' },
      { id: 'local-2-b', label: 'Demander un acompte tout de suite' },
      { id: 'local-2-c', label: 'Annuler la livraison' },
      { id: 'local-2-d', label: 'Proposer un appel marketing' },
    ],
    answerId: 'local-2-a',
  },
  {
    audioIt: 'La consegna a Bologna entro il quindici marzo è fondamentale per noi.',
    choices: [
      { id: 'local-3-a', label: 'Ignorer la date demandée' },
      { id: 'local-3-b', label: 'Promettre sans vérifier' },
      { id: 'local-3-c', label: 'Vérifier le planning logistique' },
      { id: 'local-3-d', label: 'Envoyer seulement une brochure' },
    ],
    answerId: 'local-3-c',
  },
  {
    audioIt: 'Possiamo pagare trenta per cento di acconto e saldo alla consegna?',
    choices: [
      { id: 'local-4-a', label: 'Valider ou préciser les paiements' },
      { id: 'local-4-b', label: 'Refuser sans explication' },
      { id: 'local-4-c', label: 'Parler uniquement du transport' },
      { id: 'local-4-d', label: 'Demander un nouveau contact' },
    ],
    answerId: 'local-4-a',
  },
  {
    audioIt: 'Vorremmo verniciatura RAL sette zero uno sei e il logo aziendale sulla porta.',
    choices: [
      { id: 'local-5-a', label: 'Supprimer la personnalisation' },
      { id: 'local-5-b', label: 'Noter couleur et logo' },
      { id: 'local-5-c', label: 'Proposer un container frigo' },
      { id: 'local-5-d', label: 'Parler du délai de paiement' },
    ],
    answerId: 'local-5-b',
  },
  {
    audioIt: 'Per la piscina container, il sistema di filtrazione è incluso nel prezzo?',
    choices: [
      { id: 'local-6-a', label: 'Expliquer les inclusions piscine' },
      { id: 'local-6-b', label: 'Demander la TVA du client' },
      { id: 'local-6-c', label: 'Confirmer une livraison gratuite' },
      { id: 'local-6-d', label: 'Changer vers un bureau mobile' },
    ],
    answerId: 'local-6-a',
  },
  {
    audioIt: 'Per uso abitativo, devo capire se serve CILA o permesso di costruire.',
    choices: [
      { id: 'local-7-a', label: 'Donner un avis juridique définitif' },
      { id: 'local-7-b', label: 'Ignorer la réglementation' },
      { id: 'local-7-c', label: 'Orienter vers validation technique' },
      { id: 'local-7-d', label: 'Proposer une remise commerciale' },
    ],
    answerId: 'local-7-c',
  },
  {
    audioIt: 'Il container frigorifero deve mantenere meno venti gradi ed essere conforme HACCP.',
    choices: [
      { id: 'local-8-a', label: 'Confirmer les exigences froid' },
      { id: 'local-8-b', label: 'Parler d’un container standard' },
      { id: 'local-8-c', label: 'Éviter le sujet HACCP' },
      { id: 'local-8-d', label: 'Demander de rappeler demain' },
    ],
    answerId: 'local-8-a',
  },
  {
    audioIt: 'Preferiamo noleggio mensile con opzione di riscatto dopo dodici mesi.',
    choices: [
      { id: 'local-9-a', label: 'Imposer l’achat immédiat' },
      { id: 'local-9-b', label: 'Préparer une offre location' },
      { id: 'local-9-c', label: 'Refuser l’option de rachat' },
      { id: 'local-9-d', label: 'Demander une visite atelier' },
    ],
    answerId: 'local-9-b',
  },
];

function buildLocalListenQuestions(): GeneratedListenQuestion[] {
  return shuffleListenQuestionChoices(localListenQuestionPool);
}

function shuffleChoices<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index]!;
    shuffled[index] = shuffled[swapIndex]!;
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

function shuffleListenQuestionChoices(questions: GeneratedListenQuestion[]): GeneratedListenQuestion[] {
  return questions.map((question) => ({
    ...question,
    choices: shuffleChoices(question.choices.map((choice) => ({ ...choice }))),
  }));
}

export async function generateListenQuestions(
  mission: Pick<B2BMission, 'id' | 'scenarioId' | 'level' | 'vocabCategories' | 'numberModes'>,
): Promise<GeneratedListenQuestion[]> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return buildLocalListenQuestions();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch(`${apiBaseUrl}/listen-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        missionId: mission.id,
        scenarioId: mission.scenarioId,
        level: mission.level,
        vocabCategories: mission.vocabCategories,
        numberModes: mission.numberModes,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return buildLocalListenQuestions();

    const data = (await response.json()) as ListenQuestionsResponse;
    const questions = data.questions;

    if (!Array.isArray(questions) || questions.length < 10) return buildLocalListenQuestions();

    return shuffleListenQuestionChoices(questions.slice(0, 10));
  } catch {
    return buildLocalListenQuestions();
  } finally {
    clearTimeout(timeoutId);
  }
}
