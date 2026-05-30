import { getExpoApiBaseUrl } from '@/services/api-base-url';

const configuredApiUrl =
  process.env.EXPO_PUBLIC_ITALPRO_API_URL ?? process.env.EXPO_PUBLIC_ITALPRO_AI_URL;

function getApiBaseUrl(): string | null {
  return getExpoApiBaseUrl(configuredApiUrl);
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
