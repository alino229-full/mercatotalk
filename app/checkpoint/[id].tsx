import { useCallback, useMemo, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { QuizResult, QuizRunner } from '@/components/italpro/quiz-runner';
import { checkpointId, getChapterById, nextGateId } from '@/data/curriculum';
import { buildCheckpointQuiz } from '@/services/lesson-quiz';
import { addXp, completeLessonGate } from '@/database/italpro-local-db';
import { successFeedback } from '@/services/haptics';

const C = {
  bg: '#0F1115',
  surface: '#1B1F27',
  text: '#F4F5F7',
  muted: '#9AA3B2',
  gold: '#FFC800',
};

type Mode = 'intro' | 'quiz' | 'result';

export default function CheckpointScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const chapter = id ? getChapterById(id) : undefined;
  const accent = chapter?.accentColor ?? C.gold;

  const [mode, setMode] = useState<Mode>('intro');
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [quizKey, setQuizKey] = useState(0);

  const questions = useMemo(
    () => (chapter ? buildCheckpointQuiz(chapter.lessons.map((l) => l.lesson)) : []),
    [chapter],
  );

  const handleComplete = useCallback(
    async (finalScore: number, didPass: boolean) => {
      setScore(finalScore);
      setPassed(didPass);
      setMode('result');
      if (didPass && chapter) {
        const gateId = checkpointId(chapter.id);
        await completeLessonGate({
          lessonId: gateId,
          nextLessonId: nextGateId(gateId),
          score: finalScore,
        });
        await addXp(120).catch(() => null);
        await successFeedback();
      }
    },
    [chapter],
  );

  if (!chapter) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.missing}>Checkpoint introuvable.</Text>
        <Pressable onPress={() => router.back()} style={[styles.cta, { backgroundColor: C.gold }]}>
          <Text style={styles.ctaText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Text style={styles.backIcon}>✕</Text>
        </Pressable>
        <Text style={styles.topTitle}>Checkpoint · Chapitre {chapter.number}</Text>
        <View style={{ width: 32 }} />
      </View>

      {mode === 'intro' ? (
        <Animated.View entering={FadeIn} style={styles.intro}>
          <Animated.Text entering={ZoomIn.springify()} style={styles.trophy}>
            🏆
          </Animated.Text>
          <Text style={styles.introTitle}>{chapter.title}</Text>
          <Text style={styles.introText}>
            Teste tes connaissances sur l&apos;ensemble du chapitre pour le valider et débloquer le
            chapitre suivant. {questions.length} questions · 80% requis.
          </Text>
          <Pressable
            onPress={() => {
              setQuizKey((k) => k + 1);
              setMode('quiz');
            }}
            style={[styles.cta, { backgroundColor: accent }]}>
            <Text style={styles.ctaText}>Commencer le checkpoint</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {mode === 'quiz' ? (
        <Animated.View entering={FadeIn} style={styles.quizWrap}>
          <QuizRunner
            key={quizKey}
            questions={questions}
            accentColor={accent}
            onComplete={handleComplete}
          />
        </Animated.View>
      ) : null}

      {mode === 'result' ? (
        <QuizResult
          score={score}
          passed={passed}
          accentColor={accent}
          passLabel="Chapitre validé !"
          failLabel="Il manque un peu, réessaie"
          primaryLabel={passed ? 'Continuer le parcours' : 'Réessayer'}
          onPrimary={() => {
            if (passed) {
              router.back();
            } else {
              setQuizKey((k) => k + 1);
              setMode('quiz');
            }
          }}
          onSecondary={() => router.back()}
          secondaryLabel="Retour au parcours"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  missing: { color: C.text, fontSize: 16, fontWeight: '700' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: C.text, fontSize: 20, fontWeight: '900' },
  topTitle: { color: C.text, fontSize: 15, fontWeight: '900' },
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  trophy: { fontSize: 88 },
  introTitle: { color: C.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  introText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 16 },
  quizWrap: { flex: 1, paddingTop: 8 },
  cta: { alignSelf: 'stretch', alignItems: 'center', borderRadius: 16, paddingVertical: 16 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
