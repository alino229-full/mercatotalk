import type { GrammarDrill, LessonDetail, VocabItem } from '@/data/lessons';

/**
 * Generates a varied, animated quiz from a lesson's vocabulary.
 *
 * Five question archetypes are produced and interleaved so the learner never
 * faces a monotonous "translate this word" drill:
 *  - `translate`  : Italian prompt → pick the French meaning (classic QCM)
 *  - `listen`     : TTS plays the Italian → pick what was heard
 *  - `match`      : connect 4 Italian ↔ French pairs
 *  - `build`      : reorder shuffled tiles to rebuild a sentence
 *  - `type`       : type the French translation under a timer (hardest)
 *
 * The mix is biased toward the harder archetypes once enough vocabulary is
 * available, so a lesson quiz is never "too easy".
 */

export type QuizQuestionType =
  | 'translate'
  | 'listen'
  | 'match'
  | 'build'
  | 'type'
  | 'ending-choice'
  | 'cloze'
  | 'agreement-table';

type BaseQuestion = {
  id: string;
  type: QuizQuestionType;
  /** Italian text to optionally speak via TTS. */
  speakText?: string;
};

export type TranslateQuestion = BaseQuestion & {
  type: 'translate';
  prompt: string;
  phonetic?: string;
  correct: string;
  choices: string[];
};

export type ListenQuestion = BaseQuestion & {
  type: 'listen';
  /** The Italian audio to identify. */
  audio: string;
  correct: string;
  choices: string[];
};

export type MatchPair = { id: string; it: string; fr: string };

export type MatchQuestion = BaseQuestion & {
  type: 'match';
  pairs: MatchPair[];
};

export type BuildQuestion = BaseQuestion & {
  type: 'build';
  /** Reference sentence in Italian. */
  sentence: string;
  /** Correct ordered tokens. */
  solution: string[];
  /** Shuffled tokens shown to the learner. */
  tiles: string[];
  translation?: string;
};

export type TypeQuestion = BaseQuestion & {
  type: 'type';
  prompt: string;
  phonetic?: string;
  /** Accepted answers, normalised at compare time. */
  accepted: string[];
  timerSeconds: number;
};

export type EndingChoiceQuestion = BaseQuestion & {
  type: 'ending-choice';
  title: string;
  prompt: string;
  before: string;
  after?: string;
  correct: string;
  choices: string[];
  translation?: string;
  explanation: string;
};

export type ClozeQuestion = BaseQuestion & {
  type: 'cloze';
  title: string;
  prompt: string;
  before: string;
  after: string;
  correct: string;
  choices: string[];
  translation?: string;
  explanation: string;
};

export type AgreementTableQuestion = BaseQuestion & {
  type: 'agreement-table';
  title: string;
  prompt: string;
  choices: string[];
  rows: Array<{
    id: string;
    before: string;
    after?: string;
    correct: string;
    translation?: string;
  }>;
  explanation: string;
};

export type QuizQuestion =
  | TranslateQuestion
  | ListenQuestion
  | MatchQuestion
  | BuildQuestion
  | TypeQuestion
  | EndingChoiceQuestion
  | ClozeQuestion
  | AgreementTableQuestion;

// ─── Helpers ────────────────────────────────────────────────────────────────

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Normalises an answer for tolerant comparison (case, accents, punctuation). */
export function normaliseAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/\s*\/\s*/g, '/')
    .replace(/[.,!?;:'"()\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strips pedagogical annotations like "maison — C dur [k]" → "maison". */
function cleanMeaning(fr: string): string {
  return fr.split('—')[0]!.split(' - ')[0]!.trim();
}

/** Removes parenthetical/bracket annotations and trailing notes. */
function stripAnnotations(value: string): string {
  return value
    .replace(/\s*\([^)]*\)/g, '')   // (…)
    .replace(/\s*\[[^\]]*\]/g, '')  // […]
    .split('—')[0]!
    .split(' - ')[0]!;
}

/**
 * Italian text to speak / show as the canonical answer: annotations removed and
 * reduced to the FIRST variant. "adesso / ora" → "adesso", "entro (+ duree)" → "entro".
 */
