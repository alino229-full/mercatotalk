type TtsRequest = {
  text?: string;
  voice?: string;
  speed?: number;
  responseFormat?: string;
};

type HfSpaceAudioValue =
  | string
  | {
      url?: string;
      path?: string;
      name?: string;
    };

type HfSpaceResponse = {
  data?: unknown[];
};

type HfSpaceQueueJoinResponse = {
  event_id?: string;
};

type HfSpaceQueueEvent = {
  msg?: string;
  output?: {
    data?: unknown[];
    error?: string;
  };
  success?: boolean;
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
    const body = (await request.json()) as TtsRequest;
    const text = body.text?.trim();

    if (!text) {
      return Response.json({ error: 'Texte TTS manquant.' }, { status: 400, headers: corsHeaders });
    }

    const provider = process.env.KOKORO_TTS_PROVIDER ?? 'hf-space';

    if (provider === 'hf-inference') {
      return await synthesizeWithHfInference(body, text);
    }

    if (provider === 'self-hosted') {
      return await synthesizeWithSelfHostedKokoro(body, text);
    }

    return await synthesizeWithHfSpace(body, text);
  } catch (error) {
    return Response.json(
      { error: 'Erreur serveur tts.', detail: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500, headers: corsHeaders },
    );
  }
}

async function synthesizeWithHfSpace(body: TtsRequest, text: string): Promise<Response> {
  const hfSpaceUrl =
    process.env.HF_KOKORO_SPACE_URL ??
    process.env.EXPO_PUBLIC_HF_KOKORO_SPACE_URL ??
    'https://hexgrad-kokoro-tts.hf.space/api/predict';
  const requestedVoice = body.voice ?? getDefaultVoice();
  const speed = normalizeSpeed(body.speed);
  const audioUrl = await requestHfSpaceAudioUrl(hfSpaceUrl, text, requestedVoice, speed).catch(async (error) => {
    if (requestedVoice !== 'af_bella' && isUnavailableVoiceError(error)) {
      return requestHfSpaceAudioUrl(hfSpaceUrl, text, 'af_bella', speed);
    }

    throw error;
  });
  const audioResponse = await fetch(audioUrl);

  return proxyAudioResponse(audioResponse, 'audio/wav');
}

async function requestHfSpaceAudioUrl(
  hfSpaceUrl: string,
  text: string,
  voice: string,
  speed: number,
): Promise<string> {
  const legacyAudioUrl = await requestLegacyHfSpaceAudioUrl(hfSpaceUrl, text, voice, speed).catch(() => null);

  if (legacyAudioUrl) {
    return legacyAudioUrl;
  }

  return requestQueuedHfSpaceAudioUrl(hfSpaceUrl, text, voice, speed);
}

async function requestLegacyHfSpaceAudioUrl(
  hfSpaceUrl: string,
  text: string,
  voice: string,
  speed: number,
): Promise<string> {
  const response = await fetch(hfSpaceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [text, voice, speed],
    }),
  });

  if (!response.ok) {
    throw new Error(`HF Kokoro Space impossible: HTTP ${response.status}`);
  }

  const data = (await response.json()) as HfSpaceResponse;
  return extractHfSpaceAudioUrl(data, hfSpaceUrl);
}

async function requestQueuedHfSpaceAudioUrl(
  hfSpaceUrl: string,
  text: string,
  voice: string,
  speed: number,
): Promise<string> {
  const baseUrl = new URL(hfSpaceUrl).origin;
  const sessionHash = `italpro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const joinResponse = await fetch(`${baseUrl}/gradio_api/queue/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [text, voice, speed, true],
      event_data: null,
      fn_index: 4,
      trigger_id: 2,
      session_hash: sessionHash,
    }),
  });

  if (!joinResponse.ok) {
    throw new Error(`File HF Kokoro impossible: HTTP ${joinResponse.status}`);
  }

  const joinData = (await joinResponse.json()) as HfSpaceQueueJoinResponse;

  if (!joinData.event_id) {
    throw new Error('Event HF Kokoro absent.');
  }

  const eventResponse = await fetch(`${baseUrl}/gradio_api/queue/data?session_hash=${sessionHash}`);

  if (!eventResponse.ok) {
    throw new Error(`Lecture file HF Kokoro impossible: HTTP ${eventResponse.status}`);
  }

  return extractAudioUrlFromQueueEvents(await eventResponse.text(), baseUrl);
}

