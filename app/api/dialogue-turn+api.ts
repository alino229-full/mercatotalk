import type { DialogueMessageRow, ScenarioRow } from '@/database/italpro-local-db';
import type { B2BMood } from '@/data/b2b-operational';
import type { GuidedChoiceQuality } from '@/services/local-dialogue-engine';
import type { DialogueAiTurn } from '@/services/dialogue-ai-client';

type DialogueTurnRequest = {
  scenario?: ScenarioRow;
  learnerReply?: string;
  history?: DialogueMessageRow[];
  mood?: B2BMood;
  guidedChoiceQuality?: GuidedChoiceQuality;
};

type GroqChatResponse = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      return Response.json({ error: 'GROQ_API_KEY manquant cote serveur.' }, { status: 503, headers: corsHeaders });
    }

    const body = (await request.json()) as DialogueTurnRequest;

    if (!body.scenario || typeof body.learnerReply !== 'string' || !Array.isArray(body.history)) {
      return Response.json({ error: 'Payload dialogue invalide.' }, { status: 400, headers: corsHeaders });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_LLM_MODEL ?? 'llama-3.3-70b-versatile',
        temperature: 0.45,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Tu es un moteur de simulation d appel B2B. Tu generes deux choses: (1) une correction pedagogique de la replique apprenant, (2) la prochaine replique du client en italien. CRITICAL: le champ MOOD_CLIENT_ACTIF dans le prompt utilisateur definit le caractere et le ton du client. Tu DOIS l appliquer strictement dans clientReply. Un client mefiant reste mefiant, un client presse reste presse, etc. Reponds uniquement en JSON valide.',
          },
          {
            role: 'user',
            content: buildPrompt(
              body.scenario,
              body.learnerReply,
              body.history,
              body.mood,
              body.guidedChoiceQuality,
            ),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json(
        { error: 'Groq LLM a refuse la requete.', detail: errorText },
        { status: response.status, headers: corsHeaders },
      );
    }

    const data = (await response.json()) as GroqChatResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return Response.json({ error: 'Reponse Groq vide.' }, { status: 502, headers: corsHeaders });
    }

    const turn = normalizeAiTurn(JSON.parse(content) as Partial<DialogueAiTurn>);
    return Response.json(turn, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: 'Erreur serveur dialogue-turn.', detail: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500, headers: corsHeaders },
    );
  }
}

const MOOD_DESCRIPTIONS: Record<string, string> = {
  mefiant: 'Client MEFIANT: il remet en cause toutes les affirmations, exige des preuves concretes (SIRET, references verifiables, inspection, contrat), refuse toute promesse vague, pose des questions courtes et directes, reste soupconneux meme apres une bonne reponse.',
  presse: 'Client PRESSE: repliques tres courtes, interrompt parfois, veut prix + delais + inclus en 3 points maximum, ne supporte pas les introductions ni les generalites, prend ses decisions vite si les infos sont claires.',
  irrite: 'Client IRRITE: ton sec et tendu, fait reference a de mauvaises experiences passees avec des fournisseurs, objections fortes et credibles, refuse les accords verbaux, exige tout par ecrit, se calme seulement si la reponse est precise et honnete.',
  cordial: 'Client CORDIAL: ton chaleureux et ouvert, pose des questions de curiosite sincere, apprecie les exemples concrets et les photos, accepte les prochaines etapes si elles sont claires, cree une relation mais reste professionnel.',
  professionnel: 'Client PROFESSIONNEL: rationnel et methodique, compare les fournisseurs sur des criteres objectifs (prix HT/TTC, delai, conditions de paiement, certifications), demande des specs techniques precises, ne signe pas sans documentation complete.',
};

