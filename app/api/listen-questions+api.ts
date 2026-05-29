import type { B2BMission } from '@/data/b2b-missions';

type ListenQuestionsRequest = {
  missionId: string;
  scenarioId: string;
  level: B2BMission['level'];
  vocabCategories: string[];
  numberModes: string[];
};

type PartialListenQuestionsRequest = Partial<ListenQuestionsRequest>;

type GeneratedChoice = { id: string; label: string };

type GeneratedListenQuestion = {
  audioIt: string;
  choices: GeneratedChoice[];
  answerId: string;
};

type GroqChatResponse = {
  choices?: { message?: { content?: string } }[];
};

type AIResponse = {
  questions?: {
    audioIt?: string;
    choices?: { id?: string; label?: string }[];
    answerId?: string;
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
      return Response.json({ error: 'GROQ_API_KEY manquant.' }, { status: 503, headers: corsHeaders });
    }

    const body = normalizeListenQuestionsRequest((await request.json()) as PartialListenQuestionsRequest);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_LLM_MODEL ?? 'llama-3.3-70b-versatile',
        temperature: 0.85,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Tu generes des exercices de comprehension orale B2B pour un commercial francophone vendant des containers en Italie. Reponds uniquement en JSON valide avec le champ "questions".',
          },
          {
            role: 'user',
            content: buildPrompt(body),
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return Response.json({ error: 'Groq a refuse.', detail }, { status: response.status, headers: corsHeaders });
    }

    const data = (await response.json()) as GroqChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return Response.json({ error: 'Reponse Groq vide.' }, { status: 502, headers: corsHeaders });
    }

    const questions = normalizeQuestions(JSON.parse(content) as AIResponse);
    if (questions.length < 10) {
      return Response.json(
        { error: `Groq a retourné ${questions.length} questions valides au lieu de 10.` },
        { status: 502, headers: corsHeaders },
      );
    }

    return Response.json({ questions }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: 'Erreur listen-questions.', detail: error instanceof Error ? error.message : 'Inconnu' },
      { status: 500, headers: corsHeaders },
    );
  }
}

function normalizeListenQuestionsRequest(body: PartialListenQuestionsRequest): ListenQuestionsRequest {
  const missionId = typeof body.missionId === 'string' && body.missionId.trim()
    ? body.missionId.trim()
    : 'container-20-habitable';
  const scenarioId = typeof body.scenarioId === 'string' && body.scenarioId.trim()
    ? body.scenarioId.trim()
    : missionId;
  const level: B2BMission['level'] = body.level === 'Intermédiaire' || body.level === 'Avancé'
    ? body.level
    : 'Débutant';
  const vocabCategories = Array.isArray(body.vocabCategories) && body.vocabCategories.length > 0
    ? body.vocabCategories.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : ['container', 'finance', 'logistique'];
  const numberModes = Array.isArray(body.numberModes) && body.numberModes.length > 0
    ? body.numberModes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : ['price', 'dimension'];

  return {
    missionId,
    scenarioId,
    level,
    vocabCategories,
    numberModes,
  };
}

function buildPrompt(body: ListenQuestionsRequest): string {
  return JSON.stringify({
    task: 'Generer 10 questions de comprehension orale variees pour un exercice B2B containers. Chaque question est une phrase italienne dite par un client, suivie de 4 options en francais dont une seule est la bonne action commerciale.',
    context: {
      missionId: body.missionId,
      scenarioId: body.scenarioId,
      level: body.level,
      vocabCategories: body.vocabCategories,
      numberModes: body.numberModes,
    },
    thematiquesObligatoires: [
      'Prix et montants (container 20 piedi, 40 piedi, High Cube) avec euros reels ex: 2500€, 4800€, 950€/mois',
      'Dimensions precises (longueur, largeur, hauteur en metres, ex: 6m x 2,4m x 2,6m)',
      'Delai de livraison (ex: consegna entro 15 giorni, disponibile subito)',
      'Conditions de paiement (acconto 30%, saldo alla consegna, bonifico, 60 giorni)',
      'Couleurs et personnalisation (verniciatura RAL, logo aziendale, finestre, isolamento)',
      'Container piscine (vasca da nuoto, sistema di filtrazione, nage a contre-courant)',
      'Container habitable (uso abitativo, CILA, isolamento termico, allacciamenti)',
      'Refrigere HACCP (temperatura -20 a +4, conforme HACCP, apertura rapida)',
      'Location vs achat (noleggio mensile, acquisto, leasing, opzione di riscatto)',
      'Certificats et normes (certificazione IICL, garanzia, collaudo)',
    ],
    reglesStrictes: [
      'audioIt: phrase italienne realiste du client (1-2 phrases max, ton professionnel avec Lei/Le)',
      'Chaque question couvre une thematique differente parmi les 10 ci-dessus',
      'choices: exactement 4 options en francais, courtes (max 8 mots), realistes',
      'answerId: id du choix correct, obligatoirement "qN-a" ou "qN-b" ou "qN-c" ou "qN-d" (N = index 0-9)',
      'Les 3 mauvaises options sont plausibles mais incorrectes dans le contexte',
      'Inclure des montants, dimensions ou dates specifiques dans audioIt pour rendre lexercice concret',
      'Varier les types daction: envoyer devis, rappeler, proposer visite, expliquer conditions, etc.',
    ],
    outputFormat: {
      questions: [
        {
          audioIt: 'Phrase italienne du client avec Lei',
          choices: [
            { id: 'q0-a', label: 'Action commerciale A en francais' },
            { id: 'q0-b', label: 'Action commerciale B' },
            { id: 'q0-c', label: 'Action commerciale C' },
            { id: 'q0-d', label: 'Action commerciale D' },
          ],
          answerId: 'q0-a',
        },
      ],
    },
  });
}

function normalizeQuestions(value: AIResponse): GeneratedListenQuestion[] {
  if (!Array.isArray(value.questions)) return [];

  const valid: GeneratedListenQuestion[] = [];

  value.questions.forEach((q, idx) => {
    if (typeof q.audioIt !== 'string' || !q.audioIt.trim()) return;
    if (!Array.isArray(q.choices) || q.choices.length !== 4) return;
    if (typeof q.answerId !== 'string') return;

    const choices: GeneratedChoice[] = q.choices.map((c, ci) => ({
      id: c.id ?? `q${idx}-${String.fromCharCode(97 + ci)}`,
      label: (c.label ?? '').trim(),
    }));

    if (choices.some((c) => !c.label)) return;
    if (!choices.find((c) => c.id === q.answerId)) return;

    valid.push({ audioIt: q.audioIt.trim(), choices, answerId: q.answerId });
  });

  return valid.slice(0, 10);
}
