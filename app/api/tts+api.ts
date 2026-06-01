import { getServerEnv } from '@/services/server-env';

import {
  DEFAULT_ITALIAN_DEEPGRAM_MODEL,
  normalizeItalianDeepgramModel,
} from '@/services/tts-models';

type TtsRequest = {
  text?: string;
  provider?: 'deepgram' | 'elevenlabs';
  /** Deepgram voice model, e.g. aura-2-livia-it. */
  model?: string;
  /** ElevenLabs voice id. If omitted, server env is used. */
  voiceId?: string;
  /** ElevenLabs model id, e.g. eleven_multilingual_v2. */
  modelId?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DEEPGRAM_SPEAK_URL = 'https://api.deepgram.com/v1/speak';
const ELEVENLABS_SPEAK_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_ELEVENLABS_MODEL = 'eleven_multilingual_v2';
const ELEVENLABS_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;
// Deepgram caps Aura requests at 2000 characters per call.
const MAX_CHARS = 2000;

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

/**
 * fetch() with retries on transient network errors (DNS EAI_AGAIN, ECONNRESET,
 * fetch failed). Deepgram itself is reliable; the flakiness comes from the host
 * DNS resolver. A short retry turns most intermittent failures into success.
 */
/**
 * Deepgram streams WAV with placeholder size fields (RIFF & data chunks set to
 * ~0x7FFFFFFF because the length is unknown while streaming). Players trust the
 * header and stop early. Since we buffer the whole clip, rewrite both size
 * fields to the real byte counts so the audio plays to the end.
 */
function fixWavHeader(buf: ArrayBuffer): ArrayBuffer {
  const len = buf.byteLength;
  if (len < 44) return buf;
  const view = new DataView(buf);
  const tag = (o: number) =>
    String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3));

  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return buf;

  // RIFF chunk size = total file length - 8.
  view.setUint32(4, len - 8, true);

  // Walk sub-chunks to find "data" and set its real size.
  let offset = 12;
  while (offset + 8 <= len) {
    const id = tag(offset);
    const declared = view.getUint32(offset + 4, true);
    if (id === 'data') {
      view.setUint32(offset + 4, len - (offset + 8), true);
      break;
    }
    // Non-data chunks (e.g. fmt) carry a correct size; advance past them.
    const advance = declared > len ? len : declared;
    offset += 8 + advance + (advance % 2);
  }
  return buf;
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, init);
      if (!shouldRetryResponse(response) || i === attempts - 1) {
        return response;
      }
      await sleep(getRetryDelayMs(response, i));
    } catch (err) {
      lastError = err;
      // Backoff: 150ms, 400ms before the next try.
      if (i < attempts - 1) {
        await sleep(i === 0 ? 150 : 400);
      }
    }
  }
  throw lastError;
}

export async function POST(request: Request) {
  try {
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

    if (body.provider === 'elevenlabs') {
      return await fetchElevenLabsSpeech(text, body);
    }

    return await fetchDeepgramSpeech(text, body);
  } catch (error) {
    return Response.json(
      { error: 'Erreur serveur tts.', detail: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500, headers: corsHeaders },
    );
  }
}

async function fetchDeepgramSpeech(text: string, body: TtsRequest): Promise<Response> {
  const apiKey = getServerEnv('DEEPGRAM_API_KEY');

  if (!apiKey) {
    return Response.json(
      { error: 'DEEPGRAM_API_KEY manquant cote serveur.' },
      { status: 503, headers: corsHeaders },
    );
  }

  const model = normalizeItalianDeepgramModel(
    body.model ?? getServerEnv('DEEPGRAM_TTS_MODEL') ?? DEFAULT_ITALIAN_DEEPGRAM_MODEL,
  );
  // WAV (RIFF + explicit length) plays fully on expo-audio. The `mp3` encoding
  // returns raw ADTS frames with no duration header, which truncates short
  // clips on Android (reads "pa" of "pane" then stops).
  const url =
    `${DEEPGRAM_SPEAK_URL}?model=${encodeURIComponent(model)}` +
    `&encoding=linear16&sample_rate=24000&container=wav`;

  const response = await fetchWithRetry(url, {
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
  const audio = fixWavHeader(await response.arrayBuffer());

  return new Response(audio, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'audio/wav',
      'Cache-Control': 'no-store',
    },
  });
}

async function fetchElevenLabsSpeech(text: string, body: TtsRequest): Promise<Response> {
  const apiKey = getServerEnv('ELEVENLABS_API_KEY', 'ELEVEN_LABS_API_KEY');
  const voiceId = normalizeElevenLabsId(
    body.voiceId ??
      getServerEnv(
        'ELEVENLABS_CALL_VOICE_ID',
        'ELEVENLABS_MACLY_VOICE_ID',
        'ELEVENLABS_VOICE_MACLY_ID',
        'MACLY_ELEVENLABS_VOICE_ID',
        'ELEVENLABS_VOICE_ID',
        'ELEVEN_LABS_VOICE_ID',
      ),
  );

  if (!apiKey) {
    return Response.json(
      { error: 'ELEVENLABS_API_KEY manquant cote serveur.' },
      { status: 503, headers: corsHeaders },
    );
  }
  if (!voiceId) {
    return Response.json(
      { error: 'ELEVENLABS_CALL_VOICE_ID manquant ou invalide cote serveur.' },
      { status: 503, headers: corsHeaders },
    );
  }

  const modelId = body.modelId ?? getServerEnv('ELEVENLABS_MODEL_ID') ?? DEFAULT_ELEVENLABS_MODEL;
  const response = await fetchWithRetry(
    `${ELEVENLABS_SPEAK_URL}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.85,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      { error: 'ElevenLabs TTS a refuse la requete.', detail },
      { status: response.status, headers: corsHeaders },
    );
  }

  return new Response(await response.arrayBuffer(), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}

function normalizeElevenLabsId(id: string | undefined): string | null {
  const trimmed = id?.trim();
  return trimmed && ELEVENLABS_ID_RE.test(trimmed) ? trimmed : null;
}

function shouldRetryResponse(response: Response): boolean {
  return response.status === 429 || [500, 502, 503, 504].includes(response.status);
}

function getRetryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('Retry-After');
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 2_500);
  }
  return attempt === 0 ? 350 : 900;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