function buildPrompt(
  scenario: ScenarioRow,
  learnerReply: string,
  history: DialogueMessageRow[],
  mood?: B2BMood,
  guidedChoiceQuality?: GuidedChoiceQuality,
): string {
  const activeMood = mood ?? 'professionnel';
  const compactHistory = history.slice(-8).map((message) => ({
    role: message.role,
    it: message.contentIt,
    fr: message.contentFr,
  }));

  return JSON.stringify({
    MOOD_CLIENT_ACTIF: activeMood,
    INSTRUCTION_MOOD: `${MOOD_DESCRIPTIONS[activeMood]} — La replique clientReply DOIT obligatoirement reflechir ce comportement. Ne l ignore pas.`,
    scenario: {
      title: scenario.title,
      marketContext: scenario.marketContext,
      clientGoal: scenario.clientGoal,
      clientPersona: scenario.clientPersona,
      productContext: scenario.productContext,
      successCriteria: scenario.successCriteria,
    },
    history: compactHistory,
    learnerReply,
    guidedChoiceQuality,
    guidedChoiceRule:
      guidedChoiceQuality === 'wrong'
        ? 'La reponse apprenant vient d un piege hors sujet: le client doit reagir selon son mood, pointer que cela ne repond pas, puis reformuler sa demande.'
        : guidedChoiceQuality === 'approx'
          ? 'La reponse apprenant est presque correcte mais trop vague: le client, selon son mood, doit demander une preuve ou une precision concrete.'
          : guidedChoiceQuality === 'best'
            ? 'La reponse apprenant est la meilleure option guidee: le client doit avancer vers l etape suivante en restant dans son mood.'
            : 'La reponse apprenant est libre: evalue-la normalement.',
    conversationRules: [
      'Ne repete jamais mot pour mot une question client deja posee dans history.',
      'Si l apprenant a apporte des preuves de fiabilite (SIRET, references, inspection, contrat, paiement securise), passe a une nouvelle objection ou etape coherente avec le mood.',
      'Apres 6 tours apprenant ou si le closing est atteint, le client peut terminer la conversation en demandant un recapitulatif ecrit.',
      'Le ton et le vocabulaire de clientReply doivent toujours rester coherents avec MOOD_CLIENT_ACTIF.',
    ],
    expectedJsonShape: {
      correction: {
        score: 'number 0-100',
        correctedIt: 'italien professionnel corrige',
        feedbackFr: 'feedback concret en francais',
        nextFocus: ['liste courte de points a travailler'],
        breakdown: {
          grammaire: 'number 0-100',
          vocabulaire: 'number 0-100',
          politesse: 'number 0-100',
        },
      },
      clientReply: {
        contentIt: 'prochaine replique du client en italien selon son mood',
        contentFr: 'traduction francaise',
        coachingNote: 'objectif pedagogique du prochain tour en francais',
      },
    },
  });
}

function normalizeAiTurn(value: Partial<DialogueAiTurn>): DialogueAiTurn {
  const correction = value.correction;
  const clientReply = value.clientReply;

  if (
    !correction ||
    !clientReply ||
    typeof correction.correctedIt !== 'string' ||
    typeof correction.feedbackFr !== 'string' ||
    !Array.isArray(correction.nextFocus) ||
    typeof clientReply.contentIt !== 'string' ||
    typeof clientReply.contentFr !== 'string' ||
    typeof clientReply.coachingNote !== 'string'
  ) {
    throw new Error('JSON IA incomplet.');
  }

  return {
    correction: {
      score: typeof correction.score === 'number' ? Math.max(0, Math.min(100, Math.round(correction.score))) : 60,
      correctedIt: correction.correctedIt,
      feedbackFr: correction.feedbackFr,
      nextFocus: correction.nextFocus.filter((item): item is string => typeof item === 'string').slice(0, 4),
      breakdown: normalizeBreakdown(correction.breakdown, correction.score),
    },
    clientReply: {
      contentIt: clientReply.contentIt,
      contentFr: clientReply.contentFr,
      coachingNote: clientReply.coachingNote,
    },
  };
}

function normalizeBreakdown(
  value: Partial<DialogueAiTurn['correction']['breakdown']> | undefined,
  fallbackScore: unknown,
): DialogueAiTurn['correction']['breakdown'] {
  const base = typeof fallbackScore === 'number' ? Math.max(0, Math.min(100, Math.round(fallbackScore))) : 60;
  const clamp = (score: unknown, fallback: number) =>
    typeof score === 'number' ? Math.max(0, Math.min(100, Math.round(score))) : fallback;

  return {
    grammaire: clamp(value?.grammaire, Math.min(100, Math.round(base * 1.05))),
    vocabulaire: clamp(value?.vocabulaire, base),
    politesse: clamp(value?.politesse, Math.min(100, Math.round(base * 1.08))),
  };
}
