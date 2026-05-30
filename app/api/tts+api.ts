type TtsRequest = {
  text?: string;
  /** Deepgram voice model, e.g. aura-2-livia-it. */
  model?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DEEPGRAM_SPEAK_URL = 'https://api.deepgram.com/v1/speak';
const DEFAULT_MODEL = 'aura-2-livia-it';
// Deepgram caps Aura requests at 2000 characters per call.
const MAX_CHARS = 2000;

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: 'DEEPGRAM_API_KEY manquant cote serveur.' },
        { status: 503, headers: corsHeaders },
      );
    }

    const body = (await request.json()) as TtsRequest;
    const text = body.text?.trim();

    if (!text) {
      return Response.json({ error: 'Texte TTS manquant.' }, { status: 400, headers: corsHeaders });
    }

    if (text.length > MAX_CHARS) {
      return Response.json(
        { error: `Texte trop long (max ${MAX_CHARS} caracteres).` },
        { status: 400, headers: corsHeaders },
      );
    }

    const model = body.model ?? process.env.DEEPGRAM_TTS_MODEL ?? DEFAULT_MODEL;
    const url = `${DEEPGRAM_SPEAK_URL}?model=${encodeURIComponent(model)}&encoding=mp3`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return Response.json(
        { error: 'Deepgram TTS a refuse la requete.', detail },
        { status: response.status, headers: corsHeaders },
      );
    }

    // Buffer the audio: streaming response.body directly is not reliably
    // supported by the Expo Router server runtime and throws a 500.
    const audio = await response.arrayBuffer();

    return new Response(audio, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json(
      { error: 'Erreur serveur tts.', detail: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500, headers: corsHeaders },
    );
  }
}
