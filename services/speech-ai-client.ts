const configuredApiUrl =
  process.env.EXPO_PUBLIC_ITALPRO_API_URL ?? process.env.EXPO_PUBLIC_ITALPRO_AI_URL;
const hfSpaceUrl =
  process.env.EXPO_PUBLIC_HF_KOKORO_SPACE_URL ?? 'https://hexgrad-kokoro-tts.hf.space/api/predict';
const hfModelUrl =
  process.env.EXPO_PUBLIC_HF_KOKORO_MODEL_URL ??
  'https://api-inference.huggingface.co/models/hexgrad/Kokoro-82M';
const hfToken = process.env.EXPO_PUBLIC_HF_TOKEN;
const kokoroProvider = process.env.EXPO_PUBLIC_KOKORO_PROVIDER ?? 'hf-space';
const defaultKokoroVoice =
  process.env.EXPO_PUBLIC_KOKORO_TTS_VOICE ?? process.env.EXPO_PUBLIC_HF_KOKORO_VOICE ?? 'if_sara';
const defaultKokoroSpeed = Number(process.env.EXPO_PUBLIC_KOKORO_TTS_SPEED ?? '1');

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

function getApiBaseUrl(): string | null {
  if (configuredApiUrl && configuredApiUrl.trim().length > 0) {
    return configuredApiUrl.replace(/\/$/, '');
  }

  return process.env.EXPO_OS === 'web' ? '/api' : null;
}

export type TranscriptionResult = {
  text: string;
  language?: string;
  duration?: number;
};

export type AudioFileInput = {
  uri: string;
  name: string;
  mimeType: string;
};

export type KokoroSpeechResult = {
  audio: ArrayBuffer;
  contentType: string;
};

export function hasSpeechProxy(): boolean {
  return getApiBaseUrl() !== null;
}

export async function transcribeAudioWithGroq(input: {
  file: AudioFileInput;
  language?: string;
  prompt?: string;
}): Promise<TranscriptionResult> {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_ITALPRO_API_URL est requis pour la transcription.');
  }

  const formData = new FormData();
  formData.append('file', {
    uri: input.file.uri,
    name: input.file.name,
    type: input.file.mimeType,
  } as unknown as Blob);

  if (input.language) {
    formData.append('language', input.language);
  }

  if (input.prompt) {
    formData.append('prompt', input.prompt);
  }

  const response = await fetch(`${apiBaseUrl}/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Transcription Groq impossible: HTTP ${response.status}`);
  }

  return (await response.json()) as TranscriptionResult;
}

export async function synthesizeWithKokoro(input: {
  text: string;
  voice?: string;
  speed?: number;
  responseFormat?: 'mp3' | 'wav' | 'opus' | 'flac';
}): Promise<KokoroSpeechResult> {
  const apiBaseUrl = getApiBaseUrl();

  if (apiBaseUrl) {
    const response = await fetch(`${apiBaseUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Synthese Kokoro impossible: HTTP ${response.status}`);
    }

    return {
      audio: await response.arrayBuffer(),
      contentType: response.headers.get('Content-Type') ?? 'audio/mpeg',
    };
  }

  if (kokoroProvider === 'hf-inference') {
    return synthesizeWithHfInference(input);
  }

  return synthesizeWithHfSpace(input);
}

async function synthesizeWithHfSpace(input: {
  text: string;
  voice?: string;
  speed?: number;
}): Promise<KokoroSpeechResult> {
  const requestedVoice = input.voice ?? defaultKokoroVoice;
  const speed = normalizeSpeed(input.speed);
  const audioUrl = await requestHfSpaceAudioUrl(input.text, requestedVoice, speed).catch(async (error) => {
    if (requestedVoice !== 'af_bella' && isUnavailableVoiceError(error)) {
      return requestHfSpaceAudioUrl(input.text, 'af_bella', speed);
    }

    throw error;
  });
  const audioResponse = await fetch(audioUrl);

  if (!audioResponse.ok) {
    throw new Error(`Audio HF Kokoro indisponible: HTTP ${audioResponse.status}`);
  }

  return {
    audio: await audioResponse.arrayBuffer(),
    contentType: audioResponse.headers.get('Content-Type') ?? 'audio/wav',
  };
}

async function requestHfSpaceAudioUrl(text: string, voice: string, speed: number): Promise<string> {
  const legacyAudioUrl = await requestLegacyHfSpaceAudioUrl(text, voice, speed).catch(() => null);

  if (legacyAudioUrl) {
    return legacyAudioUrl;
  }

  return requestQueuedHfSpaceAudioUrl(text, voice, speed);
}

async function requestLegacyHfSpaceAudioUrl(text: string, voice: string, speed: number): Promise<string> {
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

async function requestQueuedHfSpaceAudioUrl(text: string, voice: string, speed: number): Promise<string> {
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

async function synthesizeWithHfInference(input: {
  text: string;
  voice?: string;
  speed?: number;
}): Promise<KokoroSpeechResult> {
  if (!hfToken) {
    throw new Error('EXPO_PUBLIC_HF_TOKEN est requis pour HF Inference API.');
  }

  const response = await fetch(hfModelUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: input.text,
      parameters: {
        voice: input.voice ?? defaultKokoroVoice,
        speed: normalizeSpeed(input.speed),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HF Kokoro Inference impossible: HTTP ${response.status}`);
  }

  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get('Content-Type') ?? 'audio/wav',
  };
}

function normalizeSpeed(speed?: number): number {
  const value = speed ?? defaultKokoroSpeed;

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
