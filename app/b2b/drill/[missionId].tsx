import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ACCENT_COLORS, getMissionById, type B2BMission } from '@/data/b2b-missions';
import { addXp, insertLearningSession } from '@/database/italpro-local-db';
import { successFeedback, tapFeedback, warningFeedback } from '@/services/haptics';
import { speakIt } from '@/services/italian-tts';
import {
  buildNumberDrill,
  normalizeNumberAnswer,
  type NumberDrillItem,
  type NumberDrillMode,
} from '@/services/italian-numbers';

const C = {
  bg: '#FCF8F1',
  surface: '#FFFFFF',
  surface2: '#F3ECE0',
  border: '#E7DCC8',
  text: '#3A322A',
  muted: '#6E6353',
  dim: '#A99E8C',
  orange: '#C97800',
  orangeDark: '#9A5B00',
  orangeSoft: '#FFF1D8',
  primary: '#2FB344',
  primaryDark: '#1F7A34',
  red: '#D63D3D',
  redSoft: '#FFE4E4',
} as const;

const MODE_LABELS: Record<NumberDrillMode, string> = {
  price: 'Prix',
  dimension: 'Dimensions',
  date: 'Dates',
  plain: 'Libre',
};

export default function DrillExerciseScreen() {
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

  return <DrillContent mission={mission} />;
}

