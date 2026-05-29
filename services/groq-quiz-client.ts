/**
 * Fetches AI-generated quiz items from the Groq proxy route.
 * Falls back silently to [] if the route is unavailable.
 */

import type { QuizBankItem } from '@/data/quiz-bank';
import { getExpoApiBaseUrl } from '@/services/api-base-url';

const configuredApiUrl = process.env.EXPO_PUBLIC_ITALPRO_API_URL ?? '';

function getQuizApiUrl(): string | null {
  const apiBaseUrl = getExpoApiBaseUrl(configuredApiUrl);
  return apiBaseUrl ? `${apiBaseUrl}/quiz-questions` : null;
}

export type GroqQuizRequest = {
  weakCategories?: string[];
  recentScore?: number;
  count?: number;
};

/**
 * Requests AI-generated quiz items from Groq via the server proxy.
 * Returns null if the proxy is not configured or the request fails.
 */
export async function fetchGroqQuizItems(params: GroqQuizRequest): Promise<QuizBankItem[] | null> {
  const url = getQuizApiUrl();
  if (!url) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as { items?: QuizBankItem[] };
    const items = data.items;

    if (!Array.isArray(items) || items.length < 4) return null;
    return items;
  } catch {
    return null;
  }
}

export function hasGroqQuizAvailable(): boolean {
  return getQuizApiUrl() !== null;
}
