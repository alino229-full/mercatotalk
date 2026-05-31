import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cultureCards, dailyB2BNews, roadmap120 } from '@/data/b2b-operational';
import {
  getCallReplays,
  getDayProgress,
  type CallReplayRow,
  type DayProgressRow,
} from '@/database/italpro-local-db';
import { speakIt } from '@/services/italian-tts';

const C = {
  bg: '#F8FAF7',
  surface: '#FFFFFC',
  surface2: '#EEF2EC',
  border: '#DDE5D8',
  primary: '#2FB344',
  primaryDark: '#1F7A34',
  primarySoft: '#DDF5D6',
  text: '#3C3C3C',
  muted: '#667064',
  dim: '#94A091',
  orange: '#C97800',
  orangeSoft: '#FFF1D8',
} as const;

export default function ParcoursScreen() {
  const insets = useSafeAreaInsets();
  const [replays, setReplays] = useState<CallReplayRow[]>([]);
  const [dayInfo, setDayInfo] = useState<DayProgressRow>({ daysActive: 0, daysSinceStart: 0, firstSessionAt: null });

  const load = useCallback(async () => {
    const [savedReplays, day] = await Promise.all([getCallReplays(8), getDayProgress()]);
    setReplays(savedReplays);
    setDayInfo(day);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const dayNumber = Math.min(120, Math.max(0, dayInfo.daysSinceStart));
  const remaining = Math.max(0, 120 - dayNumber);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour aux missions" onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text selectable style={styles.kicker}>Parcours global</Text>
          <Text selectable style={styles.title}>Mon parcours 120 jours</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text selectable style={styles.cardLabel}>Roadmap 120 jours</Text>
          <View style={{ gap: 12 }}>
            {roadmap120.map((item, index) => {
              const previousDay = index === 0 ? 0 : roadmap120[index - 1]!.day;
              const reached = dayNumber >= item.day;
              const current = !reached && dayNumber >= previousDay;
              return (
                <View key={item.day} style={styles.milestone}>
                  <View style={[styles.milestoneDot, reached && styles.milestoneDotDone, current && styles.milestoneDotCurrent]}>
                    <Text style={[styles.milestoneDay, reached && styles.milestoneDayDone]}>{item.title}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text selectable style={styles.milestonePromise}>{item.promise}</Text>
                    <Text selectable style={styles.milestoneGate}>Objectif : {item.gate}</Text>
                  </View>
                  {reached ? <Text style={styles.milestoneCheck}>✓</Text> : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text selectable style={styles.cardLabel}>L&apos;actu pro italienne</Text>
            <Text selectable style={styles.cardCount}>1 min</Text>
          </View>
          <Text selectable style={styles.newsTitle}>{dailyB2BNews.title}</Text>
          <Text selectable style={styles.newsBody}>{dailyB2BNews.it}</Text>
          <View style={styles.keywordRow}>
            {dailyB2BNews.keywords.map((word) => (
              <Pressable key={word} accessibilityRole="button" accessibilityLabel={`Ecouter ${word}`} onPress={() => speakIt(word, { preferDeepgram: true })} style={styles.keyword}>
                <Text style={styles.keywordText}>{word}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text selectable style={styles.cardLabel}>Mes appels enregistrés</Text>
            <Text selectable style={styles.cardCount}>{replays.length}</Text>
          </View>
          {replays.length === 0 ? (
            <Text selectable style={styles.empty}>Aucun appel enregistré pour l&apos;instant.</Text>
          ) : (
            replays.map((replay) => (
              <View key={replay.id} style={styles.replayRow}>
                <Text selectable style={styles.replayTitle}>{replay.title}</Text>
                <Text selectable style={styles.replayMeta}>{Math.round(replay.durationSeconds)}s · score {replay.score ?? '--'}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text selectable style={styles.cardLabel}>Codes pro à l&apos;italienne</Text>
          {cultureCards.map((card) => (
            <View key={card.title} style={styles.cultureItem}>
              <Text selectable style={styles.cultureTitle}>{card.title}</Text>
              <Text selectable style={styles.cultureBody}>{card.body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.certificateCard}>
          <Text selectable style={styles.certificateKicker}>Objectif final</Text>
          <Text selectable style={styles.certificateTitle}>MercatoTalk · Certificat B2B</Text>
          <Text selectable style={styles.certificateSub}>
            {remaining > 0
              ? `Encore ${remaining} jour${remaining > 1 ? 's' : ''} pour le test final : 30 min · 10 quiz · 1 appel libre noté ≥ 80/100.`
              : 'Tu peux lancer le test final : 30 min · 10 quiz · 1 appel libre noté ≥ 80/100.'}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={remaining > 0 ? "S'entrainer sur un appel" : 'Lancer le test final'} onPress={() => router.push('/(tabs)/call')} style={({ pressed }) => [styles.certificateButton, pressed && styles.pressed]}>
            <Text style={styles.certificateButtonText}>{remaining > 0 ? "S'entraîner sur un appel" : 'Lancer le test final'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.bg,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: C.text, fontSize: 26, fontWeight: '900', lineHeight: 28, marginTop: -2 },
  kicker: { color: C.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { color: C.text, fontSize: 24, fontWeight: '900' },
  scroll: { padding: 20, paddingBottom: 44, gap: 14 },
  card: { backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardLabel: { color: C.dim, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  cardCount: { color: C.primary, fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.85 },
  milestone: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  milestoneDot: { width: 50, height: 50, borderRadius: 16, backgroundColor: C.surface2, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  milestoneDotCurrent: { backgroundColor: C.orangeSoft, borderColor: C.orange },
  milestoneDotDone: { backgroundColor: C.primary, borderColor: C.primaryDark },
  milestoneDay: { color: C.muted, fontSize: 13, fontWeight: '900' },
  milestoneDayDone: { color: '#FFFFFF' },
  milestonePromise: { color: C.text, fontSize: 14, fontWeight: '900', lineHeight: 19 },
  milestoneGate: { color: C.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  milestoneCheck: { color: C.primaryDark, fontSize: 22, fontWeight: '900' },
  newsTitle: { color: C.text, fontSize: 17, fontWeight: '900' },
  newsBody: { color: C.text, fontSize: 14, fontWeight: '700', lineHeight: 21 },
  keywordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  keyword: { backgroundColor: C.orangeSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  keywordText: { color: C.orange, fontSize: 11, fontWeight: '900' },
  replayRow: { backgroundColor: C.surface2, borderRadius: 14, padding: 12, gap: 3 },
  replayTitle: { color: C.text, fontSize: 14, fontWeight: '900' },
  replayMeta: { color: C.muted, fontSize: 11, fontWeight: '700' },
  empty: { color: C.muted, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  cultureItem: { backgroundColor: C.surface2, borderRadius: 14, padding: 12, gap: 4 },
  cultureTitle: { color: C.text, fontSize: 14, fontWeight: '900' },
  cultureBody: { color: C.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  certificateCard: { backgroundColor: '#1F2937', borderRadius: 24, padding: 20, gap: 8 },
  certificateKicker: { color: C.primary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  certificateTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  certificateSub: { color: '#D1D5DB', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  certificateButton: { alignSelf: 'flex-start', backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, marginTop: 4 },
  certificateButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
