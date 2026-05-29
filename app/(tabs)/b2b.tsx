import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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

import { ACCENT_COLORS, b2bMissions, type B2BMission } from '@/data/b2b-missions';
import { getDayProgress, type DayProgressRow } from '@/database/italpro-local-db';

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
  blue: '#1479C9',
  blueSoft: '#DCEEFF',
} as const;

type LevelFilter = 'all' | 'Débutant' | 'Intermédiaire' | 'Avancé';

const FILTERS: { id: LevelFilter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'Débutant', label: 'Débutant' },
  { id: 'Intermédiaire', label: 'Intermédiaire' },
  { id: 'Avancé', label: 'Avancé' },
];

export default function B2BScreen() {
  const insets = useSafeAreaInsets();
  const [dayInfo, setDayInfo] = useState<DayProgressRow>({ daysActive: 0, daysSinceStart: 0, firstSessionAt: null });
  const [filter, setFilter] = useState<LevelFilter>('all');

  const load = useCallback(async () => {
    const day = await getDayProgress();
    setDayInfo(day);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const dayNumber = Math.min(120, Math.max(0, dayInfo.daysSinceStart));
  const progressPct = Math.round((dayNumber / 120) * 100);
  const visibleMissions = filter === 'all' ? b2bMissions : b2bMissions.filter((m) => m.level === filter);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text selectable style={styles.kicker}>Objectif appel client</Text>
          <Text selectable style={styles.title}>Missions B2B</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Voir mon parcours 120 jours" onPress={() => router.push('/b2b/parcours')} style={({ pressed }) => [styles.parcoursBtn, pressed && styles.pressed]}>
          <Text style={styles.parcoursBtnDay}>J{dayNumber}</Text>
          <Text style={styles.parcoursBtnLabel}>parcours</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text selectable style={styles.progressLabel}>Progression 120 jours</Text>
            <Text selectable style={styles.progressPct}>{progressPct}%</Text>
          </View>
          <View style={styles.track}><View style={[styles.trackFill, { width: `${progressPct}%` }]} /></View>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.id}
              accessibilityRole="button"
              accessibilityLabel={`Filtrer ${f.label}`}
              accessibilityState={{ selected: filter === f.id }}
              onPress={() => setFilter(f.id)}
              style={[styles.filterChip, filter === f.id && styles.filterChipActive]}>
              <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.list}>
          {visibleMissions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function MissionCard({ mission }: { mission: B2BMission }) {
  const accent = ACCENT_COLORS[mission.accent];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mission : ${mission.title}`}
      onPress={() => router.push({ pathname: '/b2b/[missionId]', params: { missionId: mission.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardImageWrap}>
        {mission.image ? (
          <Image source={mission.image} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardPlaceholder, { backgroundColor: accent.bg }]}>
            <Text style={styles.cardPlaceholderEmoji}>📞</Text>
            <Text style={styles.cardPlaceholderHint}>image à venir</Text>
          </View>
        )}
        <View style={[styles.missionTag, { backgroundColor: accent.tag }]}>
          <Text style={[styles.missionTagText, { color: accent.tagText }]}>Mission</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text selectable style={styles.cardTitle} numberOfLines={2}>{mission.title}</Text>
        <Text selectable style={styles.cardMeta}>≈ {mission.estimatedMinutes} min</Text>
      </View>
    </Pressable>
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
    alignItems: 'flex-start',
    gap: 12,
  },
  kicker: { color: C.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { color: C.text, fontSize: 28, fontWeight: '900' },
  parcoursBtn: { minWidth: 78, borderRadius: 18, backgroundColor: C.primarySoft, borderWidth: 1.5, borderColor: '#B8E986', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12 },
  parcoursBtnDay: { color: C.primaryDark, fontSize: 19, fontWeight: '900', fontVariant: ['tabular-nums'] },
  parcoursBtnLabel: { color: C.primaryDark, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  scroll: { padding: 20, paddingBottom: 44, gap: 16 },
  progressCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10 },
  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { color: C.dim, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  progressPct: { color: C.primaryDark, fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  track: { height: 10, backgroundColor: C.border, borderRadius: 5, overflow: 'hidden' },
  trackFill: { height: 10, backgroundColor: C.primary, borderRadius: 5, minWidth: 4 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: C.surface2 },
  filterChipActive: { backgroundColor: C.text },
  filterText: { color: C.muted, fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  list: { gap: 16 },
  card: { backgroundColor: '#1F2937', borderRadius: 22, overflow: 'hidden' },
  cardPressed: { opacity: 0.92 },
  cardImageWrap: { width: '100%', aspectRatio: 16 / 11, backgroundColor: '#0F172A' },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  cardPlaceholderEmoji: { fontSize: 56 },
  cardPlaceholderHint: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  missionTag: { position: 'absolute', left: 16, bottom: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  missionTagText: { fontSize: 12, fontWeight: '900' },
  cardFooter: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  cardTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', lineHeight: 22 },
  cardMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  pressed: { opacity: 0.85 },
});
