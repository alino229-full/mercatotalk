import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ACCENT_COLORS, b2bMissions, getMissionById, type B2BMission } from '@/data/b2b-missions';
import { tapFeedback } from '@/services/haptics';
import { useCallSessionStore } from '@/stores/call-session-store';

const C = {
  bg: '#F8FAF7',
  surface: '#FFFFFC',
  border: '#DDE5D8',
  primary: '#2FB344',
  text: '#3C3C3C',
  muted: '#667064',
  dim: '#94A091',
  blue: '#1479C9',
  blueSoft: '#DCEEFF',
  orange: '#C97800',
  orangeSoft: '#FFF1D8',
} as const;

type PrepCard = {
  key: string;
  emoji: string;
  label: string;
  title: string;
  body: string;
  tint: string;
  tintSoft: string;
  route: (missionId: string) => string;
};

const PREP_CARDS: readonly PrepCard[] = [
  {
    key: 'listen',
    emoji: '🎧',
    label: 'Échauffement',
    title: 'Écoute & réaction',
    body: 'Comprends ce que dit le client et choisis la bonne réaction.',
    tint: C.blue,
    tintSoft: C.blueSoft,
    route: (id) => `/b2b/listen/${id}`,
  },
  {
    key: 'drill',
    emoji: '🔢',
    label: 'Échauffement',
    title: 'Entraînement chiffres',
    body: 'Prix, dimensions, dates : capte les chiffres à l’oreille.',
    tint: C.orange,
    tintSoft: C.orangeSoft,
    route: (id) => `/b2b/drill/${id}`,
  },
] as const;

export default function MissionDetailScreen() {
  const params = useLocalSearchParams<{ missionId: string }>();
  const insets = useSafeAreaInsets();
  const setActiveScenarioId = useCallSessionStore((state) => state.setActiveScenarioId);

  const mission = useMemo(
    () => (params.missionId ? getMissionById(params.missionId) : undefined),
    [params.missionId],
  );

  if (!mission) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingHorizontal: 20 }]}>
        <Stack.Screen options={{ title: 'Mission introuvable' }} />
        <Text selectable style={styles.errorText}>Cette mission n&apos;existe pas.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backFallback}>
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return <MissionContent mission={mission} setActiveScenarioId={setActiveScenarioId} />;
}

function MissionContent({
  mission,
  setActiveScenarioId,
}: {
  mission: B2BMission;
  setActiveScenarioId: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const accent = ACCENT_COLORS[mission.accent];

  const startCall = useCallback(() => {
    void tapFeedback();
    setActiveScenarioId(mission.scenarioId);
    router.push('/(tabs)/call');
  }, [mission.scenarioId, setActiveScenarioId]);

  const openPrep = useCallback((card: PrepCard) => {
    void tapFeedback();
    router.push(card.route(mission.id) as never);
  }, [mission.id]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={accent.bg} />
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <View style={[styles.hero, { backgroundColor: accent.bg, paddingTop: insets.top + 12 }]}>
          <View style={styles.heroTop}>
            <Pressable accessibilityRole="button" accessibilityLabel="Revenir aux missions" onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
              <Text style={styles.backBtnText}>‹</Text>
            </Pressable>
            <View style={[styles.levelTag, { backgroundColor: accent.tag }]}>
              <Text style={[styles.levelTagText, { color: accent.tagText }]}>{mission.level}</Text>
            </View>
          </View>
          <Animated.View entering={FadeIn.duration(420)} style={styles.heroImageWrap}>
            {mission.image ? (
              <Image source={mission.image} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroPlaceholder, { backgroundColor: accent.bg }]}>
                <Text style={styles.heroPlaceholderEmoji}>📞</Text>
              </View>
            )}
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(380).delay(80)} style={styles.heroTextBlock}>
            <Text selectable style={styles.heroTitle}>{mission.title}</Text>
            <Text selectable style={styles.heroTagline}>{mission.tagline}</Text>
            <Text selectable style={styles.heroMeta}>≈ {mission.estimatedMinutes} min</Text>
          </Animated.View>
        </View>

        <View style={styles.body}>
          <Animated.View entering={FadeInDown.duration(380).delay(120)} style={styles.callCard}>
            <Text selectable style={styles.cardKicker}>Étape principale</Text>
            <Text selectable style={styles.cardTitle}>Lancer l&apos;appel client</Text>
            <Text selectable style={styles.cardBody}>Tu es mis directement en situation. Le client commence, à toi de décrocher et conduire l&apos;échange.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Lancer l'appel ${mission.title}`} onPress={startCall} style={({ pressed }) => [styles.bigCta, pressed && styles.pressed]}>
              <Text style={styles.bigCtaText}>📞  Lancer l&apos;appel</Text>
            </Pressable>
          </Animated.View>

          <Text selectable style={styles.sectionHint}>Avant de décrocher, échauffe-toi</Text>

          {PREP_CARDS.map((card, i) => (
            <Animated.View key={card.key} entering={FadeInDown.duration(360).delay(180 + i * 80)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir ${card.title}`}
                onPress={() => openPrep(card)}
                style={({ pressed }) => [styles.prepCard, pressed && styles.prepCardPressed]}>
                <View style={[styles.prepIcon, { backgroundColor: card.tintSoft }]}>
                  <Text style={styles.prepEmoji}>{card.emoji}</Text>
                </View>
                <View style={styles.prepTextWrap}>
                  <Text selectable style={[styles.prepLabel, { color: card.tint }]}>{card.label}</Text>
                  <Text selectable style={styles.prepTitle}>{card.title}</Text>
                  <Text selectable style={styles.prepBody}>{card.body}</Text>
                </View>
                <Text style={[styles.prepChevron, { color: card.tint }]}>›</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function _allMissionsCount() {
  return b2bMissions.length;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { gap: 0 },
  hero: { paddingHorizontal: 18, paddingBottom: 22, gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', lineHeight: 28, marginTop: -2 },
  levelTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  levelTagText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroImageWrap: { borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', height: 200 },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroPlaceholderEmoji: { fontSize: 64 },
  heroTextBlock: { gap: 6 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', lineHeight: 27 },
  heroTagline: { color: 'rgba(255,255,255,0.92)', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  heroMeta: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  body: { padding: 18, gap: 14 },
  callCard: { backgroundColor: '#1F2937', borderRadius: 22, padding: 18, gap: 8 },
  cardKicker: { color: '#9DD8A0', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  cardTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  cardBody: { color: '#D1D5DB', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  bigCta: { backgroundColor: C.primary, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  bigCtaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  sectionHint: { color: C.dim, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 4, marginBottom: -2 },
  prepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
  },
  prepCardPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  prepIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  prepEmoji: { fontSize: 26 },
  prepTextWrap: { flex: 1, gap: 2 },
  prepLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  prepTitle: { color: C.text, fontSize: 16, fontWeight: '900' },
  prepBody: { color: C.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  prepChevron: { fontSize: 28, fontWeight: '900', marginTop: -2 },
  pressed: { opacity: 0.85 },
  errorText: { color: C.text, fontSize: 16, fontWeight: '800' },
  backFallback: { marginTop: 16, alignSelf: 'flex-start', backgroundColor: C.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  backText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
