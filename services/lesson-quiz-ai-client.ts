import type { LessonDetail } from '@/data/lessons';
import type { QuizQuestion } from '@/services/lesson-quiz-builder';
import { getExpoApiBaseUrl } from '@/services/api-base-url';

const configuredApiUrl = process.env.EXPO_PUBLIC_ITALPRO_API_URL ?? '';

function getLessonQuizVariationUrl(): string | null {
  const apiBaseUrl = getExpoApiBaseUrl(configuredApiUrl);
  return apiBaseUrl ? `${apiBaseUrl}/lesson-quiz-variations` : null;
}

function compactLessonForAi(lesson: LessonDetail) {
  return {
    id: lesson.id,
    title: lesson.title,
    grammarTip: lesson.grammarTip,
    concepts: lesson.concepts?.map((concept) => ({
      title: concept.title,
      rule: concept.rule,
      why: concept.why,
      pattern: concept.pattern,
      examples: concept.examples.slice(0, 3),
    })),
    drills: lesson.drills?.slice(0, 4),
    vocab: lesson.vocab.slice(0, 10).map((item) => ({
      it: item.it,
      fr: item.fr,
      example: item.example,
    })),
  };
}

export async function fetchLessonQuizVariations(
  lesson: LessonDetail,
  count = 5,
): Promise<QuizQuestion[] | null> {
  const url = getLessonQuizVariationUrl();
  if (!url) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lesson: compactLessonForAi(lesson),
        count,
        seed: `${lesson.id}-${Date.now()}-${Math.round(Math.random() * 100_000)}`,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = (await response.json()) as { questions?: QuizQuestion[] };
    if (!Array.isArray(data.questions) || data.questions.length < 2) return null;
    return data.questions;
  } catch {
    return null;
  }
}

export function hasLessonQuizAiAvailable(): boolean {
  return getLessonQuizVariationUrl() !== null;
}
