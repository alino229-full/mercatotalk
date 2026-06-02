import { router, useLocalSearchParams } from 'expo-router';
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
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { LessonQuiz } from '@/components/learn/lesson-quiz';
import { lessonDetails, type LessonConcept, type LessonDetail } from '@/data/lessons';
import { phases } from '@/data/italpro';
import {
  addXp,
  completeLessonGate,
  getCompletedLessonCount,
  unlockAchievement,
} from '@/database/italpro-local-db';
import { useItalianTTS } from '@/hooks/use-italian-tts';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { buildLessonQuiz, speakableIt } from '@/services/lesson-quiz-builder';
import { fetchLessonQuizVariations, hasLessonQuizAiAvailable } from '@/services/lesson-quiz-ai-client';
import { successFeedback, warningFeedback } from '@/services/haptics';
import { hasSpeechProxy } from '@/services/speech-ai-client';
import { transcribeLocalAudio } from '@/services/transcription-client';

const C = {
  bg: '#F7F7F7',
  surface: '#FFFFFF',
  surface2: '#F2F2F2',
  border: '#E5E5E5',
  primary: '#58CC02',
  primaryDark: '#46A302',
  primarySoft: '#D7F5B1',
  text: '#3C3C3C',
  muted: '#777777',
  dim: '#AFAFAF',
  red: '#FF4B4B',
  orange: '#FF9600',
} as const;

const lessonIdsByPhase = phases.map((phase) => ({
  phaseId: phase.id,
  lessonIds: lessonDetails.filter((lesson) => lesson.phaseId === phase.id).map((lesson) => lesson.id),
}));

function getNextLessonIdInSamePhase(lessonId: string): string | null {
  const phase = lessonIdsByPhase.find((entry) => entry.lessonIds.includes(lessonId));
  if (!phase) return null;
  const currentIndex = phase.lessonIds.indexOf(lessonId);
  return phase.lessonIds[currentIndex + 1] ?? null;
}

type Mode = 'study' | 'quiz' | 'result';

