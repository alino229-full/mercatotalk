type GroqTranscriptionResponse = {
  text?: string;
  language?: string;
  duration?: number;
};

type WebFormData = FormData & {
  get: (name: string) => unknown;
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

    const incomingForm = (await request.formData()) as unknown as WebFormData;
    const file = incomingForm.get('file');

    if (!(file instanceof File)) {
      return Response.json({ error: 'Fichier audio manquant.' }, { status: 400, headers: corsHeaders });
    }

    const groqForm = new FormData();
    groqForm.append('file', file);
    groqForm.append('model', process.env.GROQ_STT_MODEL ?? 'whisper-large-v3-turbo');
    groqForm.append('response_format', 'json');

    const language = incomingForm.get('language');
    const prompt = incomingForm.get('prompt');

    if (typeof language === 'string' && language.length > 0) {
      groqForm.append('language', language);
    }

    if (typeof prompt === 'string' && prompt.length > 0) {
      groqForm.append('prompt', prompt);
    }

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: groqForm,
    });

    const data = (await response.json()) as GroqTranscriptionResponse;

    if (!response.ok) {
      return Response.json(data, { status: response.status, headers: corsHeaders });
    }

    return Response.json(
      {
        text: data.text ?? '',
        language: data.language,
        duration: data.duration,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json(
      { error: 'Erreur serveur transcribe.', detail: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500, headers: corsHeaders },
    );
  }
}
