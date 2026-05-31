import { useCallback, useEffect, useRef, useState } from 'react';

import { getAllQuizItems, type QuizBankItem } from '@/data/quiz-bank';
import {
  addXp,
  getAllCards,
  insertLearningSession,
  unlockAchievement,
  updateCardAfterReview,
  getDueCards,
  getCachedQuizItems,
  insertCachedQuizItems,
} from '@/database/italpro-local-db';
import { fetchGroqQuizItems } from '@/services/groq-quiz-client';
import { errorFeedback, successFeedback, warningFeedback } from '@/services/haptics';
import { speakIt, stopIt } from '@/services/italian-tts';
import { playQuizSound, preloadQuizSounds } from '@/services/quiz-sounds';
import { transcribeLocalAudio } from '@/services/transcription-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionType = 'it_to_fr' | 'fr_to_it' | 'listen_to_fr' | 'dictation';

export type QuizChoice = { id: string; label: string };

export type QuizQuestion = {
  uid: string;
  type: QuestionType;
  prompt: string;
  choices: QuizChoice[];
  correctId: string;
  it: string;
  fr: string;
  phonetic?: string | null;
  category: string;
  explanation?: string;
  sm2CardId?: string;
};

export type QuizAnswerState = 'unanswered' | 'correct' | 'wrong';

export type QuizResult = {
  correct: boolean;
  question: QuizQuestion;
  selectedId: string;
};

export type QuizSource = 'local' | 'groq' | 'mixed';

export type QuizSessionOptions = {
  seriesSize?: number;
};

export type QuizSessionState = {
  questions: QuizQuestion[];
  currentIndex: number;
  totalInSeries: number;
  answerState: QuizAnswerState;
  selectedId: string | null;
  results: QuizResult[];
  isSeriesDone: boolean;
  isLoading: boolean;
  isGroqLoading: boolean;
  source: QuizSource;
  totalItems: number;
  timeLeft: number;
  timeLimit: number;
  timerProgress: number;
  lastXpAward: number | null;
  totalXpAwarded: number;
  hasStarted: boolean;
  isPaused: boolean;
  /** Consecutive correct answers in the current series */
  combo: number;
  /** 1 normally, 2 when combo >= 3 */
  comboMultiplier: number;
  /** Hard mode: user types the answer instead of choosing */
  hardMode: boolean;
  isTranscribing: boolean;
  startSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  playAudio: () => void;
  selectChoice: (id: string) => void;
  skipQuestion: () => void;
  goToNextQuestion: () => void;
  submitTypedAnswer: (text: string) => void;
  submitVoiceAnswer: (uri: string) => Promise<string | null>;
  toggleHardMode: () => void;
  startNewSeries: () => Promise<void>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SERIES_SIZE = 20;
const AUTO_ADVANCE_MS = 1100;
const WRONG_ANSWER_ADVANCE_MS = 4600;
const DEFAULT_QUESTION_TIME_SECONDS = 15;
const MAX_TYPING_TIME_SECONDS = 90;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Nettoie une chaîne d'affichage de quiz :
 *  - retire les annotations pédagogiques entre parenthèses  ex: "ce / cette (pres du locuteur)" → "ce / cette"
 *  - retire les annotations après tiret cadratin            ex: "maison — C dur [k]" → "maison"
 *  - retire les transcriptions phonétiques entre crochets   ex: "casa [k]" → "casa"
 * Les slashs (variantes de genre/conjugaison) sont conservés volontairement.
 */
function cleanQuizText(value: string): string {
  return value
    .replace(/\s*\([^)]*\)/g, '')   // (…)
    .replace(/\s*\[[^\]]*\]/g, '')  // […]
    .split('—')[0]!
    .split(' - ')[0]!
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Texte à prononcer : nettoyé puis réduit à la PREMIÈRE variante.
 * On ne lit jamais "adesso / ora" ni "(+ duree)" à voix haute.
 */