export default function LessonScreen() {
  const insets = useSafeAreaInsets();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const lesson = useMemo(() => lessonDetails.find((l) => l.id === lessonId) ?? null, [lessonId]);
  const accent = useMemo(
    () => phases.find((p) => p.id === lesson?.phaseId)?.accentColor ?? C.primary,
    [lesson],
  );
  const staticQuiz = useMemo(() => (lesson ? buildLessonQuiz(lesson) : []), [lesson]);

  const [mode, setMode] = useState<Mode>('study');
  const [score, setScore] = useState<number | null>(null);
  const [aiQuiz, setAiQuiz] = useState<{ lessonId: string; questions: typeof staticQuiz } | null>(null);
  const tts = useItalianTTS();
  const aiQuestions = aiQuiz && aiQuiz.lessonId === lesson?.id ? aiQuiz.questions : null;
  const quiz = aiQuestions?.length ? aiQuestions : staticQuiz;
  const isAiQuiz = Boolean(aiQuestions?.length);

  useEffect(() => {
    if (!lesson || !hasLessonQuizAiAvailable()) return;

    let cancelled = false;
    fetchLessonQuizVariations(lesson, 5).then((questions) => {
      if (cancelled || !questions?.length) return;
      setAiQuiz({
        lessonId: lesson.id,
        questions: [...questions, ...staticQuiz].slice(0, Math.max(6, Math.min(staticQuiz.length + 2, 10))),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [lesson, staticQuiz]);

  const handleComplete = useCallback(
    async (finalScore: number) => {
      setScore(finalScore);
      setMode('result');
      if (!lesson) return;
      if (finalScore >= 80) {
        const nextLessonId = getNextLessonIdInSamePhase(lesson.id);
        await completeLessonGate({ lessonId: lesson.id, nextLessonId, score: finalScore });
        await addXp(50).catch(() => null);
        await successFeedback();
        const completedCount = await getCompletedLessonCount().catch(() => 0);
        if (completedCount >= 1) await unlockAchievement('first_lesson').catch(() => false);
        if (completedCount >= 10) await unlockAchievement('ten_lessons').catch(() => false);
      } else {
        await warningFeedback();
      }
    },
    [lesson],
  );

  if (!lesson) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.missing}>Leçon introuvable.</Text>
        <Pressable onPress={() => router.back()} style={[styles.primaryBtn, { backgroundColor: C.primary }]}>
          <Text style={styles.primaryBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  if (mode === 'quiz') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={styles.quizWrap}>
          {quiz.length > 0 ? (
            <LessonQuiz
              questions={quiz}
              accentColor={accent}
              onComplete={handleComplete}
              onAbort={() => setMode('study')}
            />
          ) : (
            <View style={styles.center}>
              <Text style={styles.missing}>Pas encore de quiz pour cette leçon.</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (mode === 'result' && score != null) {
    const passed = score >= 80;
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <Animated.View entering={FadeInUp.duration(360)} style={styles.resultCard}>
          <Text style={styles.resultEmoji}>{passed ? '🎉' : '💪'}</Text>
          <Text style={[styles.resultScore, { color: passed ? C.primaryDark : C.orange }]}>{score}%</Text>
          <Text style={styles.resultTitle}>{passed ? 'Leçon validée !' : 'Presque !'}</Text>
          <Text style={styles.resultText}>
            {passed ? '+50 XP · la leçon suivante est débloquée.' : '80% requis. Rejoue pour progresser.'}
          </Text>
          <Pressable
            onPress={() => {
              setScore(null);
              setMode('quiz');
            }}
            style={[styles.primaryBtn, { backgroundColor: accent }]}>
            <Text style={styles.primaryBtnText}>{passed ? 'Rejouer' : 'Réessayer'}</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.ghostBtn}>
            <Text style={[styles.ghostBtnText, { color: accent }]}>Retour au parcours</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: accent + '30' }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={[styles.backIcon, { color: accent }]}>‹</Text>
        </Pressable>
        <View style={[styles.headerIcon, { backgroundColor: accent + '18', borderColor: accent + '40' }]}>
          <Text style={styles.headerEmoji}>{lesson.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{lesson.title}</Text>
          <Text style={styles.headerSub}>
            {lesson.vocab.length} mots · quiz {quiz.length} questions{isAiQuiz ? ' · variation IA' : ''}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {lesson.concepts?.length ? (
          <View style={styles.conceptStack}>
            {lesson.concepts.map((concept, idx) => (
              <Animated.View key={concept.id} entering={FadeInDown.delay(idx * 45).duration(300)}>
                <ConceptCard concept={concept} accent={accent} />
              </Animated.View>
            ))}
          </View>
        ) : null}

        {lesson.grammarTip ? (
          <Animated.View entering={FadeInDown.duration(300)} style={[styles.tip, { borderLeftColor: accent }]}>
            <Text style={[styles.tipLabel, { color: accent }]}>💡 Astuce</Text>
            <Text style={styles.tipText}>{lesson.grammarTip}</Text>
          </Animated.View>
        ) : null}

        {lesson.vocab.map((item, idx) => (
          <Animated.View key={idx} entering={FadeInDown.delay(idx * 35).duration(280)}>
            <VocabCard lesson={lesson} item={item} accent={accent} onSpeak={(t) => tts.speak(t, { rate: 0.8 })} />
          </Animated.View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          disabled={quiz.length === 0}
          onPress={() => setMode('quiz')}
          style={[styles.primaryBtn, { backgroundColor: accent }, quiz.length === 0 && styles.primaryBtnDisabled]}>
          <Text style={styles.primaryBtnText}>Commencer le quiz</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ConceptCard({ concept, accent }: { concept: LessonConcept; accent: string }) {
  return (
    <View style={[styles.conceptCard, { borderColor: accent + '30' }]}>
      <View style={styles.conceptHeader}>
        <View style={[styles.conceptBadge, { backgroundColor: accent + '18' }]}>
          <Text style={[styles.conceptBadgeText, { color: accent }]}>REGLE</Text>
        </View>
        <Text selectable style={styles.conceptTitle}>{concept.title}</Text>
      </View>

      <Text selectable style={styles.conceptRule}>{concept.rule}</Text>

      <View style={styles.whyBox}>
        <Text selectable style={[styles.whyLabel, { color: accent }]}>Pourquoi ça marche</Text>
        <Text selectable style={styles.whyText}>{concept.why}</Text>
      </View>

      {concept.pattern ? (
        <View style={styles.patternBox}>
          <Text selectable style={styles.patternLabel}>Modele mental</Text>
          <Text selectable style={styles.patternText}>{concept.pattern}</Text>
        </View>
      ) : null}

      <View style={styles.exampleStack}>
        {concept.examples.map((example, index) => (
          <View key={`${concept.id}-ex-${index}`} style={styles.exampleRow}>
            <View style={[styles.exampleRail, { backgroundColor: accent }]} />
            <View style={{ flex: 1 }}>
              <Text selectable style={styles.exampleIt}>{example.it}</Text>
              <Text selectable style={styles.exampleFr}>{example.fr}</Text>
              {example.note ? <Text selectable style={styles.exampleNote}>{example.note}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      {concept.memoryTip ? (
        <View style={[styles.memoryBox, { backgroundColor: accent + '12' }]}>
          <Text selectable style={[styles.memoryLabel, { color: accent }]}>Memoire active</Text>
          <Text selectable style={styles.memoryText}>{concept.memoryTip}</Text>
        </View>
      ) : null}
    </View>
  );
}

function VocabCard({
  lesson,
  item,
  accent,
  onSpeak,
}: {
  lesson: LessonDetail;
  item: { it: string; fr: string; phonetic?: string; example?: string };
  accent: string;
  onSpeak: (text: string) => void;
}) {
  return (
    <View style={styles.vocabCard}>
      <Pressable onPress={() => onSpeak(speakableIt(item.it))} style={styles.vocabMain}>
        <View style={{ flex: 1 }}>
          <Text style={styles.vocabIt}>{item.it}</Text>
          {item.phonetic ? <Text style={styles.vocabPhonetic}>{item.phonetic}</Text> : null}
          <Text style={styles.vocabFr}>{item.fr}</Text>
          {item.example ? <Text style={styles.vocabExample}>{item.example}</Text> : null}
        </View>
        <View style={[styles.playBtn, { backgroundColor: accent + '15' }]}>
          <Text style={[styles.playIcon, { color: accent }]}>▶</Text>
        </View>
      </Pressable>
      <PronounceButton word={speakableIt(item.it)} accent={accent} />
    </View>
  );
}

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

function PronounceButton({ word, accent }: { word: string; accent: string }) {
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
      const similarity = 1 - levenshtein(spoken, target) / Math.max(spoken.length, target.length, 1);
      const r: PronounceResult = similarity >= 0.85 ? 'correct' : similarity >= 0.6 ? 'close' : 'wrong';
      setResult(r);
      if (r === 'correct') void successFeedback();
      else void warningFeedback();
    } else if (speechReady) {
      await recorder.startRecording();
    } else {
      setResult('wrong');
    }
  }, [recorder, speechReady, word]);

  const isRecording = recorder.state === 'recording';
  const isProcessing = recorder.state === 'processing' || isTranscribing;
  const icon = isRecording ? '⏹' : '🎤';
  const color = result === 'correct' ? C.primary : result === 'close' ? C.orange : result === 'wrong' ? C.red : C.dim;
  const text = result === 'correct' ? '✓ Parfait' : result === 'close' ? '~ Proche' : result === 'wrong' ? '✗ Réessaie' : 'Prononcer';

  return (
    <View style={styles.pronounceRow}>
      <Pressable
        disabled={isProcessing}
        onPress={handlePress}
        style={[styles.pronounceBtn, isRecording && styles.pronounceBtnActive, { borderColor: accent + '40' }]}>
        {isProcessing ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Text style={[styles.pronounceIcon, isRecording && { color: C.red }]}>{icon}</Text>
        )}
      </Pressable>
      <Animated.Text key={text} entering={FadeIn.duration(200)} style={[styles.pronounceText, { color }]}>
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  missing: { color: C.muted, fontSize: 16, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
  },
  backBtn: { width: 30, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 34, fontWeight: '900', lineHeight: 36 },
  headerIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerEmoji: { fontSize: 22 },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: '900' },
  headerSub: { color: C.dim, fontSize: 12, fontWeight: '600', marginTop: 1 },
  scroll: { padding: 16, gap: 10, paddingBottom: 30 },
  conceptStack: { gap: 12 },
  conceptCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
    gap: 12,
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  },
  conceptHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  conceptBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  conceptBadgeText: { fontSize: 10, fontWeight: '900' },
  conceptTitle: { flex: 1, color: C.text, fontSize: 18, fontWeight: '900' },
  conceptRule: { color: C.text, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  whyBox: { backgroundColor: C.surface2, borderRadius: 14, padding: 12, gap: 4 },
  whyLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  whyText: { color: C.text, fontSize: 13, lineHeight: 19 },
  patternBox: { borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, gap: 4 },
  patternLabel: { color: C.dim, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  patternText: { color: C.text, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  exampleStack: { gap: 9 },
  exampleRow: { flexDirection: 'row', gap: 10 },
  exampleRail: { width: 3, borderRadius: 99 },
  exampleIt: { color: C.text, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  exampleFr: { color: C.muted, fontSize: 13, lineHeight: 18 },
  exampleNote: { color: C.dim, fontSize: 12, lineHeight: 17, fontStyle: 'italic', marginTop: 2 },
  memoryBox: { borderRadius: 14, padding: 12, gap: 3 },
  memoryLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  memoryText: { color: C.text, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  tip: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 14,
    gap: 4,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  tipLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  tipText: { color: C.text, fontSize: 13, lineHeight: 19 },
  vocabCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 10,
  },
  vocabMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vocabIt: { color: C.text, fontSize: 17, fontWeight: '900' },
  vocabPhonetic: { color: C.dim, fontSize: 12, fontStyle: 'italic', marginTop: 1 },
  vocabFr: { color: C.muted, fontSize: 14, marginTop: 3 },
  vocabExample: { color: C.dim, fontSize: 12, fontStyle: 'italic', marginTop: 3, lineHeight: 16 },
  playBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  playIcon: { fontSize: 14 },
  pronounceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: C.surface2, paddingTop: 10 },
  pronounceBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface2, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  pronounceBtnActive: { backgroundColor: '#FFE1E1', borderColor: C.red },
  pronounceIcon: { fontSize: 16, color: C.muted },
  pronounceText: { fontSize: 13, fontWeight: '800' },
  footer: { padding: 16, paddingTop: 12, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border },
  quizWrap: { flex: 1, padding: 16 },
  primaryBtn: { alignItems: 'center', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, alignSelf: 'stretch' },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  ghostBtn: { paddingVertical: 12 },
  ghostBtnText: { fontSize: 14, fontWeight: '800' },
  resultCard: { alignItems: 'center', gap: 8, width: '100%' },
  resultEmoji: { fontSize: 64 },
  resultScore: { fontSize: 52, fontWeight: '900' },
  resultTitle: { color: C.text, fontSize: 22, fontWeight: '900' },
  resultText: { color: C.muted, fontSize: 14, textAlign: 'center', marginBottom: 12, paddingHorizontal: 20 },
});
