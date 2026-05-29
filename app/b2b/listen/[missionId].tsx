import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  listenActionQuestions,
  type ListenActionQuestion,
} from '@/data/b2b-operational';
import { ACCENT_COLORS, getMissionById, type B2BMission } from '@/data/b2b-missions';
import { addXp, insertLearningSession } from '@/database/italpro-local-db';
import { successFeedback, tapFeedback, warningFeedback } from '@/services/haptics';
import { speakIt } from '@/services/italian-tts';
import {
  generateListenQuestions,
  type GeneratedListenQuestion,
} from '@/services/listen-questions-ai-client';

const C = {
  bg: '#F4F8FC',
  surface: '#FFFFFF',
  surface2: '#EDF2F7',
  border: '#D7E2EC',
  text: '#26303A',
  muted: '#5E6B78',
  dim: '#94A3AF',
  blue: '#1479C9',
  blueDark: '#0E5A99',
  blueSoft: '#DCEEFF',
  primary: '#2FB344',
  primaryDark: '#1F7A34',
  primarySoft: '#DDF5D6',
  red: '#D63D3D',
  redSoft: '#FFE4E4',
} as const;

export default function ListenExerciseScreen() {
  const params = useLocalSearchParams<{ missionId: string }>();
  const insets = useSafeAreaInsets();
  const mission = useMemo(
    () => (params.missionId ? getMissionById(params.missionId) : undefined),
    [params.missionId],
  );

  if (!mission) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingHorizontal: 20 }]}>
        <Stack.Screen options={{ title: 'Introuvable' }} />
        <Text style={styles.errorText}>Mission introuvable.</Text>
      </View>
    );
  }

  return <ListenContent mission={mission} />;
}

