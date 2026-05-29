import type { LessonDetail, VocabItem } from '@/data/lessons';

export type QuizQuestion = {
  prompt: string;
  correct: string;
  choices: string[];
};

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function buildQuestion(item: VocabItem, pool: VocabItem[]): QuizQuestion {
  const distractors = shuffle(pool.filter((c) => c.fr !== item.fr))
    .slice(0, 3)
    .map((c) => c.fr);
  return {
    prompt: item.it,
    correct: item.fr,
    choices: shuffle([item.fr, ...distractors]).slice(0, 4),
  };
}

/** Quiz de validation d'une leçon (max 5 questions). */
export function buildLessonQuiz(lesson: LessonDetail): QuizQuestion[] {
  const items = lesson.vocab.filter((i) => i.it.trim() && i.fr.trim());
  return items.slice(0, 5).map((item) => buildQuestion(item, items));
}

/**
 * Quiz de checkpoint: agrège le vocabulaire de plusieurs leçons d'un chapitre.
 * Sélectionne jusqu'à 10 questions réparties sur l'ensemble.
 */
export function buildCheckpointQuiz(lessons: LessonDetail[], max = 10): QuizQuestion[] {
  const pool = lessons
    .flatMap((l) => l.vocab)
    .filter((i) => i.it.trim() && i.fr.trim());
  if (pool.length === 0) return [];
  const picked = shuffle(pool).slice(0, Math.min(max, pool.length));
  return picked.map((item) => buildQuestion(item, pool));
}
