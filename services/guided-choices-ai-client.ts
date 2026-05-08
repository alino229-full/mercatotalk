import type { DialogueMessageRow, ScenarioRow } from '@/database/italpro-local-db';
import type { B2BMood } from '@/data/b2b-operational';
import { getExpoApiBaseUrl } from '@/services/api-base-url';
import type { GuidedChoiceQuality } from '@/services/local-dialogue-engine';

export type GuidedReplyChoice = {
  id: string;
  text: string;
  quality: GuidedChoiceQuality;
};

type GuidedChoicesResponse = {
  choices?: Partial<GuidedReplyChoice>[];
};

const configuredApiUrl =
  process.env.EXPO_PUBLIC_ITALPRO_API_URL ?? process.env.EXPO_PUBLIC_ITALPRO_AI_URL;

function getApiBaseUrl(): string | null {
  return getExpoApiBaseUrl(configuredApiUrl);
}

function normalizeChoices(value: GuidedChoicesResponse): GuidedReplyChoice[] | null {
  if (!Array.isArray(value.choices)) return null;

  const choices = value.choices
    .filter((choice): choice is GuidedReplyChoice =>
      typeof choice.id === 'string' &&
      typeof choice.text === 'string' &&
      (choice.quality === 'best' || choice.quality === 'approx' || choice.quality === 'wrong'),
    )
    .slice(0, 4);

  const qualityCount = {
    best: choices.filter((choice) => choice.quality === 'best').length,
    approx: choices.filter((choice) => choice.quality === 'approx').length,
    wrong: choices.filter((choice) => choice.quality === 'wrong').length,
  };

  if (choices.length !== 4 || qualityCount.best !== 1 || qualityCount.approx !== 1 || qualityCount.wrong !== 2) {
    return null;
  }

  return choices;
}

export async function requestGuidedReplyChoices(input: {
  scenario: ScenarioRow;
  latestClientMessage: DialogueMessageRow;
  history: DialogueMessageRow[];
  mood?: B2BMood;
}): Promise<GuidedReplyChoice[] | null> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${apiBaseUrl}/guided-choices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Guided choices HTTP ${response.status}`);
    }

    const data = (await response.json()) as GuidedChoicesResponse;
    return normalizeChoices(data);
  } finally {
    clearTimeout(timeoutId);
  }
}