async function synthesizeWithHfInference(body: TtsRequest, text: string): Promise<Response> {
  const hfToken = process.env.HF_TOKEN ?? process.env.EXPO_PUBLIC_HF_TOKEN;

  if (!hfToken) {
    return Response.json({ error: 'HF_TOKEN manquant cote serveur.' }, { status: 503, headers: corsHeaders });
  }

  const response = await fetch(
    process.env.HF_KOKORO_MODEL_URL ??
      process.env.EXPO_PUBLIC_HF_KOKORO_MODEL_URL ??
      'https://api-inference.huggingface.co/models/hexgrad/Kokoro-82M',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          voice: body.voice ?? getDefaultVoice(),
          speed: normalizeSpeed(body.speed),
        },
      }),
    },
  );

  return proxyAudioResponse(response, 'audio/wav');
}

async function synthesizeWithSelfHostedKokoro(body: TtsRequest, text: string): Promise<Response> {
  const kokoroBaseUrl = process.env.KOKORO_TTS_BASE_URL ?? process.env.KOKORO_TTS_URL;

  if (!kokoroBaseUrl) {
    return Response.json({ error: 'KOKORO_TTS_BASE_URL manquant cote serveur.' }, { status: 503, headers: corsHeaders });
  }

  const response = await fetch(resolveKokoroSpeechUrl(kokoroBaseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.KOKORO_TTS_MODEL ?? 'kokoro',
      input: text,
      voice: body.voice ?? getDefaultVoice(),
      response_format: body.responseFormat ?? process.env.KOKORO_TTS_RESPONSE_FORMAT ?? 'mp3',
      speed: normalizeSpeed(body.speed),
    }),
  });

  return proxyAudioResponse(response, 'audio/mpeg');
}

async function proxyAudioResponse(response: Response, fallbackContentType: string): Promise<Response> {
  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      { error: 'Kokoro TTS a refuse la requete.', detail },
      { status: response.status, headers: corsHeaders },
    );
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': response.headers.get('Content-Type') ?? fallbackContentType,
      'Cache-Control': 'no-store',
    },
  });
}

function resolveKokoroSpeechUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '');

  if (normalized.endsWith('/audio/speech')) {
    return normalized;
  }

  return `${normalized}/audio/speech`;
}

function getDefaultVoice(): string {
  return (
    process.env.KOKORO_TTS_VOICE ??
    process.env.EXPO_PUBLIC_KOKORO_TTS_VOICE ??
    process.env.EXPO_PUBLIC_HF_KOKORO_VOICE ??
    'if_sara'
  );
}

function normalizeSpeed(speed?: number): number {
  const fallback = Number(process.env.KOKORO_TTS_SPEED ?? process.env.EXPO_PUBLIC_KOKORO_TTS_SPEED ?? '1');
  const value = speed ?? fallback;

  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(2, Math.max(0.5, value));
}

function extractHfSpaceAudioUrl(response: HfSpaceResponse, baseUrl: string): string {
  const candidate = response.data?.[1] as HfSpaceAudioValue | undefined;

  if (typeof candidate === 'string' && candidate.length > 0) {
    return candidate;
  }

  if (typeof candidate === 'object' && candidate !== null) {
    if (candidate.url) {
      return candidate.url;
    }

    if (candidate.path) {
      return candidate.path.startsWith('http') ? candidate.path : new URL(candidate.path, baseUrl).toString();
    }
  }

  throw new Error('URL audio Kokoro introuvable dans la reponse Hugging Face.');
}

function extractAudioUrlFromQueueEvents(eventText: string, baseUrl: string): string {
  const events = eventText
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as HfSpaceQueueEvent);
  const completed = events.find((event) => event.msg === 'process_completed');

  if (!completed) {
    throw new Error('Generation HF Kokoro non terminee.');
  }

  if (completed.success === false) {
    throw new Error(completed.output?.error ?? 'Generation HF Kokoro refusee.');
  }

  return extractGeneratedAudioUrl(completed.output?.data, baseUrl);
}

function extractGeneratedAudioUrl(data: unknown[] | undefined, baseUrl: string): string {
  const first = data?.[0] as HfSpaceAudioValue | undefined;

  if (typeof first === 'string' && first.length > 0) {
    return first;
  }

  if (typeof first === 'object' && first !== null) {
    if (first.url) {
      return first.url;
    }

    if (first.path) {
      return first.path.startsWith('http') ? first.path : new URL(first.path, baseUrl).toString();
    }
  }

  return extractHfSpaceAudioUrl({ data }, baseUrl);
}

function isUnavailableVoiceError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('not in the list of choices');
}