export function speakableIt(it: string): string {
  return stripAnnotations(it)
    // "a / b" → "a, b" : lit les deux variantes avec une courte pause, sans
    // prononcer le slash.
    .replace(/\s*\/\s*/g, ', ')
    // Recolle les tirets de syllabification (aide visuelle, pas à prononcer) :
    // "pa-ne" → "pane", "uni-ver-si-ta'" → "università".
    .replace(/(\p{L})-(\p{L})/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Every accepted Italian spelling for free typing: each "/" alternative and the
 * full cleaned form, plus a typographic-apostrophe variant. "adesso / ora"
 * accepts both "adesso" and "ora".
 */
function acceptedItVariants(it: string): string[] {
  const base = stripAnnotations(it);
  const variants = new Set<string>();
  const add = (t: string) => {
    const v = t.replace(/\s+/g, ' ').trim();
    if (v) {
      variants.add(v);
      variants.add(v.replace(/'/g, '’'));
    }
  };
  for (const part of base.split('/')) add(part);
  add(base); // also accept the full "adesso / ora" if typed entirely
  return Array.from(variants);
}

function isUsable(item: VocabItem): boolean {
  return Boolean(item.it?.trim()) && Boolean(item.fr?.trim());
}

function pickDistractors(pool: string[], exclude: string, count: number): string[] {
  const unique = Array.from(new Set(pool.filter((value) => value !== exclude)));
  return shuffle(unique).slice(0, count);
}

function tokenizeSentence(sentence: string): string[] {
  return sentence
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((token) => token.length > 0);
}

function drillToQuestion(lessonId: string, drill: GrammarDrill): QuizQuestion {
  if (drill.type === 'ending-choice') {
    return {
      id: `${lessonId}-${drill.id}`,
      type: 'ending-choice',
      title: drill.title,
      prompt: drill.prompt,
      before: drill.before,
      after: drill.after,
      correct: drill.answer,
      choices: shuffle(drill.choices),
      translation: drill.translation,
      explanation: drill.explanation,
      speakText: drill.speakText,
    };
  }

  if (drill.type === 'cloze') {
    return {
      id: `${lessonId}-${drill.id}`,
      type: 'cloze',
      title: drill.title,
      prompt: drill.prompt,
      before: drill.before,
      after: drill.after,
      correct: drill.answer,
      choices: shuffle(drill.choices),
      translation: drill.translation,
      explanation: drill.explanation,
      speakText: drill.speakText,
    };
  }

  return {
    id: `${lessonId}-${drill.id}`,
    type: 'agreement-table',
    title: drill.title,
    prompt: drill.prompt,
    choices: drill.choices,
    rows: drill.rows.map((row) => ({
      id: row.id,
      before: row.before,
      after: row.after,
      correct: row.answer,
      translation: row.translation,
    })),
    explanation: drill.explanation,
    speakText: drill.speakText,
  };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildLessonQuiz(lesson: LessonDetail): QuizQuestion[] {
  const vocab = lesson.vocab.filter(isUsable);
  const drillQuestions = (lesson.drills ?? []).map((drill) => drillToQuestion(lesson.id, drill));
  if (vocab.length === 0) return drillQuestions;

  const frPool = vocab.map((v) => cleanMeaning(v.fr));
  const itPool = vocab.map((v) => v.it.trim());
  const questions: QuizQuestion[] = [...drillQuestions];

  // Candidate sentences for "build" questions (short, multi-word examples).
  const sentenceItems = vocab.filter((v) => {
    if (!v.example) return false;
    const tokens = tokenizeSentence(v.example);
    return tokens.length >= 3 && tokens.length <= 8;
  });

  // 1 — Match question (always first if we have ≥3 pairs; warm, satisfying start).
  if (vocab.length >= 3) {
    const sample = shuffle(vocab).slice(0, Math.min(4, vocab.length));
    questions.push({
      id: `${lesson.id}-match`,
      type: 'match',
      pairs: sample.map((v, i) => ({ id: `${lesson.id}-pair-${i}`, it: v.it.trim(), fr: cleanMeaning(v.fr) })),
    });
  }

  // 2 — One build question if a clean sentence exists.
  if (sentenceItems.length > 0) {
    const picked = shuffle(sentenceItems)[0]!;
    const solution = tokenizeSentence(picked.example!);
    questions.push({
      id: `${lesson.id}-build`,
      type: 'build',
      sentence: picked.example!,
      solution,
      tiles: shuffle(solution),
      translation: cleanMeaning(picked.fr),
      speakText: picked.example,
    });
  }

  // 3 — Core item questions: alternate translate / listen / type.
  const coreItems = shuffle(vocab).slice(0, 6);
  coreItems.forEach((item, index) => {
    const correct = cleanMeaning(item.fr);
    const it = item.it.trim();
    const mod = index % 3;

    if (mod === 0) {
      questions.push({
        id: `${lesson.id}-tr-${index}`,
        type: 'translate',
        prompt: it,
        phonetic: item.phonetic,
        correct,
        choices: shuffle([correct, ...pickDistractors(frPool, correct, 3)]),
        speakText: speakableIt(it),
      });
    } else if (mod === 1) {
      questions.push({
        id: `${lesson.id}-ls-${index}`,
        type: 'listen',
        audio: speakableIt(it),
        correct,
        choices: shuffle([correct, ...pickDistractors(frPool, correct, 3)]),
        speakText: speakableIt(it),
      });
    } else {
      // Harder: free typing with timer. Accept every Italian variant.
      questions.push({
        id: `${lesson.id}-ty-${index}`,
        type: 'type',
        prompt: correct,
        phonetic: item.phonetic,
        accepted: acceptedItVariants(it),
        timerSeconds: 25,
        speakText: speakableIt(it),
      });
    }
  });

  // Guarantee variety/length: at least 5 questions when vocab allows.
  if (questions.length < 5 && itPool.length >= 4) {
    const extra = shuffle(vocab).slice(0, 5 - questions.length);
    extra.forEach((item, i) => {
      const correct = cleanMeaning(item.fr);
      questions.push({
        id: `${lesson.id}-extra-${i}`,
        type: 'translate',
        prompt: item.it.trim(),
        phonetic: item.phonetic,
        correct,
        choices: shuffle([correct, ...pickDistractors(frPool, correct, 3)]),
        speakText: speakableIt(item.it),
      });
    });
  }

  return questions;
}
