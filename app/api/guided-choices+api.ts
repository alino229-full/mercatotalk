import type { DialogueMessageRow, ScenarioRow } from '@/database/italpro-local-db';
import type { B2BMood } from '@/data/b2b-operational';
import type { GuidedReplyChoice } from '@/services/guided-choices-ai-client';

type GuidedChoicesRequest = {
  scenario?: ScenarioRow;
  latestClientMessage?: DialogueMessageRow;
  history?: DialogueMessageRow[];
  mood?: B2BMood;
};

type GroqChatResponse = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
};

type GuidedChoicesAiResponse = {
  choices?: Partial<GuidedReplyChoice>[];
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

    const body = (await request.json()) as GuidedChoicesRequest;

    if (!body.scenario || !body.latestClientMessage || !Array.isArray(body.history)) {
      return Response.json({ error: 'Payload guided-choices invalide.' }, { status: 400, headers: corsHeaders });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_LLM_MODEL ?? 'llama-3.3-70b-versatile',
        temperature: 0.72,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Tu generes des choix de reponse pour un simulateur d appel commercial italien B2B. Reponds uniquement en JSON valide. Les choix doivent etre naturels, courts, en italien professionnel avec Lei, et strictement coherents avec la derniere question du client.',
          },
          {
            role: 'user',
            content: buildPrompt(body.scenario, body.latestClientMessage, body.history, body.mood),
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

    const choices = normalizeGuidedChoices(JSON.parse(content) as GuidedChoicesAiResponse);
    return Response.json({ choices }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: 'Erreur serveur guided-choices.', detail: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500, headers: corsHeaders },
    );
  }
}

function buildPrompt(
  scenario: ScenarioRow,
  latestClientMessage: DialogueMessageRow,
  history: DialogueMessageRow[],
  mood?: B2BMood,
): string {
  const compactHistory = history.slice(-8).map((message) => ({
    role: message.role,
    it: message.contentIt,
    fr: message.contentFr,
  }));

  return JSON.stringify({
    task: 'Generer 4 propositions de reponse pour l agent commercial francophone qui doit repondre en italien.',
    scenario: {
      title: scenario.title,
      marketContext: scenario.marketContext,
      clientGoal: scenario.clientGoal,
      clientPersona: scenario.clientPersona,
      productContext: scenario.productContext,
      successCriteria: scenario.successCriteria,
    },
    mood: mood ?? 'professionnel',
    history: compactHistory,
    latestClientQuestion: {
      it: latestClientMessage.contentIt,
      fr: latestClientMessage.contentFr,
      coachingNote: latestClientMessage.coachingNote,
    },
    requiredOutput: {
      choices: [
        { id: 'best', quality: 'best', text: 'une seule meilleure reponse en italien' },
        { id: 'approx', quality: 'approx', text: 'une reponse presque correcte mais trop vague ou incomplete' },
        { id: 'wrong-1', quality: 'wrong', text: 'un piege hors sujet mais plausible' },
        { id: 'wrong-2', quality: 'wrong', text: 'un deuxieme piege clairement faux ou mal priorise' },
      ],
    },
    strictRules: [
      'Ne reutilise pas une banque de reponses fixe: adapte les 4 choix a latestClientQuestion.',
      'La meilleure reponse doit repondre directement a la question du client, puis ouvrir une prochaine etape utile.',
      'L approximation doit rester comprehensible mais manquer de preuve, precision ou question de qualification.',
      'Les deux mauvaises reponses doivent etre coherentes grammaticalement mais hors sujet par rapport a la question.',
      'Tous les textes doivent etre en italien, en registre professionnel formel avec Lei/Le/Suo/Sua.',
      'Chaque choix doit faire 1 ou 2 phrases maximum.',
      'Ne donne pas de chiffres inventes sauf si le scenario les contient deja.',
    ],
  });
}

function normalizeGuidedChoices(value: GuidedChoicesAiResponse): GuidedReplyChoice[] {
  const rawChoices = Array.isArray(value.choices) ? value.choices : [];
  const cleaned = rawChoices
    .filter((choice): choice is GuidedReplyChoice =>
      typeof choice.id === 'string' &&
      typeof choice.text === 'string' &&
      (choice.quality === 'best' || choice.quality === 'approx' || choice.quality === 'wrong'),
    )
    .map((choice) => ({
      id: choice.id,
      text: choice.text.trim(),
      quality: choice.quality,
    }))
    .filter((choice) => choice.text.length > 0);

  const best = cleaned.find((choice) => choice.quality === 'best');
  const approx = cleaned.find((choice) => choice.quality === 'approx');
  const wrong = cleaned.filter((choice) => choice.quality === 'wrong').slice(0, 2);

  if (!best || !approx || wrong.length !== 2) {
    throw new Error('JSON guided-choices incomplet.');
  }

  return [
    { ...best, id: 'ai-best' },
    { ...approx, id: 'ai-approx' },
    { ...wrong[0]!, id: 'ai-wrong-1' },
    { ...wrong[1]!, id: 'ai-wrong-2' },
  ];
}
