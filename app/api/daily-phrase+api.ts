import type { DailyPhrase } from '@/database/italpro-local-db';

type GroqChatResponse = {
  choices?: { message?: { content?: string } }[];
};

type DailyPhraseRequest = {
  context?: string;
  contextEmoji?: string;
  date?: string;
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function POST(request: Request) {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return Response.json({ error: 'GROQ_API_KEY manquant.' }, { status: 503, headers: CORS });
    }

    const body = (await request.json()) as DailyPhraseRequest;
    const context = body.context ?? 'Accroche téléphonique';
    const contextEmoji = body.contextEmoji ?? '📞';
    const date = body.date ?? new Date().toISOString().slice(0, 10);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_LLM_MODEL ?? 'llama-3.3-70b-versatile',
        temperature: 0.9,
        max_tokens: 256,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Tu es expert en italien commercial B2B pour commerciaux francophones vendant des containers (habitables, piscines, frigorifiques, standard, remorques) à des clients italiens. Génère une phrase du jour pratique, courte et authentique. Réponds uniquement en JSON strict.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              contexte: context,
              date,
              instructions:
                'Génère UNE seule phrase italienne professionnelle adaptée au contexte donné. Max 18 mots. Authentique, naturelle, directement utilisable lors d\'un appel ou email commercial.',
              formatAttendu: {
                it: 'la phrase en italien (max 18 mots)',
                fr: 'traduction naturelle en français',
                phonetic: 'phonétique simplifiée entre crochets, syllabe par syllabe, ex: [bwon-djor-no, so-no Pier-re]',
              },
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({ error: 'Groq a refusé.', detail: errorText }, { status: response.status, headers: CORS });
    }

    const data = (await response.json()) as GroqChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return Response.json({ error: 'Réponse Groq vide.' }, { status: 502, headers: CORS });
    }

    const parsed = JSON.parse(content) as { it?: string; fr?: string; phonetic?: string };
    if (!parsed.it || !parsed.fr) {
      return Response.json({ error: 'JSON incomplet — champs it/fr manquants.' }, { status: 422, headers: CORS });
    }

    const phrase: DailyPhrase = {
      date,
      it: parsed.it.trim(),
      fr: parsed.fr.trim(),
      phonetic: (parsed.phonetic ?? '').trim(),
      context,
      contextEmoji,
    };

    return Response.json(phrase, { headers: CORS });
  } catch (error) {
    return Response.json(
      { error: 'Erreur serveur daily-phrase.', detail: error instanceof Error ? error.message : '' },
      { status: 500, headers: CORS },
    );
  }
}