function speakableText(value: string): string {
  return cleanQuizText(value)
    // "a / b" → "a, b" : lit les deux variantes avec une courte pause, sans
    // prononcer le slash.
    .replace(/\s*\/\s*/g, ', ')
    // Recolle les tirets de syllabification ("pa-ne" → "pane").
    .replace(/(\p{L})-(\p{L})/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Variantes acceptées en saisie libre : chaque alternative séparée par "/",
 * plus la chaîne complète nettoyée. Ex: "adesso / ora" → {"adesso", "ora", "adesso / ora"}.
 */
function acceptedAnswers(label: string): Set<string> {
  const variants = new Set<string>();
  const full = normalizeAnswer(label);
  if (full) variants.add(full);
  for (const part of label.split('/')) {
    const n = normalizeAnswer(part);
    if (n) variants.add(n);
  }
  return variants;
}

/**
 * Sélectionne 3 distracteurs cohérents : d'abord dans la MÊME catégorie
 * (questions plus crédibles), puis complète avec d'autres si besoin.
 */
function pickCoherentDistractors(item: QuizBankItem, pool: QuizBankItem[]): QuizBankItem[] {
  const sameCat = pool.filter((p) => p.id !== item.id && p.category === item.category);
  const otherCat = pool.filter((p) => p.id !== item.id && p.category !== item.category);
  return [...shuffle(sameCat), ...shuffle(otherCat)].slice(0, 3);
}

function randomType(): QuestionType {
  const r = Math.random();
  if (r < 0.30) return 'it_to_fr';
  if (r < 0.60) return 'fr_to_it';
  if (r < 0.80) return 'listen_to_fr';
  return 'dictation';
}

function buildQuestion(item: QuizBankItem, type: QuestionType, pool: QuizBankItem[]): QuizQuestion {
  const uid = `${item.id}-${type}-${Math.random()}`;
  const wrong = pickCoherentDistractors(item, pool);
  const sm2CardId = item.id.startsWith('sm2-') ? item.id.slice(4) : undefined;

  const itClean = cleanQuizText(item.it);
  const frClean = cleanQuizText(item.fr);

  if (type === 'fr_to_it' || type === 'dictation') {
    const correct: QuizChoice = { id: item.id, label: itClean };
    const choices = dedupeChoices(
      shuffle([correct, ...wrong.map((w) => ({ id: w.id, label: cleanQuizText(w.it) }))]),
    );
    return {
      uid,
      type,
      prompt: type === 'fr_to_it' ? frClean : itClean,
      choices,
      correctId: item.id,
      it: item.it,
      fr: item.fr,
      phonetic: item.phonetic,
      category: item.category,
      explanation: item.explanation,
      sm2CardId,
    };
  }

  const correct: QuizChoice = { id: item.id, label: frClean };
  const choices = dedupeChoices(
    shuffle([correct, ...wrong.map((w) => ({ id: w.id, label: cleanQuizText(w.fr) }))]),
  );
  return { uid, type, prompt: itClean, choices, correctId: item.id, it: item.it, fr: item.fr, phonetic: item.phonetic, category: item.category, explanation: item.explanation, sm2CardId };
}

/** Évite deux choix identiques après nettoyage (sinon réponse ambiguë). */
function dedupeChoices(choices: QuizChoice[]): QuizChoice[] {
  const seen = new Set<string>();
  const out: QuizChoice[] = [];
  for (const c of choices) {
    const key = c.label.toLowerCase();
    if (c.label.trim().length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function buildSeries(pool: QuizBankItem[], size: number, dueItems: QuizBankItem[] = []): QuizQuestion[] {
  if (pool.length < 4) return [];
  // Prioritize due items first
  const pickedDue = shuffle(dueItems).slice(0, size);
  const remainingSize = size - pickedDue.length;

  const dueIds = new Set(pickedDue.map((d) => d.id));
  const remainingPool = pool.filter((p) => !dueIds.has(p.id));

  const pickedRemaining = shuffle(remainingPool).slice(0, remainingSize);
  const picked = [...pickedDue, ...pickedRemaining];

  return picked
    .map((item) => buildQuestion(item, randomType(), pool))
    .filter((question) => question.choices.length >= 4);
}

function detectWeakCategories(results: QuizResult[]): string[] {
  const catStats: Record<string, { correct: number; total: number }> = {};
  for (const r of results) {
    const cat = r.question.category;
    if (!catStats[cat]) catStats[cat] = { correct: 0, total: 0 };
    catStats[cat]!.total += 1;
    if (r.correct) catStats[cat]!.correct += 1;
  }
  return Object.entries(catStats)
    .filter(([, s]) => s.total >= 2 && s.correct / s.total < 0.6)
    .map(([cat]) => cat);
}

function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/\s*\/\s*/g, '/')
    .replace(/[?!.,;:¡¿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getExpectedAnswerText(question: QuizQuestion): string {
  return question.choices.find((choice) => choice.id === question.correctId)?.label ?? question.it;
}

function estimateQuestionTimeSeconds(question: QuizQuestion, hardMode: boolean): number {
  const expected = getExpectedAnswerText(question);
  const charCount = expected.length;
  const wordCount = expected.split(/\s+/).filter(Boolean).length;

  if (hardMode || question.type === 'dictation') {
    const base = question.type === 'dictation' ? 24 : 18;
    const estimated = base + wordCount * 3 + Math.ceil(charCount / 5);
    return Math.max(20, Math.min(MAX_TYPING_TIME_SECONDS, estimated));
  }

  if (question.type === 'listen_to_fr') {
    return Math.max(DEFAULT_QUESTION_TIME_SECONDS, Math.min(30, 14 + wordCount * 2));
  }

  return Math.max(DEFAULT_QUESTION_TIME_SECONDS, Math.min(28, 12 + Math.ceil(question.prompt.length / 18)));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQuizSession(options: QuizSessionOptions = {}): QuizSessionState {
  const seriesSize = options.seriesSize ?? DEFAULT_SERIES_SIZE;

  const [localPool, setLocalPool] = useState<QuizBankItem[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerState, setAnswerState] = useState<QuizAnswerState>('unanswered');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [isSeriesDone, setIsSeriesDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGroqLoading, setIsGroqLoading] = useState(false);
  const [source, setSource] = useState<QuizSource>('local');
  const [totalItems, setTotalItems] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_QUESTION_TIME_SECONDS);
  const [timeLimit, setTimeLimit] = useState(DEFAULT_QUESTION_TIME_SECONDS);
  const [lastXpAward, setLastXpAward] = useState<number | null>(null);
  const [totalXpAwarded, setTotalXpAwarded] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [combo, setCombo] = useState(0);
  const [hardMode, setHardMode] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const comboMultiplier = combo >= 3 ? 2 : 1;

  const sessionStart = useRef(Date.now());
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);
  const questionsRef = useRef<QuizQuestion[]>([]);
  const resultsRef = useRef<QuizResult[]>([]);
  const answeredRef = useRef(false);
  const comboRef = useRef(0);

  const setQuestionTime = useCallback((question: QuizQuestion | undefined, nextHardMode = hardMode) => {
    const nextLimit = question ? estimateQuestionTimeSeconds(question, nextHardMode) : DEFAULT_QUESTION_TIME_SECONDS;
    setTimeLimit(nextLimit);
    setTimeLeft(nextLimit);
  }, [hardMode]);

  const clearTimer = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);

  const clearQuestionTimer = useCallback(() => {
    if (questionTimer.current) {
      clearInterval(questionTimer.current);
      questionTimer.current = null;
    }
  }, []);

  const advanceQuestion = useCallback(async () => {
    const next = indexRef.current + 1;
    if (next >= questionsRef.current.length) {
      const dur = Math.floor((Date.now() - sessionStart.current) / 1000);
      const correct = resultsRef.current.filter((r) => r.correct).length;
      const total = resultsRef.current.length;
      const scoreAvg = total > 0 ? Math.round((correct / total) * 100) : 0;

      await insertLearningSession({
        sessionType: 'quiz',
        durationSeconds: dur,
        cardsReviewed: total,
        scoreAvg,
      }).catch(() => null);

      const bonusXp = scoreAvg === 100 ? 100 : 50;
      await addXp(bonusXp).catch(() => null);
      await unlockAchievement('first_quiz').catch(() => false);
      if (scoreAvg === 100) await unlockAchievement('perfect_quiz').catch(() => false);
      setLastXpAward(bonusXp);
      setTotalXpAwarded((prev) => prev + bonusXp);
      await successFeedback();
      playQuizSound(scoreAvg >= 80 ? 'bravo' : 'complete');
      setIsSeriesDone(true);
    } else {
      indexRef.current = next;
      setCurrentIndex(next);
      setAnswerState('unanswered');
      setSelectedId(null);
      answeredRef.current = false;
      setLastXpAward(null);
      const nextQ = questionsRef.current[next];
      setQuestionTime(nextQ);
      if (nextQ?.type === 'listen_to_fr' || nextQ?.type === 'dictation') {
        setTimeout(() => { void speakIt(speakableText(nextQ.prompt), { rate: 0.82 }); }, 200);
      }
    }
  }, [setQuestionTime]);

  const selectChoice = useCallback(
    (id: string) => {
      if (!hasStarted || isPaused) return;
      if (answerState !== 'unanswered' || answeredRef.current) return;
      const q = questionsRef.current[indexRef.current];
      if (!q) return;

      const correct = id === q.correctId;
      answeredRef.current = true;
      setSelectedId(id);
      setAnswerState(correct ? 'correct' : 'wrong');

      const result: QuizResult = { correct, question: q, selectedId: id };
      resultsRef.current = [...resultsRef.current, result];
      setResults((prev) => [...prev, result]);

      if (q.sm2CardId) {
        updateCardAfterReview(q.sm2CardId, correct ? 4 : 1).catch(() => null);
      }

      clearQuestionTimer();

      if (correct) {
        const nextCombo = comboRef.current + 1;
        comboRef.current = nextCombo;
        setCombo(nextCombo);
        const multiplier = nextCombo >= 3 ? 2 : 1;
        const xp = 10 * multiplier;
        setLastXpAward(xp);
        setTotalXpAwarded((prev) => prev + xp);
        addXp(xp).catch(() => null);
        playQuizSound('correct');
        successFeedback();
      } else if (id === '__timeout__') {
        comboRef.current = 0;
        setCombo(0);
        playQuizSound('wrong');
        warningFeedback();
      } else if (id === '__skip__') {
        comboRef.current = 0;
        setCombo(0);
        playQuizSound('tap');
        warningFeedback();
      } else {
        comboRef.current = 0;
        setCombo(0);
        playQuizSound('wrong');
        errorFeedback();
      }

      if (!correct) {
        stopIt();
        setTimeout(() => { void speakIt(speakableText(q.it), { rate: 0.78 }); }, 300);
      }

      clearTimer();
      advanceTimer.current = setTimeout(
        () => advanceQuestion(),
        correct ? AUTO_ADVANCE_MS : WRONG_ANSWER_ADVANCE_MS,
      );
    },
    [answerState, advanceQuestion, clearQuestionTimer, clearTimer, hasStarted, isPaused],
  );

  const submitTypedAnswer = useCallback(
    (text: string) => {
      const q = questionsRef.current[indexRef.current];
      if (!q) return;
      const normalized = normalizeAnswer(text);
      const correctChoice = q.choices.find((c) => c.id === q.correctId);
      const isCorrect = correctChoice ? acceptedAnswers(correctChoice.label).has(normalized) : false;
      selectChoice(isCorrect ? q.correctId : '__typed_wrong__');
    },
    [selectChoice],
  );

  const skipQuestion = useCallback(() => {
    selectChoice('__skip__');
  }, [selectChoice]);

  const goToNextQuestion = useCallback(() => {
    if (!hasStarted || isPaused) return;
    if (answerState === 'unanswered') {
      skipQuestion();
      return;
    }
    clearTimer();
    playQuizSound('tap');
    void advanceQuestion();
  }, [advanceQuestion, answerState, clearTimer, hasStarted, isPaused, skipQuestion]);

  const submitVoiceAnswer = useCallback(
    async (uri: string): Promise<string | null> => {
      setIsTranscribing(true);
      try {
        const result = await transcribeLocalAudio({ uri, language: 'it' });
        if (result && result.text) {
          submitTypedAnswer(result.text);
          return result.text;
        }
        return null;
      } catch {
        return null;
      } finally {
        setIsTranscribing(false);
      }
    },
    [submitTypedAnswer]
  );

  const toggleHardMode = useCallback(() => {
    setHardMode((prev) => {
      const next = !prev;
      if (!hasStarted) {
        setQuestionTime(questionsRef.current[indexRef.current], next);
      }
      return next;
    });
  }, [hasStarted, setQuestionTime]);

  const startNewSeries = useCallback(async (pool: QuizBankItem[], previousResults?: QuizResult[]) => {
    clearTimer();

    questionsRef.current = [];
    indexRef.current = 0;
    resultsRef.current = [];
    comboRef.current = 0;
    setCurrentIndex(0);
    setAnswerState('unanswered');
    setSelectedId(null);
    setResults([]);
    setIsSeriesDone(false);
    setHasStarted(false);
    setIsPaused(false);
    setTimeLimit(DEFAULT_QUESTION_TIME_SECONDS);
    setTimeLeft(DEFAULT_QUESTION_TIME_SECONDS);
    setLastXpAward(null);
    setTotalXpAwarded(0);
    setCombo(0);
    answeredRef.current = false;
    sessionStart.current = Date.now();

    // Fetch due cards to prioritize them in the series
    const dueSm2Cards = await getDueCards(seriesSize).catch(() => []);
    const dueItems: QuizBankItem[] = dueSm2Cards.map((c) => ({
      id: `sm2-${c.id}`,
      it: c.frontIt,
      fr: c.frontFr,
      phonetic: c.phonetic ?? undefined,
      category: c.category,
    }));

    const localSeries = buildSeries(pool, seriesSize, dueItems);
    questionsRef.current = localSeries;
    setQuestions(localSeries);
    setQuestionTime(localSeries[0]);
    setSource('local');

    setIsGroqLoading(true);
    const weakCats = previousResults ? detectWeakCategories(previousResults) : [];
    const recentScore = previousResults && previousResults.length > 0
      ? Math.round(previousResults.filter((r) => r.correct).length / previousResults.length * 100)
      : 70;

    fetchGroqQuizItems({ weakCategories: weakCats, recentScore, count: 30 })
      .then(async (groqItems) => {
        if (!groqItems || groqItems.length < 4) return;
        // Save dynamically fetched questions in local SQLite cache
        await insertCachedQuizItems(groqItems).catch(() => null);

        const enriched = shuffle([...pool, ...groqItems]);
        setLocalPool(enriched);
        setTotalItems(enriched.length);
        setSource('mixed');
      })
      .catch(() => null)
      .finally(() => setIsGroqLoading(false));
  }, [clearTimer, seriesSize]);

  const handleNewSeries = useCallback(async () => {
    await startNewSeries(localPool, resultsRef.current);
  }, [localPool, startNewSeries]);

  const playAudio = useCallback(() => {
    if (!hasStarted || isPaused) return;
    const q = questionsRef.current[indexRef.current];
    if (!q) return;
    void speakIt(speakableText(q.it), { rate: 0.82, pitch: 1 });
  }, [hasStarted, isPaused]);

  const startSession = useCallback(() => {
    if (questionsRef.current.length === 0) return;
    playQuizSound('tap');
    setHasStarted(true);
    setIsPaused(false);
    sessionStart.current = Date.now();
    const q = questionsRef.current[indexRef.current];
    if (q?.type === 'listen_to_fr' || q?.type === 'dictation') {
      setTimeout(() => { void speakIt(speakableText(q.prompt), { rate: 0.82 }); }, 180);
    }
  }, []);

  const pauseSession = useCallback(() => {
    if (!hasStarted || isSeriesDone) return;
    clearTimer();
    clearQuestionTimer();
    setIsPaused(true);
    stopIt();
  }, [clearQuestionTimer, clearTimer, hasStarted, isSeriesDone]);

  const resumeSession = useCallback(() => {
    if (!hasStarted || isSeriesDone) return;
    setIsPaused(false);
    if (answerState !== 'unanswered' && !advanceTimer.current) {
      advanceTimer.current = setTimeout(
        () => advanceQuestion(),
        answerState === 'wrong' ? WRONG_ANSWER_ADVANCE_MS : AUTO_ADVANCE_MS,
      );
    }
  }, [advanceQuestion, answerState, hasStarted, isSeriesDone]);

  useEffect(() => {
    preloadQuizSounds();
    (async () => {
      setIsLoading(true);
      const [sm2Cards, bankItems, cachedDbItems] = await Promise.all([
        getAllCards(),
        getAllQuizItems(),
        getCachedQuizItems().catch(() => []),
      ]);

      const sm2Items: QuizBankItem[] = sm2Cards.map((c) => ({
        id: `sm2-${c.id}`,
        it: c.frontIt,
        fr: c.frontFr,
        phonetic: c.phonetic ?? undefined,
        category: c.category,
      }));

      const cachedItems: QuizBankItem[] = cachedDbItems.map((c) => ({
        id: c.id,
        it: c.it,
        fr: c.fr,
        phonetic: c.phonetic ?? undefined,
        category: c.category,
        explanation: c.explanation ?? undefined,
      }));

      const merged = shuffle([...sm2Items, ...bankItems, ...cachedItems]);
      setLocalPool(merged);
      setTotalItems(merged.length);

      await startNewSeries(merged);
      setIsLoading(false);
    })();
  }, [startNewSeries]);

  useEffect(() => () => {
    clearTimer();
    clearQuestionTimer();
  }, [clearQuestionTimer, clearTimer]);

  useEffect(() => {
    clearQuestionTimer();
    if (!hasStarted || isPaused || isLoading || isSeriesDone || answerState !== 'unanswered' || questions.length === 0) return;

    questionTimer.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearQuestionTimer();
          selectChoice('__timeout__');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearQuestionTimer();
  }, [answerState, clearQuestionTimer, currentIndex, hasStarted, isLoading, isPaused, isSeriesDone, questions.length, selectChoice]);

  return {
    questions,
    currentIndex,
    totalInSeries: questions.length,
    answerState,
    selectedId,
    results,
    isSeriesDone,
    isLoading,
    isGroqLoading,
    source,
    totalItems,
    timeLeft,
    timeLimit,
    timerProgress: timeLimit > 0 ? timeLeft / timeLimit : 0,
    lastXpAward,
    totalXpAwarded,
    hasStarted,
    isPaused,
    combo,
    comboMultiplier,
    hardMode,
    isTranscribing,
    startSession,
    pauseSession,
    resumeSession,
    playAudio,
    selectChoice,
    skipQuestion,
    goToNextQuestion,
    submitTypedAnswer,
    submitVoiceAnswer,
    toggleHardMode,
    startNewSeries: handleNewSeries,
  };
}
