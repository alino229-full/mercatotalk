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
  replies?: Partial<GuidedReplyChoice>[];
  options?: Partial<GuidedReplyChoice>[];
  propositions?: Partial<GuidedReplyChoice>[];
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
        max_tokens: 1600,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Tu generes 4 propositions de reponse pour un apprenant qui repond en italien a un client B2B. Le champ MOOD_CLIENT_ACTIF dans le prompt definit le caractere du client: les 4 repliques proposees doivent etre adaptees a ce type de client specifique. La meilleure reponse doit etre celle qui repond le mieux a un client ayant CE mood precis. Reponds uniquement en JSON valide.',
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

  const activeMood = mood ?? 'professionnel';
  const moodDescriptions: Record<string, string> = {
    mefiant: 'Client mefiant: exige des preuves, references et garanties. La meilleure reponse doit apporter une preuve concrete ou proposer une inspection.',
    presse: 'Client presse: repliques courtes attendues. La meilleure reponse doit aller droit au but: prix + delai + inclus en 1-2 phrases.',
    irrite: 'Client irrite: objections fortes. La meilleure reponse doit calmer et proposer quelque chose de tangible et contractuellement solide.',
    cordial: 'Client cordial: ouvert et curieux. La meilleure reponse peut inclure un exemple concret ou proposer une visite/demonstration.',
    professionnel: 'Client professionnel: veut des chiffres et specs precis. La meilleure reponse doit contenir des donnees ou proposer une documentation technique.',
  };

  return JSON.stringify({
    MOOD_CLIENT_ACTIF: activeMood,
    INSTRUCTION_MOOD: moodDescriptions[activeMood] ?? moodDescriptions['professionnel'],
    task: 'Generer 4 propositions de reponse que l agent commercial francophone pourrait dire en italien pour repondre a la derniere question du client.',
    scenario: {
      title: scenario.title,
      marketContext: scenario.marketContext,
      clientGoal: scenario.clientGoal,
      clientPersona: scenario.clientPersona,
      productContext: scenario.productContext,
      successCriteria: scenario.successCriteria,
    },
    history: compactHistory,
    latestClientQuestion: {
      it: latestClientMessage.contentIt,
      fr: latestClientMessage.contentFr,
      coachingNote: latestClientMessage.coachingNote,
    },
    requiredOutput: {
      choices: [
        { id: 'best', quality: 'best', text: 'la meilleure reponse adaptee au mood du client' },
        { id: 'approx', quality: 'approx', text: 'une reponse presque correcte mais trop vague ou incomplete' },
        { id: 'wrong-1', quality: 'wrong', text: 'un piege hors sujet mais plausible' },
        { id: 'wrong-2', quality: 'wrong', text: 'un deuxieme piege clairement faux ou mal priorise' },
      ],
    },
    strictRules: [
      'Ne reutilise pas une banque de reponses fixe: adapte les 4 choix a latestClientQuestion et au MOOD_CLIENT_ACTIF.',
      'La meilleure reponse doit repondre directement a la question du client de facon adaptee a son mood.',
      'L approximation doit rester comprehensible mais manquer de preuve, precision ou question de qualification.',
      'Les deux mauvaises reponses doivent etre coherentes grammaticalement mais hors sujet par rapport a la question.',
      'Tous les textes doivent etre en italien, en registre professionnel formel avec Lei/Le/Suo/Sua.',
      'Chaque choix doit faire 1 ou 2 phrases maximum.',
      'Ne donne pas de chiffres inventes sauf si le scenario les contient deja.',
    ],
  });
}

function normalizeGuidedChoices(value: GuidedChoicesAiResponse): GuidedReplyChoice[] {
  const rawChoices = getRawChoices(value);
  const cleaned = rawChoices
    .map((choice, index) => normalizeChoice(choice, index))
    .filter((choice): choice is GuidedReplyChoice => choice !== null);

  const best = cleaned.find((choice) => choice.quality === 'best');
  const approx = cleaned.find((choice) => choice.quality === 'approx');
  const wrong = cleaned.filter((choice) => choice.quality === 'wrong').slice(0, 2);

  const fallback = getFallbackGuidedChoices();

  return [
    { ...(best ?? fallback[0]!), id: 'ai-best' },
    { ...(approx ?? fallback[1]!), id: 'ai-approx' },
    { ...(wrong[0] ?? fallback[2]!), id: 'ai-wrong-1' },
    { ...(wrong[1] ?? fallback[3]!), id: 'ai-wrong-2' },
  ];
}

function getRawChoices(value: GuidedChoicesAiResponse): Partial<GuidedReplyChoice>[] {
  if (Array.isArray(value.choices)) return value.choices;
  if (Array.isArray(value.replies)) return value.replies;
  if (Array.isArray(value.options)) return value.options;
  if (Array.isArray(value.propositions)) return value.propositions;
  return [];
}

function normalizeChoice(choice: Partial<GuidedReplyChoice>, index: number): GuidedReplyChoice | null {
  if (!choice || typeof choice !== 'object') return null;
  if (typeof choice.text !== 'string' || choice.text.trim().length === 0) return null;

  const inferredQuality =
    choice.quality === 'best' || choice.quality === 'approx' || choice.quality === 'wrong'
      ? choice.quality
      : index === 0
        ? 'best'
        : index === 1
          ? 'approx'
          : 'wrong';

  return {
    id: typeof choice.id === 'string' && choice.id.trim() ? choice.id.trim() : `ai-choice-${index}`,
    text: choice.text.trim(),
    quality: inferredQuality,
  };
}

function getFallbackGuidedChoices(): GuidedReplyChoice[] {
  return [
    {
      id: 'fallback-best',
      quality: 'best',
      text: 'Capisco. Le confermo il punto principale e Le mando subito un riepilogo scritto con prezzo, tempi e condizioni.',
    },
    {
      id: 'fallback-approx',
      quality: 'approx',
      text: 'Sì, possiamo gestirlo. Le preparo una proposta più precisa dopo la chiamata.',
    },
    {
      id: 'fallback-wrong-1',
      quality: 'wrong',
      text: 'Non è importante adesso, parliamo piuttosto di un altro prodotto.',
    },
    {
      id: 'fallback-wrong-2',
      quality: 'wrong',
      text: 'Non lo so, ma possiamo firmare subito comunque.',
    },
  ];
}