function DrillContent({ mission }: { mission: B2BMission }) {
  const insets = useSafeAreaInsets();
  const accent = ACCENT_COLORS[mission.accent];
  const initialMode = mission.numberModes[0] ?? 'price';

  const [drillMode, setDrillMode] = useState<NumberDrillMode>(initialMode);
  const [drillItem, setDrillItem] = useState<NumberDrillItem>(() => buildNumberDrill(initialMode, 2));
  const [drillAnswer, setDrillAnswer] = useState('');
  const [drillFeedback, setDrillFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [streak, setStreak] = useState(0);
  const [playing, setPlaying] = useState(false);

  const playDrill = useCallback(() => {
    void tapFeedback();
    setPlaying(true);
    speakIt(drillItem.spoken, { rate: 0.84, preferDeepgram: true });
    setTimeout(() => setPlaying(false), 1600);
  }, [drillItem.spoken]);

  const nextDrill = useCallback((mode: NumberDrillMode) => {
    const next = buildNumberDrill(mode, 2);
    setDrillItem(next);
    setDrillAnswer('');
    setDrillFeedback(null);
    setPlaying(true);
    setTimeout(() => { speakIt(next.spoken, { rate: 0.84, preferDeepgram: true }); setTimeout(() => setPlaying(false), 1600); }, 140);
  }, []);

  const changeMode = useCallback((mode: NumberDrillMode) => {
    void tapFeedback();
    setDrillMode(mode);
    setDrillItem(buildNumberDrill(mode, 2));
    setDrillAnswer('');
    setDrillFeedback(null);
  }, []);

  const submitDrill = useCallback(async () => {
    const expected = normalizeNumberAnswer(drillItem.numeric);
    const actual = normalizeNumberAnswer(drillAnswer);
    const expectedDigits = expected.replace(/[^0-9/]/g, '');
    const actualDigits = actual.replace(/[^0-9/]/g, '');
    const ok = actualDigits.length > 0 && (actual === expected || actualDigits === expectedDigits);
    setDrillFeedback({ ok, text: ok ? 'Bravo !' : `La bonne réponse : ${drillItem.numeric}` });
    if (ok) { setStreak((s) => s + 1); void successFeedback(); } else { setStreak(0); void warningFeedback(); }
    await addXp(ok ? 20 : 5).catch(() => null);
    await insertLearningSession({ sessionType: 'quiz', durationSeconds: 30, cardsReviewed: 1, scoreAvg: ok ? 100 : 40 }).catch(() => null);
    setTimeout(() => nextDrill(drillMode), ok ? 1100 : 2200);
  }, [drillAnswer, drillItem, drillMode, nextDrill]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.orange} />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerKicker}>Échauffement</Text>
          <Text style={styles.headerTitle}>🔢 Entraînement chiffres</Text>
        </View>
        <View style={styles.scorePill}>
          <Text style={styles.scorePillText}>🔥 {streak}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        {mission.numberModes.length > 1 ? (
          <View style={styles.segmented}>
            {mission.numberModes.map((mode) => (
              <Pressable key={mode} accessibilityRole="button" accessibilityLabel={`Mode ${MODE_LABELS[mode]}`} accessibilityState={{ selected: drillMode === mode }} onPress={() => changeMode(mode)} style={[styles.segment, drillMode === mode && styles.segmentActive]}>
                <Text style={[styles.segmentText, drillMode === mode && styles.segmentTextActive]}>{MODE_LABELS[mode]}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Animated.View key={drillItem.numeric + drillItem.promptFr} entering={FadeInDown.duration(360)} style={styles.card}>
          <Text style={styles.cardLabel}>{MODE_LABELS[drillMode]} · écoute</Text>

          <Pulser playing={playing} accent={C.orange}>
            <Pressable accessibilityRole="button" accessibilityLabel="Écouter l'audio" onPress={playDrill} style={({ pressed }) => [styles.playButton, playing && styles.playButtonActive, pressed && styles.pressed]}>
              <Text style={styles.playEmoji}>{playing ? '🔊' : '▶'}</Text>
            </Pressable>
          </Pulser>
          <Text style={styles.playHint}>{playing ? 'En cours…' : 'Touche pour (ré)écouter'}</Text>

          <Text selectable style={styles.prompt}>{drillItem.promptFr}</Text>

          <TextInput
            accessibilityLabel="Ta réponse"
            autoComplete="off"
            autoFocus={false}
            keyboardType={drillMode === 'date' ? 'default' : 'numeric'}
            onChangeText={setDrillAnswer}
            onSubmitEditing={submitDrill}
            placeholder={drillMode === 'date' ? 'Ex : 15/03' : 'Tape ce que tu as entendu'}
            placeholderTextColor={C.dim}
            returnKeyType="done"
            style={[styles.input, drillFeedback?.ok === true && styles.inputCorrect, drillFeedback?.ok === false && styles.inputWrong]}
            value={drillAnswer}
          />

          <Pressable accessibilityRole="button" accessibilityLabel="Valider" accessibilityState={{ disabled: !drillAnswer.trim() }} disabled={!drillAnswer.trim()} onPress={submitDrill} style={({ pressed }) => [styles.cta, !drillAnswer.trim() && styles.ctaDisabled, pressed && drillAnswer.trim() && styles.pressed]}>
            <Text style={styles.ctaText}>Valider</Text>
          </Pressable>

          {drillFeedback ? (
            <Animated.Text entering={FadeInDown.duration(240)} selectable style={[styles.feedback, { color: drillFeedback.ok ? C.primaryDark : C.red }]}>
              {drillFeedback.text}
            </Animated.Text>
          ) : null}
        </Animated.View>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.orange, paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', lineHeight: 28, marginTop: -2 },
  headerTextWrap: { flex: 1 },
  headerKicker: { color: 'rgba(255,255,255,0.82)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  scorePill: { backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  scorePillText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  scroll: { padding: 18, gap: 16 },
  segmented: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 14, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', borderRadius: 11, paddingVertical: 9 },
  segmentActive: { backgroundColor: C.surface, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' },
  segmentText: { color: C.muted, fontSize: 12, fontWeight: '900' },
  segmentTextActive: { color: C.orangeDark },
  card: { backgroundColor: C.surface, borderRadius: 24, borderWidth: 1, borderColor: C.border, padding: 18, gap: 12, alignItems: 'center', boxShadow: '0 6px 16px rgba(201,120,0,0.08)' },
  cardLabel: { color: C.dim, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7, alignSelf: 'flex-start' },
  pulseStack: { alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  glow: { position: 'absolute', width: PLAY + 22, height: PLAY + 22, borderRadius: (PLAY + 22) / 2 },
  playButton: { width: PLAY, height: PLAY, borderRadius: PLAY / 2, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 0 rgba(154,91,0,0.5)' },
  playButtonActive: { backgroundColor: C.orangeDark },
  playEmoji: { fontSize: 34, color: '#FFFFFF' },
  playHint: { color: C.muted, fontSize: 12, fontWeight: '800' },
  prompt: { color: C.text, fontSize: 15, fontWeight: '800', alignSelf: 'flex-start', lineHeight: 21 },
  input: { width: '100%', color: C.text, backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, padding: 14, fontSize: 18, fontWeight: '800' },
  inputCorrect: { borderColor: C.primary, backgroundColor: '#F0FBE6' },
  inputWrong: { borderColor: C.red, backgroundColor: C.redSoft },
  cta: { width: '100%', backgroundColor: C.orange, borderRadius: 16, alignItems: 'center', paddingVertical: 15 },
  ctaDisabled: { backgroundColor: C.border },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  feedback: { fontSize: 14, fontWeight: '900', alignSelf: 'flex-start' },
  pressed: { opacity: 0.85 },
  errorText: { color: C.text, fontSize: 16, fontWeight: '800' },
});
