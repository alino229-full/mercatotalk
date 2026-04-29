import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
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

import { CircularRing } from '@/components/italpro/circular-ring';
import { useDailyStats } from '@/hooks/use-daily-learning-plan';
import { useItalianTTS } from '@/hooks/use-italian-tts';
import { useDailyPhrase } from '@/hooks/use-daily-phrase';
import { useXp } from '@/hooks/use-xp';
import { getDailyXpEarned, getDailySetting, setDailySetting } from '@/database/italpro-local-db';

const C = {
  bg: '#F7F7F7',
  surface: '#FFFFFF',
  border: '#E5E5E5',
  primary: '#58CC02',
  primaryDark: '#46A302',
  primaryLight: '#D7F5B1',
  text: '#3C3C3C',
  muted: '#777777',
  dim: '#AFAFAF',
  streak: '#FF9600',
  blue: '#1CB0F6',
  blueLight: '#D0F0FF',
  purple: '#CE82FF',
  purpleLight: '#F0E0FF',
  orange: '#FF9600',
} as const;

const DAILY_GOALS = [20, 50, 100] as const;
type DailyGoal = typeof DAILY_GOALS[number];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const stats = useDailyStats();
  const xp = useXp();
  const tts = useItalianTTS();
  const { reload } = stats;

  const dailyPhrase = useDailyPhrase();
  const [dailyGoal, setDailyGoalState] = useState<DailyGoal>(50);
  const [dailyXpEarned, setDailyXpEarned] = useState(0);

  const loadDailyGoal = useCallback(async () => {
    const [goalStr, earned] = await Promise.all([
      getDailySetting('daily_goal', '50'),
      getDailyXpEarned(),
    ]);
    setDailyGoalState((parseInt(goalStr, 10) as DailyGoal) || 50);
    setDailyXpEarned(earned);
  }, []);

  const cycleGoal = useCallback(async () => {
    const idx = DAILY_GOALS.indexOf(dailyGoal);
    const next = DAILY_GOALS[(idx + 1) % DAILY_GOALS.length]!;
    setDailyGoalState(next);
    await setDailySetting('daily_goal', String(next));
  }, [dailyGoal]);

  useFocusEffect(
    useCallback(() => {
      reload();
      loadDailyGoal();
    }, [reload, loadDailyGoal]),
  );

  const speakPhrase = useCallback(() => {
    if (!dailyPhrase.phrase) return;
    tts.speak(dailyPhrase.phrase.it, { rate: 0.88, pitch: 1 });
  }, [dailyPhrase.phrase, tts]);

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const goalPct = Math.min(1, dailyXpEarned / dailyGoal);
  const goalDone = dailyXpEarned >= dailyGoal;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Fixed header ─────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appName}>MercatoTalk</Text>
          <Text style={styles.dateText}>{today}</Text>
        </View>
        <View style={styles.headerCluster}>
          <View style={styles.streakChip}>
            <Text style={styles.streakChipIcon}>🔥</Text>
            <Text style={styles.streakChipNum}>{stats.streak}</Text>
          </View>
          {xp.profile ? (
            <View style={styles.levelChip}>
              <Text style={styles.levelChipNum}>Niv. {xp.profile.level}</Text>
              <Text style={styles.levelChipXp}>{xp.profile.totalXp} XP</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Scrollable content ───────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>

        {/* ── Stats row ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.statsRow}>
          <StatPill value={`${stats.minutesToday}`} label="min" icon="⏱" color={C.blue} bg={C.blueLight} />
          <StatPill value={`${stats.dueCards}`} label="à réviser" icon="📚" color={C.purple} bg={C.purpleLight} />
          <StatPill value={`${stats.masteredCards}`} label="maîtrisées" icon="⭐" color={C.primary} bg={C.primaryLight} />
        </Animated.View>

        {/* ── Objectif journalier ────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.goalCard}>
          <CircularRing
            size={88}
            stroke={9}
            progress={goalPct}
            color={goalDone ? C.primary : C.orange}
            animDelay={150}>
            <Text style={[styles.ringPct, { color: goalDone ? C.primary : C.orange }]}>
              {goalDone ? '✓' : `${Math.round(goalPct * 100)}%`}
            </Text>
            <Text style={styles.ringLabel}>{goalDone ? 'fait' : `${dailyGoal} XP`}</Text>
          </CircularRing>
          <View style={styles.goalRight}>
            <Text style={styles.goalTitle}>
              {goalDone ? 'Objectif atteint 🎉' : 'Objectif du jour'}
            </Text>
            <Text style={styles.goalSub}>
              {dailyXpEarned} / {dailyGoal} XP
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Changer l'objectif du jour, actuellement ${dailyGoal} XP`}
              onPress={cycleGoal}
              style={styles.goalChip}>
              <Text style={styles.goalChipText}>Changer l&apos;objectif  ↺</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/(tabs)/practice', params: { quick: '1' } })}
              style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}>
              <Text style={styles.quickBtnText}>⚡ Réviser 5 min</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── CTA quiz ───────────────────────────────────────────────────── */}
        {stats.dueCards > 0 ? (
          <Pressable
            onPress={() => router.push('/(tabs)/practice')}
            style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}>
            <Text style={styles.ctaTitle}>Réviser maintenant</Text>
            <Text style={styles.ctaSub}>{stats.dueCards} mot{stats.dueCards > 1 ? 's' : ''} prêt{stats.dueCards > 1 ? 's' : ''} à revoir</Text>
          </Pressable>
        ) : (
          <View style={[styles.ctaBtn, styles.ctaBtnDone]}>
            <Text style={[styles.ctaTitle, { color: C.primaryDark }]}>Tu es à jour ✓</Text>
            <Text style={[styles.ctaSub, { color: C.primary }]}>Reviens demain pour la suite</Text>
          </View>
        )}

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.b2bCommand}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.b2bTitle}>Échauffement avant appel</Text>
            <Text style={styles.b2bSub}>2 minutes pour réveiller ton italien : chiffres, phrases clés, prononciation.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lancer l'échauffement avant appel"
            onPress={() => router.push('/(tabs)/b2b')}
            style={({ pressed }) => [styles.b2bButton, pressed && styles.quickBtnPressed]}>
            <Text style={styles.b2bButtonText}>Lancer</Text>
          </Pressable>
        </Animated.View>

        {/* ── Phrase du jour ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.phraseHeader}>
            <Text style={styles.cardLabel}>Phrase du jour</Text>
            {dailyPhrase.phrase ? (
              <View style={styles.contextBadge}>
                <Text style={styles.contextBadgeText}>
                  {dailyPhrase.phrase.contextEmoji} {dailyPhrase.phrase.context}
                </Text>
              </View>
            ) : null}
          </View>
          {dailyPhrase.phrase ? (
            <>
              <Text style={styles.italianPhrase}>{dailyPhrase.phrase.it}</Text>
              <Text style={styles.frenchPhrase}>{dailyPhrase.phrase.fr}</Text>
              {dailyPhrase.phrase.phonetic ? (
                <Text style={styles.phonetic}>{dailyPhrase.phrase.phonetic}</Text>
              ) : null}
              <View style={styles.phraseActions}>
                <Pressable
                  onPress={speakPhrase}
                  style={({ pressed }) => [styles.playBtn, pressed && styles.playBtnPressed]}>
                  <Text style={styles.playBtnText}>▶  Écouter en italien</Text>
                </Pressable>
              </View>
            </>
          ) : dailyPhrase.isLoading ? (
            <View style={styles.phraseLoading}>
              <ActivityIndicator color={C.primary} size="small" />
              <Text style={styles.phraseLoadingText}>Ta phrase du jour arrive...</Text>
            </View>
          ) : null}
        </View>

        {/* ── Navigation rapide ──────────────────────────────────────────── */}
        <View style={styles.quickNav}>
          <QuickNavCard
            icon="📖"
            title="Leçons"
            sub="Programme complet"
            color={C.blue}
            onPress={() => router.push('/(tabs)/learn')}
          />
          <QuickNavCard
            icon="📞"
            title="Simuler un appel"
            sub="Mise en situation B2B"
            color={C.primary}
            onPress={() => router.push('/(tabs)/call')}
          />
        </View>

        {/* ── Mémoire long terme ─────────────────────────────────────────── */}
        {stats.totalCards > 0 && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.card}>
            <Text style={styles.cardLabel}>Tes mots maîtrisés</Text>
            <View style={styles.ringWrapper}>
              <CircularRing
                size={110}
                stroke={10}
                progress={stats.masteredCards / stats.totalCards}
                color={C.primary}
                animDelay={250}>
                <Text style={styles.ringPct}>
                  {Math.round((stats.masteredCards / stats.totalCards) * 100)}%
                </Text>
                <Text style={styles.ringLabel}>acquis</Text>
              </CircularRing>
              <Text style={styles.ringLegendText}>
                <Text style={{ color: C.primary, fontWeight: '900' }}>{stats.masteredCards}</Text>
                <Text style={{ color: C.muted }}> / {stats.totalCards} mots en mémoire</Text>
              </Text>
            </View>
          </Animated.View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ icon, value, label, color, bg }: { icon: string; value: string; label: string; color: string; bg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={styles.pillIcon}>{icon}</Text>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

function QuickNavCard({ icon, title, sub, color, onPress }: { icon: string; title: string; sub: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickCard, pressed && { opacity: 0.85 }]}>
      <View style={[styles.quickCardIconBg, { backgroundColor: color + '22' }]}>
        <Text style={styles.quickCardIcon}>{icon}</Text>
      </View>
      <Text style={styles.quickCardTitle}>{title}</Text>
      <Text style={styles.quickCardSub}>{sub}</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.bg,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  appName: { color: C.primary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  dateText: { color: C.dim, fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
  headerCluster: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF3E0', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7,
  },
  streakChipIcon: { fontSize: 14 },
  streakChipNum: { color: C.streak, fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  levelChip: {
    backgroundColor: C.primaryLight, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6,
    alignItems: 'center',
  },
  levelChipNum: { color: C.primaryDark, fontSize: 13, fontWeight: '900', lineHeight: 16 },
  levelChipXp: { color: C.primaryDark, fontSize: 10, fontWeight: '700', opacity: 0.8 },
  scroll: { padding: 20, paddingBottom: 40, gap: 14 },
  statsRow: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 2 },
  pillIcon: { fontSize: 18 },
  pillValue: { fontSize: 22, fontWeight: '900' },
  pillLabel: { fontSize: 11, fontWeight: '600', opacity: 0.8 },

  goalCard: {
    backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  goalRight: { flex: 1, gap: 8 },
  goalTitle: { color: C.text, fontSize: 16, fontWeight: '900' },
  goalSub: { color: C.muted, fontSize: 13, fontWeight: '700' },
  goalChip: {
    alignSelf: 'flex-start', backgroundColor: C.bg, borderRadius: 999, borderWidth: 1,
    borderColor: C.border, paddingHorizontal: 12, paddingVertical: 5,
  },
  goalChipText: { color: C.muted, fontSize: 11, fontWeight: '800' },
  quickBtn: {
    backgroundColor: C.orange + '18', borderRadius: 14, borderWidth: 1.5,
    borderColor: C.orange + '44', paddingHorizontal: 12, paddingVertical: 9, alignSelf: 'flex-start',
  },
  quickBtnPressed: { backgroundColor: C.orange + '30' },
  quickBtnText: { color: C.orange, fontSize: 13, fontWeight: '900' },

  ctaBtn: {
    backgroundColor: C.primary, borderRadius: 18, padding: 20, alignItems: 'center', gap: 4,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
    shadowRadius: 8, elevation: 4,
  },
  ctaBtnPressed: { backgroundColor: C.primaryDark },
  ctaBtnDone: { backgroundColor: C.primaryLight, shadowColor: 'transparent', elevation: 0 },
  ctaTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  ctaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  card: {
    backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 20, gap: 8,
  },
  cardLabel: { color: C.dim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  phraseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  contextBadge: { backgroundColor: C.primaryLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  contextBadgeText: { color: C.primaryDark, fontSize: 11, fontWeight: '800' },
  phraseLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  phraseLoadingText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  italianPhrase: { color: C.text, fontSize: 17, fontWeight: '700', lineHeight: 25 },
  frenchPhrase: { color: C.muted, fontSize: 14, lineHeight: 20 },
  phonetic: { color: C.dim, fontSize: 12, fontStyle: 'italic' },
  phraseActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  playBtn: {
    alignSelf: 'flex-start', backgroundColor: C.primary, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  playBtnPressed: { backgroundColor: C.primaryDark },
  playBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  quickNav: { flexDirection: 'row', gap: 12 },
  b2bCommand: {
    backgroundColor: '#1F2937', borderRadius: 22, padding: 18, flexDirection: 'row',
    alignItems: 'center', gap: 12,
  },
  b2bTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  b2bSub: { color: '#D1D5DB', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  b2bButton: { backgroundColor: C.primary, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  b2bButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  quickCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 6,
  },
  quickCardIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  quickCardIcon: { fontSize: 22 },
  quickCardTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  quickCardSub: { color: C.dim, fontSize: 12 },
  ringWrapper: { alignItems: 'center', paddingVertical: 8, gap: 12 },
  ringPct: { color: C.primary, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  ringLabel: { color: C.muted, fontSize: 11, fontWeight: '700' },
  ringLegendText: { fontSize: 14 },
});