function ListenContent({ mission }: { mission: B2BMission }) {
  const insets = useSafeAreaInsets();
  const accent = ACCENT_COLORS[mission.accent];

  const [wordHighlight, setWordHighlight] = useState(-1);
  const [listenIndex, setListenIndex] = useState(0);
  const [listenChoiceId, setListenChoiceId] = useState<string | null>(null);
  const [listenPlayed, setListenPlayed] = useState(false);
  const [score, setScore] = useState(0);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedListenQuestion[] | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const audioTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const staticQuestions = useMemo<ListenActionQuestion[]>(() => {
    const list = listenActionQuestions.filter((q) => mission.listenQuestionIds.includes(q.id));
    return list.length > 0 ? list : listenActionQuestions.slice(0, 1);
  }, [mission.listenQuestionIds]);

  const activeQuestions: (ListenActionQuestion | GeneratedListenQuestion)[] =
    generatedQuestions ?? staticQuestions;

  useEffect(() => {
    let cancelled = false;
    setQuestionsLoading(true);
    generateListenQuestions(mission).then((result) => {
      if (cancelled) return;
      setGeneratedQuestions(result);
      setQuestionsLoading(false);
    });
    return () => { cancelled = true; };
  }, [mission.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { audioTimers.current.forEach(clearTimeout); }, []);

  const listenQuestion = activeQuestions[listenIndex % activeQuestions.length]!;
  const listenWords = useMemo(() => listenQuestion.audioIt.split(' '), [listenQuestion.audioIt]);
  const playing = wordHighlight >= 0 && wordHighlight < listenWords.length;

  const playAudio = useCallback(() => {
    void tapFeedback();
    audioTimers.current.forEach(clearTimeout);
    audioTimers.current = [];
    setListenChoiceId(null);
    setWordHighlight(0);
    setListenPlayed(true);
    speakIt(listenQuestion.audioIt, { rate: 0.88 });
    let cumulative = 0;
    listenWords.forEach((word, i) => {
      const dur = Math.max(320, word.replace(/\W/g, '').length * 92) / 0.88;
      const t = setTimeout(() => setWordHighlight(i + 1), cumulative + dur);
      audioTimers.current.push(t);
      cumulative += dur;
    });
  }, [listenQuestion.audioIt, listenWords]);

  const answerListen = useCallback(async (choiceId: string) => {
    if (!listenPlayed || listenChoiceId !== null) return;
    setListenChoiceId(choiceId);
    const ok = choiceId === listenQuestion.answerId;
    if (ok) { setScore((s) => s + 1); void successFeedback(); } else { void warningFeedback(); }
    await addXp(ok ? 25 : 5).catch(() => null);
    await insertLearningSession({ sessionType: 'quiz', durationSeconds: 45, cardsReviewed: 1, scoreAvg: ok ? 100 : 40 }).catch(() => null);
    setTimeout(() => {
      audioTimers.current.forEach(clearTimeout);
      audioTimers.current = [];
      setListenIndex((i) => (i + 1) % activeQuestions.length);
      setListenChoiceId(null);
      setListenPlayed(false);
      setWordHighlight(-1);
    }, 1600);
  }, [activeQuestions.length, listenChoiceId, listenPlayed, listenQuestion.answerId]);

  const total = activeQuestions.length;
  const current = (listenIndex % total) + 1;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.blue} />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerKicker}>Échauffement</Text>
          <Text style={styles.headerTitle}>🎧 Écoute & réaction</Text>
        </View>
        <View style={styles.scorePill}>
          <Text style={styles.scorePillText}>★ {score}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.progressBar}>
          {questionsLoading ? null : Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.progressDot, i < current && { backgroundColor: C.blue }]} />
          ))}
        </View>

        {questionsLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={C.blue} />
            <Text style={styles.loadingText}>L&apos;IA prépare des situations sur-mesure…</Text>
          </View>
        ) : (
          <Animated.View key={listenIndex} entering={FadeInDown.duration(360)} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Le client dit</Text>
              <Text style={styles.cardCount}>{current} / {total}</Text>
            </View>

            <Pulser playing={playing} accent={C.blue}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={listenPlayed ? 'Réécouter' : 'Écouter le client'}
                onPress={playAudio}
                style={({ pressed }) => [styles.playButton, playing && styles.playButtonActive, pressed && styles.pressed]}>
                <Text style={styles.playEmoji}>{playing ? '🔊' : '▶'}</Text>
              </Pressable>
            </Pulser>
            <Text style={styles.playHint}>{playing ? 'En cours…' : listenPlayed ? 'Touche pour réécouter' : 'Touche pour écouter'}</Text>

            <View style={styles.wordRow}>
              {listenWords.map((word, i) => {
                const isActive = wordHighlight === i;
                const isDone = wordHighlight > i && wordHighlight < listenWords.length;
                return (
                  <View key={`${word}-${i}`} style={[styles.wordChip, isActive && styles.wordChipActive, isDone && styles.wordChipDone]}>
                    <Text style={[styles.wordText, isActive && styles.wordTextActive, isDone && styles.wordTextDone]}>{word}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.divider} />
            <Text style={styles.promptQ}>Quelle est la bonne réaction ?</Text>

            <View style={styles.choiceList}>
              {listenQuestion.choices.map((choice, i) => {
                const answered = listenChoiceId !== null;
                const correct = choice.id === listenQuestion.answerId;
                const selected = choice.id === listenChoiceId;
                return (
                  <Animated.View key={choice.id} entering={FadeIn.duration(280).delay(i * 50)}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Choisir ${choice.label}`}
                      accessibilityState={{ selected, disabled: !listenPlayed || answered }}
                      disabled={!listenPlayed || answered}
                      onPress={() => answerListen(choice.id)}
                      style={[styles.choice, !listenPlayed && styles.choiceDisabled, answered && correct && styles.choiceCorrect, answered && selected && !correct && styles.choiceWrong]}>
                      <Text style={styles.choiceText}>{choice.label}</Text>
                      {answered && correct ? <Text style={styles.choiceMark}>✓</Text> : null}
                      {answered && selected && !correct ? <Text style={[styles.choiceMark, { color: C.red }]}>✗</Text> : null}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function Pulser({ playing, accent, children }: { playing: boolean; accent: string; children: React.ReactNode }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (playing) {
      pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1);
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [playing, pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + pulse.value * 0.3,
    transform: [{ scale: 1 + pulse.value * 0.28 }],
  }));
  return (
    <View style={styles.pulseStack}>
      <Animated.View style={[styles.glow, { backgroundColor: accent }, glowStyle]} />
      {children}
    </View>
  );
}

const PLAY = 84;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.blue, paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', lineHeight: 28, marginTop: -2 },
  headerTextWrap: { flex: 1 },
  headerKicker: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  scorePill: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  scorePillText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  scroll: { padding: 18, gap: 16 },
  progressBar: { flexDirection: 'row', gap: 6 },
  progressDot: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.border },
  loadingBox: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  loadingText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: C.surface, borderRadius: 24, borderWidth: 1, borderColor: C.border, padding: 18, gap: 12, alignItems: 'center', boxShadow: '0 6px 16px rgba(20,121,201,0.08)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  cardLabel: { color: C.dim, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  cardCount: { color: C.blue, fontSize: 12, fontWeight: '900' },
  pulseStack: { alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  glow: { position: 'absolute', width: PLAY + 22, height: PLAY + 22, borderRadius: (PLAY + 22) / 2 },
  playButton: { width: PLAY, height: PLAY, borderRadius: PLAY / 2, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 0 rgba(14,90,153,0.5)' },
  playButtonActive: { backgroundColor: C.blueDark },
  playEmoji: { fontSize: 34, color: '#FFFFFF' },
  playHint: { color: C.muted, fontSize: 12, fontWeight: '800' },
  wordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  wordChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: C.surface2 },
  wordChipActive: { backgroundColor: C.blueDark },
  wordChipDone: { backgroundColor: C.blueSoft },
  wordText: { color: C.text, fontSize: 17, fontWeight: '800' },
  wordTextActive: { color: '#FFFFFF' },
  wordTextDone: { color: C.blueDark },
  divider: { height: 1, backgroundColor: C.border, width: '100%', marginTop: 4 },
  promptQ: { color: C.text, fontSize: 15, fontWeight: '900', alignSelf: 'flex-start' },
  choiceList: { gap: 8, width: '100%' },
  choice: { borderRadius: 16, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface2, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  choiceDisabled: { opacity: 0.55 },
  choiceCorrect: { backgroundColor: C.primarySoft, borderColor: C.primary },
  choiceWrong: { backgroundColor: C.redSoft, borderColor: C.red },
  choiceText: { flex: 1, color: C.text, fontSize: 14, fontWeight: '800', lineHeight: 19 },
  choiceMark: { color: C.primaryDark, fontSize: 18, fontWeight: '900' },
  pressed: { opacity: 0.85 },
  errorText: { color: C.text, fontSize: 16, fontWeight: '800' },
});
