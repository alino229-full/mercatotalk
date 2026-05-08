import type { DialogueMessageRow, ScenarioRow } from '@/database/italpro-local-db';
import type { B2BMood } from '@/data/b2b-operational';
import { getExpoApiBaseUrl } from '@/services/api-base-url';
import type { GuidedChoiceQuality, LocalClientReply, LocalCorrection } from '@/services/local-dialogue-engine';

export type DialogueAiTurn = {
  correction: LocalCorrection;
  clientReply: LocalClientReply;
};

type DialogueAiResponse = {
  correction?: Partial<LocalCorrection>;
  clientReply?: Partial<LocalClientReply>;
};

const configuredApiUrl =
  process.env.EXPO_PUBLIC_ITALPRO_API_URL ?? process.env.EXPO_PUBLIC_ITALPRO_AI_URL;

function getApiBaseUrl(): string | null {
  return getExpoApiBaseUrl(configuredApiUrl);
}

function isValidAiTurn(value: DialogueAiResponse): value is {
  correction: LocalCorrection;
  clientReply: LocalClientReply;
} {
  return (
    typeof value.correction?.score === 'number' &&
    typeof value.correction.correctedIt === 'string' &&
    typeof value.correction.feedbackFr === 'string' &&
    Array.isArray(value.correction.nextFocus) &&
    typeof value.clientReply?.contentIt === 'string' &&
    typeof value.clientReply.contentFr === 'string' &&
    typeof value.clientReply.coachingNote === 'string'
  );
}

export function hasRemoteDialogueAi(): boolean {
  return getApiBaseUrl() !== null;
}

export async function requestDialogueAiTurn(input: {
  scenario: ScenarioRow;
  learnerReply: string;
  history: DialogueMessageRow[];
  mood?: B2BMood;
  guidedChoiceQuality?: GuidedChoiceQuality;
}): Promise<DialogueAiTurn | null> {
  if (!hasRemoteDialogueAi()) {
    return null;
  }

  const apiBaseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${apiBaseUrl}/dialogue-turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`IA HTTP ${response.status}`);
    }

    const data = (await response.json()) as DialogueAiResponse;

    if (!isValidAiTurn(data)) {
      throw new Error('Reponse IA invalide.');
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}
