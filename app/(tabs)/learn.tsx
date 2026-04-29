import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useItalianTTS } from '@/hooks/use-italian-tts';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { transcribeLocalAudio } from '@/services/transcription-client';
import { hasSpeechProxy } from '@/services/speech-ai-client';

import { lessonDetails, LessonDetail } from '@/data/lessons';
import { phases } from '@/data/italpro';
import {
  addXp,
  completeLessonGate,
  ensureLessonProgressSeed,
  getCompletedLessonCount,
  unlockAchievement,
  type LessonProgressRow,
} from '@/database/italpro-local-db';
import { successFeedback, warningFeedback } from '@/services/haptics';

const C = {
  bg: '#F7F7F7',
  surface: '#FFFFFF',
  surface2: '#F5F5F5',
  border: '#E5E5E5',
  primary: '#58CC02',
  primaryDark: '#46A302',
  primarySoft: '#D7F5B1',
  text: '#3C3C3C',
  muted: '#777777',
  dim: '#AFAFAF',
  orange: '#FF9600',
  red: '#FF4B4B',
} as const;

export default function LearnScreen() {
  const insets = useSafeAreaInsets();
  const [expandedPhase, setExpandedPhase] = useState<string | null>('phase-gen1');
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [lessonProgress, setLessonProgress] = useState<LessonProgressRow[]>([]);
  const [isProgressReady, setIsProgressReady] = useState(false);

  const progressByLesson = useMemo(
    () => new Map(lessonProgress.map((row) => [row.lessonId, row])),
    [lessonProgress],
  );

  const reloadProgress = useCallback(async () => {
    const rows = await ensureLessonProgressSeed(lessonDetails.map((lesson) => lesson.id));
    setLessonProgress(rows);
    setIsProgressReady(true);
  }, []);

  useEffect(() => {
    reloadProgress().catch(() => setIsProgressReady(true));
  }, [reloadProgress]);

  const togglePhase = useCallback((id: string) => {
    setExpandedPhase(prev => (prev === id ? null : id));
    setExpandedLesson(null);
  }, []);

  const toggleLesson = useCallback((id: string) => {
    const status = progressByLesson.get(id)?.status ?? 'locked';
    if (status === 'locked') {
      warningFeedback();
      return;
    }
    setExpandedLesson(prev => (prev === id ? null : id));
  }, [progressByLesson]);

  const handleLessonPassed = useCallback(async (lessonId: string, score: number) => {
    const index = lessonDetails.findIndex((lesson) => lesson.id === lessonId);
    const nextLessonId = lessonDetails[index + 1]?.id ?? null;
    await completeLessonGate({ lessonId, nextLessonId, score });
    await addXp(50).catch(() => null);
    await successFeedback();

    const completedCount = await getCompletedLessonCount().catch(() => 0);
    if (completedCount >= 1) await unlockAchievement('first_lesson').catch(() => false);
    if (completedCount >= 10) await unlockAchievement('ten_lessons').catch(() => false);
    await reloadProgress();
  }, [reloadProgress]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Fixed header ────────────────────────────────────────────────────── */}
      <View style={[styles.pageHeader, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.pageTitle}>Leçons</Text>
        <Text style={styles.pageSub}>{phases.length} phases · {lessonDetails.length} leçons · programme complet</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>

        {phases.map((phase) => {
          const color = phase.accentColor ?? C.primary;
          const isPhaseOpen = expandedPhase === phase.id;
          const phaseLessons = lessonDetails.filter(l => l.phaseId === phase.id);

          return (
            <View key={phase.id} style={styles.phaseBlock}>
              {/* ── En-tête de phase ──────────────────────────────── */}
              <Pressable
                onPress={() => togglePhase(phase.id)}
                style={({ pressed }) => [styles.phaseHeader, pressed && styles.phaseHeaderPressed]}>
                <View style={[styles.phaseAccent, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.phaseWeeks}>{phase.weeks}</Text>
                  <Text style={styles.phaseTitle}>{phase.title}</Text>
                </View>
                <View style={[styles.lessonCountBadge, { backgroundColor: color + '20' }]}>
                  <Text style={[styles.lessonCountText, { color }]}>{phaseLessons.length}</Text>
                </View>
                <Text style={[styles.chevron, { color }]}>{isPhaseOpen ? '▲' : '▼'}</Text>
              </Pressable>

              {/* ── Leçons de la phase ────────────────────────────── */}
              {isPhaseOpen && (
                <View style={styles.lessonsList}>
                  {phaseLessons.length === 0 ? (
                    <Text style={styles.comingSoon}>Bientôt disponible</Text>
                  ) : (
                    phaseLessons.map((lesson) => (
                      <LessonRow
                        key={lesson.id}
                        lesson={lesson}
                        color={color}
                        isOpen={expandedLesson === lesson.id}
                        progress={progressByLesson.get(lesson.id)}
                        isProgressReady={isProgressReady}
                        onToggle={toggleLesson}
                        onPassed={handleLessonPassed}
                      />
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── LessonRow ────────────────────────────────────────────────────────────────

function LessonRow({
  lesson,
  color,
  isOpen,
  progress,
  isProgressReady,
  onToggle,
  onPassed,
}: {
  lesson: LessonDetail;
  color: string;
  isOpen: boolean;
  progress?: LessonProgressRow;
  isProgressReady: boolean;
  onToggle: (id: string) => void;
  onPassed: (lessonId: string, score: number) => Promise<void>;
}) {
  const [quizStarted, setQuizStarted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const tts = useItalianTTS();
  const isLocked = isProgressReady && (progress?.status ?? 'locked') === 'locked';
  const isCompleted = progress?.status === 'completed';
  const quizQuestions = useMemo(() => buildLessonQuiz(lesson), [lesson]);
  const currentQuestion = quizQuestions[questionIndex];

  const speakWord = useCallback((text: string) => {
    tts.speak(text, { rate: 0.8, pitch: 1 });
  }, [tts]);

  const startQuiz = useCallback(() => {
    setQuizStarted(true);
    setQuestionIndex(0);
    setCorrectCount(0);
    setSelectedAnswer(null);
    setQuizScore(null);
  }, []);

  const answerQuestion = useCallback(
    async (answer: string) => {
      if (!currentQuestion || selectedAnswer) return;
      setSelectedAnswer(answer);
      const isCorrect = answer === currentQuestion.correct;
      const nextCorrect = correctCount + (isCorrect ? 1 : 0);
      if (isCorrect) await successFeedback();
      else await warningFeedback();

      setTimeout(async () => {
        if (questionIndex + 1 >= quizQuestions.length) {
          const score = Math.round((nextCorrect / quizQuestions.length) * 100);
          setCorrectCount(nextCorrect);
          setQuizScore(score);
          setQuizStarted(false);
          setSelectedAnswer(null);
          if (score >= 80) await onPassed(lesson.id, score);
        } else {
          setCorrectCount(nextCorrect);
          setQuestionIndex((index) => index + 1);
          setSelectedAnswer(null);
        }
      }, 650);
    },
    [correctCount, currentQuestion, lesson.id, onPassed, questionIndex, quizQuestions.length, selectedAnswer],
  );

  return (
    <View style={[styles.lessonBlock, isLocked && styles.lessonBlockLocked]}>
      {/* ── Titre leçon ──────────────────────────────────────── */}
      <Pressable
        onPress={() => onToggle(lesson.id)}
        style={({ pressed }) => [styles.lessonHeader, pressed && styles.lessonHeaderPressed]}>
        <Text style={styles.lessonIcon}>{lesson.icon}</Text>
        <Text style={styles.lessonTitle}>{lesson.title}</Text>
        {isLocked ? (
          <View style={styles.lockBadge}>
            <Text style={styles.lockBadgeIcon}>🔒</Text>
          </View>
        ) : null}
        <View style={styles.lessonMetaWrap}>
          <Text style={[styles.lessonCount, { color }]}>{lesson.vocab.length} mots</Text>
          <Text style={[
            styles.lessonStatus,
            isCompleted ? styles.lessonStatusDone : isLocked ? styles.lessonStatusLocked : { color },
          ]}>
            {isCompleted ? 'validée' : isLocked ? '' : progress?.quizScore ? `${progress.quizScore}%` : 'ouverte'}
          </Text>
        </View>
        <Text style={[styles.chevronSmall, { color }]}>{isOpen ? '▲' : '▼'}</Text>
      </Pressable>

      {/* ── Contenu leçon ────────────────────────────────────── */}
      {isOpen && (
        <View style={styles.lessonContent}>
          {lesson.grammarTip ? (
            <View style={[styles.grammarTip, { borderLeftColor: color }]}>
              <Text style={[styles.grammarTipLabel, { color }]}>💡 Astuce grammaire</Text>
              <Text style={styles.grammarTipText}>{lesson.grammarTip}</Text>
            </View>
          ) : null}

          {lesson.vocab.map((item, idx) => (
            <View key={idx} style={styles.vocabRow}>
              <Pressable
                onPress={() => speakWord(item.it)}
                style={({ pressed }) => [styles.vocabRowInner, pressed && styles.vocabRowPressed]}>
                <View style={styles.vocabLeft}>
                  <Text style={styles.vocabIt}>{item.it}</Text>
                  {item.phonetic ? (
                    <Text style={styles.vocabPhonetic}>{item.phonetic}</Text>
                  ) : null}
                </View>
                <View style={styles.vocabRight}>
                  <Text style={styles.vocabFr}>{item.fr}</Text>
                  {item.example ? (
                    <Text style={styles.vocabExample}>{item.example}</Text>
                  ) : null}
                </View>
                <Text style={[styles.speakIcon, { color }]}>▶</Text>
              </Pressable>
              <PronounceButton word={item.it} />
            </View>
          ))}

          <View style={styles.quizGate}>
            <View style={styles.quizGateHeader}>
              <View>
                <Text style={[styles.quizGateLabel, { color }]}>Quiz de validation</Text>
                <Text style={styles.quizGateText}>80% requis pour débloquer la leçon suivante.</Text>
              </View>
              {isCompleted ? <Text style={styles.quizDoneBadge}>✓</Text> : null}
            </View>

            {quizStarted && currentQuestion ? (
              <View style={styles.quizBox}>
                <Text style={styles.quizProgress}>{questionIndex + 1}/{quizQuestions.length}</Text>
                <Text style={styles.quizPrompt}>{currentQuestion.prompt}</Text>
                <View style={styles.quizChoices}>
                  {currentQuestion.choices.map((choice) => {
                    const isSelected = selectedAnswer === choice;
                    const isCorrect = choice === currentQuestion.correct;
                    return (
                      <Pressable
                        key={choice}
                        disabled={Boolean(selectedAnswer)}
                        onPress={() => answerQuestion(choice)}
                        style={[
                          styles.quizChoice,
                          isSelected && (isCorrect ? styles.quizChoiceCorrect : styles.quizChoiceWrong),
                          selectedAnswer && isCorrect && styles.quizChoiceCorrect,
                        ]}>
                        <Text style={styles.quizChoiceText}>{choice}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <>
                {quizScore != null ? (
                  <Text style={[styles.quizScore, { color: quizScore >= 80 ? C.primaryDark : C.red }]}>
                    Dernier score : {quizScore}% {quizScore >= 80 ? '· leçon validée' : '· rejoue pour progresser'}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Lancer le quiz de validation"
                  onPress={startQuiz}
                  style={({ pressed }) => [styles.quizButton, { backgroundColor: color }, pressed && styles.quizButtonPressed]}>
                  <Text style={styles.quizButtonText}>{isCompleted ? 'Rejouer le quiz' : 'Valider la leçon'}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Pronunciation check ──────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

type PronounceResult = 'correct' | 'close' | 'wrong';

function PronounceButton({ word }: { word: string }) {
  const recorder = useVoiceRecorder();
  const speechReady = hasSpeechProxy();
  const [result, setResult] = useState<PronounceResult | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handlePress = useCallback(async () => {
    setResult(null);

    if (recorder.state === 'recording') {
      const audio = await recorder.stopRecording();
      if (!audio || !speechReady) { setResult('wrong'); return; }
      setIsTranscribing(true);
      const transcription = await transcribeLocalAudio({ uri: audio.uri, language: 'it' });
      setIsTranscribing(false);
      if (!transcription?.text) { setResult('wrong'); return; }

      const spoken = transcription.text.toLowerCase().trim().replace(/[.,!?]/g, '');
      const target = word.toLowerCase().trim();
      const dist = levenshtein(spoken, target);
      const similarity = 1 - dist / Math.max(spoken.length, target.length, 1);
      setResult(similarity >= 0.85 ? 'correct' : similarity >= 0.6 ? 'close' : 'wrong');
    } else {
      if (!speechReady) { setResult('wrong'); return; }
      await recorder.startRecording();
    }
  }, [recorder, speechReady, word]);

  const isRecording = recorder.state === 'recording';
  const isProcessing = recorder.state === 'processing' || isTranscribing;

  const icon = isRecording ? '⏹' : isProcessing ? '…' : '🎤';
  const resultColor = result === 'correct' ? C.primary : result === 'close' ? C.orange : result === 'wrong' ? C.red : C.dim;
  const resultText = result === 'correct' ? '✓ Parfait' : result === 'close' ? '~ Proche' : result === 'wrong' ? '✗ Réessaie' : null;

  return (
    <View style={styles.pronounceWrap}>
      <Pressable
        onPress={handlePress}
        disabled={isProcessing}
        style={[styles.pronounceBtn, isRecording && styles.pronounceBtnActive]}>
        {isProcessing
          ? <ActivityIndicator size="small" color={C.primary} />
          : <Text style={[styles.pronounceBtnIcon, isRecording && { color: C.red }]}>{icon}</Text>
        }
      </Pressable>
      {resultText ? (
        <Text style={[styles.pronounceResult, { color: resultColor }]}>{resultText}</Text>
      ) : null}
    </View>
  );
}

function buildLessonQuiz(lesson: LessonDetail) {
  const items = lesson.vocab.filter((item) => item.it.trim() && item.fr.trim()).slice(0, 5);
  return items.map((item, index) => {
    const distractors = lesson.vocab
      .filter((candidate) => candidate.fr !== item.fr)
      .slice(index + 1)
      .concat(lesson.vocab.filter((candidate) => candidate.fr !== item.fr))
      .slice(0, 3)
      .map((candidate) => candidate.fr);
    return {
      prompt: item.it,
      correct: item.fr,
      choices: shuffle([item.fr, ...distractors]).slice(0, 4),
    };
  });
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  pageHeader: {
    backgroundColor: C.bg,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 4,
  },
  pageTitle: {
    color: C.text,
    fontSize: 28,
    fontWeight: '900',
  },
  pageSub: {
    color: C.dim,
    fontSize: 13,
  },
  phaseBlock: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  phaseHeaderPressed: {
    backgroundColor: C.surface2,
  },
  phaseAccent: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  phaseWeeks: {
    color: C.dim,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phaseTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 1,
  },
  lessonCountBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonCountText: {
    fontSize: 13,
    fontWeight: '900',
  },
  chevron: {
    fontSize: 11,
    fontWeight: '900',
  },
  lessonsList: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  comingSoon: {
    color: C.dim,
    fontSize: 13,
    padding: 16,
    fontStyle: 'italic',
  },
  lessonBlock: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  lessonBlockLocked: {
    opacity: 0.58,
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingLeft: 20,
    gap: 10,
  },
  lessonHeaderPressed: {
    backgroundColor: C.surface2,
  },
  lessonIcon: {
    fontSize: 18,
  },
  lessonTitle: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  lessonMetaWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  lockBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F2F2F2',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadgeIcon: {
    fontSize: 16,
  },
  lessonCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  lessonStatus: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  lessonStatusDone: {
    color: C.primaryDark,
  },
  lessonStatusLocked: {
    color: C.dim,
  },
  chevronSmall: {
    fontSize: 10,
    fontWeight: '900',
  },
  lessonContent: {
    backgroundColor: C.surface2,
    paddingBottom: 8,
  },
  grammarTip: {
    margin: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 14,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  grammarTipLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grammarTipText: {
    color: C.text,
    fontSize: 13,
    lineHeight: 19,
  },
  vocabRow: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  vocabRowInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  vocabRowPressed: {
    backgroundColor: C.border,
  },
  vocabLeft: {
    width: 130,
    gap: 2,
  },
  vocabIt: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
  },
  vocabPhonetic: {
    color: C.dim,
    fontSize: 11,
    fontStyle: 'italic',
  },
  vocabRight: {
    flex: 1,
    gap: 2,
  },
  vocabFr: {
    color: C.muted,
    fontSize: 14,
  },
  vocabExample: {
    color: C.dim,
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  speakIcon: {
    fontSize: 11,
    paddingTop: 3,
  },
  pronounceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  pronounceBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pronounceBtnActive: {
    backgroundColor: '#FFE1E1',
    borderColor: C.red,
  },
  pronounceBtnIcon: {
    fontSize: 16,
    color: C.muted,
  },
  pronounceResult: {
    fontSize: 12,
    fontWeight: '900',
  },
  quizGate: {
    margin: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  quizGateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quizGateLabel: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  quizGateText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  quizDoneBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.primarySoft,
    color: C.primaryDark,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 34,
    overflow: 'hidden',
  },
  quizBox: {
    gap: 10,
  },
  quizProgress: {
    color: C.dim,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  quizPrompt: {
    color: C.text,
    fontSize: 22,
    fontWeight: '900',
  },
  quizChoices: {
    gap: 8,
  },
  quizChoice: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface2,
    padding: 12,
  },
  quizChoiceCorrect: {
    borderColor: C.primary,
    backgroundColor: C.primarySoft,
  },
  quizChoiceWrong: {
    borderColor: C.red,
    backgroundColor: '#FFEAEA',
  },
  quizChoiceText: {
    color: C.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  quizScore: {
    fontSize: 13,
    fontWeight: '900',
  },
  quizButton: {
    alignItems: 'center',
    borderRadius: 15,
    paddingVertical: 13,
  },
  quizButtonPressed: {
    opacity: 0.82,
  },
  quizButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
