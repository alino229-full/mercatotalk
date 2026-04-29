import { router, useFocusEffect } from 'expo-router';
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

import { achievements } from '@/data/achievements';
import {
  type CorrectionRow,
  type FocusStatRow,
  type LearningSessionRow,
  getRecentCorrections,
  getRecentSessions,
  getRecurringFocusStats,
  getSm2Stats,
  getStreak,
  getTodayStats,
  getWeekActivity,
  getWeeklyXpHistory,
} from '@/database/italpro-local-db';
import { useXp } from '@/hooks/use-xp';

const C = {
  bg: '#F7F7F7',
  surface: '#FFFFFF',
  surface2: '#F0F0F0',
  border: '#E5E5E5',
  primary: '#58CC02',
  primaryDark: '#46A302',
  primarySoft: '#D7F5B1',
  text: '#3C3C3C',
  muted: '#777777',
  dim: '#AFAFAF',
  orange: '#FF9600',
  orangeSoft: '#FFF0D6',
  blue: '#1CB0F6',
  blueSoft: '#D0F0FF',
  purple: '#CE82FF',
  purpleSoft: '#F0E0FF',
  red: '#FF4B4B',
  redSoft: '#FFE1E1',
} as const;

const DAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type ProgressTab = 'overview' | 'history';
type WeeklyXpEntry = { label: string; xp: number };

type ProgressData = {
  streak: number;
  minutesToday: number;
  sessionsToday: number;
  dueCount: number;
  totalCards: number;
  masteredCount: number;
  weekActivity: boolean[];
  corrections: CorrectionRow[];
  recentSessions: LearningSessionRow[];
  weeklyXp: WeeklyXpEntry[];
  focusStats: FocusStatRow[];
};

const DEFAULT_DATA: ProgressData = {
  streak: 0,
  minutesToday: 0,
  sessionsToday: 0,
  dueCount: 0,
  totalCards: 0,
  masteredCount: 0,
  weekActivity: [false, false, false, false, false, false, false],
  corrections: [],
  recentSessions: [],
  weeklyXp: [],
  focusStats: [],
};

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const xp = useXp();
  const [data, setData] = useState<ProgressData>(DEFAULT_DATA);
  const [activeTab, setActiveTab] = useState<ProgressTab>('overview');

  const load = useCallback(async () => {
    const [streak, todayStats, sm2Stats, weekActivity, corrections, recentSessions, weeklyXp, focusStats] = await Promise.all([
      getStreak(),
      getTodayStats(),
      getSm2Stats(),
      getWeekActivity(),
      getRecentCorrections(6),
      getRecentSessions(8),
      getWeeklyXpHistory(8),
      getRecurringFocusStats(5),
    ]);

    setData({
      streak,
      minutesToday: todayStats.minutesToday,
      sessionsToday: todayStats.sessionsToday,
      dueCount: sm2Stats.dueCount,
      totalCards: sm2Stats.totalCards,
      masteredCount: sm2Stats.masteredCount,
      weekActivity,
      corrections,
      recentSessions,
      weeklyXp,
      focusStats,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const masteredPct = data.totalCards > 0 ? Math.round((data.masteredCount / data.totalCards) * 100) : 0;
  const weekCount = data.weekActivity.filter(Boolean).length;
  const scoreAverage = data.corrections.length > 0
    ? Math.round(data.corrections.reduce((sum, correction) => sum + correction.score, 0) / data.corrections.length)
    : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text selectable style={styles.kicker}>Tableau de bord</Text>
          <Text selectable style={styles.pageTitle}>Progression</Text>
        </View>
        <View style={styles.masteryBadge}>
          <Text selectable style={styles.masteryValue}>{masteredPct}%</Text>
          <Text selectable style={styles.masteryLabel}>acquis</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <TabBar activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'overview' ? (
          <>
            <HeroProgressCard data={data} weekCount={weekCount} />

            {xp.profile ? <XpCard totalXp={xp.profile.totalXp} level={xp.profile.level} into={xp.profile.xpIntoLevel} next={xp.profile.xpForNextLevel} /> : null}

            <View style={styles.statsGrid}>
              <MetricCard value={data.totalCards} label="mots" color={C.blue} bg={C.blueSoft} />
              <MetricCard value={data.masteredCount} label="maîtrisés" color={C.primary} bg={C.primarySoft} />
              <MetricCard value={data.dueCount} label="à réviser" color={C.purple} bg={C.purpleSoft} />
              <MetricCard value={scoreAverage ?? '--'} label="score appel" color={C.orange} bg={C.orangeSoft} />
            </View>

            <FocusCard focusStats={data.focusStats} />

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text selectable style={styles.cardLabel}>Mots en mémoire</Text>
                <Text selectable style={styles.cardPct}>{masteredPct}%</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${masteredPct}%` }]} />
              </View>
              <Text selectable style={styles.cardHint}>
                {data.masteredCount} mots acquis sur {data.totalCards} au programme.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ouvrir les révisions"
                onPress={() => router.push('/(tabs)/practice')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
                <Text style={styles.primaryButtonText}>Réviser maintenant</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {data.weeklyXp.length > 0 ? <WeeklyXpChart weeks={data.weeklyXp} /> : null}
            <SessionsCard sessions={data.recentSessions} />
            <CorrectionsCard corrections={data.corrections} />
            <AchievementsCard unlockedIds={xp.unlockedIds} unlockedCount={xp.unlocked.length} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TabBar({ activeTab, onChange }: { activeTab: ProgressTab; onChange: (tab: ProgressTab) => void }) {
  return (
    <View style={styles.tabBar}>
      <TabButton label="Vue d'ensemble" active={activeTab === 'overview'} onPress={() => onChange('overview')} />
      <TabButton label="Historique" active={activeTab === 'history'} onPress={() => onChange('history')} />
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function HeroProgressCard({ data, weekCount }: { data: ProgressData; weekCount: number }) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTop}>
        <View style={styles.fireBadge}>
          <Text style={styles.fireText}>🔥</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text selectable style={styles.heroValue}>{data.streak} jour{data.streak > 1 ? 's' : ''}</Text>
          <Text selectable style={styles.heroLabel}>Série actuelle</Text>
        </View>
        <View style={styles.todayPill}>
          <Text selectable style={styles.todayValue}>{data.minutesToday}</Text>
          <Text selectable style={styles.todayLabel}>min</Text>
        </View>
      </View>
      <View style={styles.weekRow}>
        {data.weekActivity.map((active, index) => (
          <View key={`${DAYS_SHORT[index]}-${index}`} style={styles.dayItem}>
            <View style={[styles.dayDot, active ? styles.dayDotActive : styles.dayDotIdle]}>
              <Text style={[styles.dayLetter, active && styles.dayLetterActive]}>{DAYS_SHORT[index]}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text selectable style={styles.weekText}>
        {weekCount}/7 jour{weekCount > 1 ? 's' : ''} actif{weekCount > 1 ? 's' : ''} cette semaine
      </Text>
    </View>
  );
}

function XpCard({ totalXp, level, into, next }: { totalXp: number; level: number; into: number; next: number }) {
  const pct = Math.round((into / Math.max(1, next)) * 100);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text selectable style={styles.cardLabel}>Niveau XP</Text>
          <Text selectable style={styles.xpTitle}>Niveau {level}</Text>
        </View>
        <Text selectable style={styles.xpTotal}>{totalXp} XP</Text>
      </View>
      <View style={styles.xpTrack}>
        <View style={[styles.xpFill, { width: `${pct}%` }]} />
      </View>
      <Text selectable style={styles.cardHint}>{into}/{next} XP avant le niveau {level + 1}.</Text>
    </View>
  );
}

function FocusCard({ focusStats }: { focusStats: FocusStatRow[] }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text selectable style={styles.cardLabel}>Points à renforcer</Text>
        <Text selectable style={styles.cardCount}>{focusStats.length}</Text>
      </View>
      {focusStats.length === 0 ? (
        <View style={styles.emptyState}>
          <Text selectable style={styles.emptyTitle}>Tout est sous contrôle pour l&apos;instant</Text>
          <Text selectable style={styles.emptyText}>Simule un appel pour voir tes axes d&apos;amélioration.</Text>
          <Pressable onPress={() => router.push('/(tabs)/call')} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
            <Text style={styles.secondaryButtonText}>Simuler un appel</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {focusStats.map((item) => (
            <View key={item.focus} style={styles.weaknessRow}>
              <Text selectable style={styles.weaknessCount}>{item.count}×</Text>
              <Text selectable style={styles.weaknessText}>{item.focus}</Text>
            </View>
          ))}
          <Pressable onPress={() => router.push('/(tabs)/practice')} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
            <Text style={styles.primaryButtonText}>Travailler mes points faibles</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function WeeklyXpChart({ weeks }: { weeks: WeeklyXpEntry[] }) {
  const maxXp = Math.max(...weeks.map((w) => w.xp), 1);
  const shortLabel = (label: string) => {
    const parts = label.split('-W');
    return parts[1] ? `S${parts[1]}` : label.slice(-3);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text selectable style={styles.cardLabel}>XP · évolution</Text>
        <Text selectable style={styles.cardCount}>{weeks[weeks.length - 1]?.xp ?? 0} XP</Text>
      </View>
      <View style={styles.chartRow}>
        {weeks.map((w, i) => {
          const isLast = i === weeks.length - 1;
          const barH = Math.max(6, Math.round((w.xp / maxXp) * 80));
          return (
            <View key={w.label} style={styles.chartBar}>
              <Text selectable style={[styles.chartXp, isLast && { color: C.primary }]}>{w.xp > 0 ? w.xp : ''}</Text>
              <View style={[styles.chartBarFill, { height: barH, backgroundColor: isLast ? C.primary : C.surface2, borderColor: isLast ? C.primaryDark : C.border }]} />
              <Text selectable style={[styles.chartLabel, isLast && { color: C.primaryDark, fontWeight: '900' }]}>{shortLabel(w.label)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SessionsCard({ sessions }: { sessions: LearningSessionRow[] }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text selectable style={styles.cardLabel}>Tes dernières séances</Text>
        <Text selectable style={styles.cardCount}>{sessions.length}</Text>
      </View>
      {sessions.length === 0 ? (
        <Text selectable style={styles.cardHint}>Aucune séance pour l&apos;instant.</Text>
      ) : (
        <View style={styles.sessionsList}>
          {sessions.map((session) => <SessionRow key={session.id} session={session} />)}
        </View>
      )}
    </View>
  );
}

const SESSION_ICONS: Record<string, string> = { quiz: '📝', lesson: '📖', call: '📞' };
const SESSION_LABELS: Record<string, string> = { quiz: 'Quiz', lesson: 'Leçon', call: 'Appel' };

function SessionRow({ session }: { session: LearningSessionRow }) {
  const icon = SESSION_ICONS[session.sessionType] ?? '📝';
  const label = SESSION_LABELS[session.sessionType] ?? session.sessionType;
  const mins = Math.max(1, Math.round(session.durationSeconds / 60));
  const color = session.scoreAvg != null
    ? session.scoreAvg >= 80 ? C.primary : session.scoreAvg >= 60 ? C.orange : C.red
    : C.blue;
  const date = new Date(session.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.sessionRow}>
      <View style={[styles.sessionIcon, { backgroundColor: color + '18' }]}>
        <Text style={styles.sessionIconText}>{icon}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.sessionTop}>
          <Text selectable style={styles.sessionLabel}>{label}</Text>
          <Text selectable style={styles.sessionDate}>{date}</Text>
        </View>
        <View style={styles.sessionBottom}>
          <Text selectable style={[styles.sessionMeta, { color: C.muted }]}>{session.cardsReviewed} élément{session.cardsReviewed > 1 ? 's' : ''} · {mins} min</Text>
          {session.scoreAvg != null ? <Text selectable style={[styles.sessionScore, { color }]}>{session.scoreAvg}%</Text> : null}
        </View>
      </View>
    </View>
  );
}

function CorrectionsCard({ corrections }: { corrections: CorrectionRow[] }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text selectable style={styles.cardLabel}>Retours sur tes appels</Text>
        <Text selectable style={styles.cardCount}>{corrections.length}</Text>
      </View>
      {corrections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text selectable style={styles.emptyTitle}>Aucun retour pour l&apos;instant</Text>
          <Text selectable style={styles.emptyText}>Simule un appel pour recevoir un retour personnalisé.</Text>
          <Pressable onPress={() => router.push('/(tabs)/call')} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
            <Text style={styles.secondaryButtonText}>Simuler un appel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.correctionsList}>
          {corrections.map((correction) => <CorrectionItem key={correction.id} correction={correction} />)}
        </View>
      )}
    </View>
  );
}

function CorrectionItem({ correction }: { correction: CorrectionRow }) {
  const color = correction.score >= 80 ? C.primary : correction.score >= 60 ? C.orange : C.red;

  return (
    <View style={styles.correctionItem}>
      <View style={[styles.scoreCircle, { backgroundColor: `${color}18`, borderColor: `${color}55` }]}>
        <Text selectable style={[styles.scoreText, { color }]}>{correction.score}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text selectable style={styles.feedbackText} numberOfLines={2}>{correction.feedbackFr}</Text>
        <Text selectable style={styles.correctedText} numberOfLines={2}>{correction.correctedIt}</Text>
        {correction.nextFocus.length > 0 ? (
          <Text selectable style={styles.focusText} numberOfLines={1}>{correction.nextFocus.slice(0, 2).join(' · ')}</Text>
        ) : null}
      </View>
    </View>
  );
}

function AchievementsCard({ unlockedIds, unlockedCount }: { unlockedIds: Set<string>; unlockedCount: number }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text selectable style={styles.cardLabel}>Trophées</Text>
        <Text selectable style={styles.cardCount}>{unlockedCount}/{achievements.length}</Text>
      </View>
      <View style={styles.badgesGrid}>
        {achievements.map((achievement) => {
          const unlocked = unlockedIds.has(achievement.id);
          return (
            <View
              key={achievement.id}
              style={[
                styles.badgeTile,
                unlocked ? { borderColor: achievement.accent, backgroundColor: `${achievement.accent}18` } : styles.badgeTileLocked,
              ]}>
              <Text style={[styles.badgeIcon, !unlocked && styles.badgeIconLocked]}>{achievement.icon}</Text>
              <Text selectable numberOfLines={1} style={[styles.badgeTitle, !unlocked && styles.badgeTitleLocked]}>{achievement.title}</Text>
              <Text selectable numberOfLines={1} style={styles.badgeDescription}>{achievement.description}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MetricCard({ value, label, color, bg }: { value: number | string; label: string; color: string; bg: string }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: bg }]}>
      <Text selectable style={[styles.metricValue, { color }]}>{value}</Text>
      <Text selectable style={[styles.metricLabel, { color }]}>{label}</Text>
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
    alignItems: 'flex-start',
    gap: 14,
  },
  kicker: { color: C.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  pageTitle: { color: C.text, fontSize: 28, fontWeight: '900' },
  masteryBadge: {
    minWidth: 78,
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: C.primarySoft,
    borderWidth: 1.5,
    borderColor: '#B8E986',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  masteryValue: { color: C.primaryDark, fontSize: 19, fontWeight: '900', fontVariant: ['tabular-nums'] },
  masteryLabel: { color: C.primaryDark, fontSize: 10, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 40, gap: 14 },
  tabBar: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 18, padding: 4, gap: 4 },
  tabButton: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 11 },
  tabButtonActive: { backgroundColor: C.surface },
  tabText: { color: C.muted, fontSize: 13, fontWeight: '900' },
  tabTextActive: { color: C.primaryDark },
  heroCard: { backgroundColor: C.surface, borderRadius: 24, borderWidth: 1, borderColor: C.border, padding: 18, gap: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  fireBadge: { width: 54, height: 54, borderRadius: 17, backgroundColor: C.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  fireText: { fontSize: 28 },
  heroValue: { color: C.text, fontSize: 24, fontWeight: '900' },
  heroLabel: { color: C.dim, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  todayPill: { alignItems: 'center', borderRadius: 16, backgroundColor: C.surface2, paddingHorizontal: 14, paddingVertical: 10 },
  todayValue: { color: C.blue, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  todayLabel: { color: C.muted, fontSize: 11, fontWeight: '800' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 7 },
  dayItem: { flex: 1 },
  dayDot: { height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayDotActive: { backgroundColor: C.primary },
  dayDotIdle: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },
  dayLetter: { color: C.dim, fontSize: 12, fontWeight: '900' },
  dayLetterActive: { color: '#FFFFFF' },
  weekText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border, padding: 18, gap: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardLabel: { color: C.dim, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  cardCount: { color: C.blue, fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  cardPct: { color: C.primary, fontSize: 15, fontWeight: '900' },
  cardHint: { color: C.muted, fontSize: 13, lineHeight: 18 },
  xpTitle: { color: C.text, fontSize: 22, fontWeight: '900', marginTop: 2 },
  xpTotal: { color: C.primaryDark, fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  xpTrack: { height: 14, backgroundColor: C.border, borderRadius: 7, overflow: 'hidden' },
  xpFill: { height: 14, backgroundColor: C.primary, borderRadius: 7, minWidth: 6 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48.5%', borderRadius: 18, padding: 16, gap: 2 },
  metricValue: { fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 12, fontWeight: '800' },
  weaknessRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 15, backgroundColor: C.surface2, padding: 11 },
  weaknessCount: { color: C.orange, fontSize: 13, fontWeight: '900', width: 34 },
  weaknessText: { flex: 1, color: C.text, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  progressBarTrack: { height: 12, backgroundColor: C.border, borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: 12, backgroundColor: C.primary, borderRadius: 6, minWidth: 4 },
  primaryButton: { alignItems: 'center', borderRadius: 17, backgroundColor: C.primary, paddingVertical: 14 },
  primaryButtonPressed: { backgroundColor: C.primaryDark },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: C.blue, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryButtonPressed: { opacity: 0.82 },
  secondaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  emptyState: { gap: 9, borderRadius: 18, backgroundColor: C.surface2, padding: 14 },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: '900' },
  emptyText: { color: C.muted, fontSize: 13, lineHeight: 19 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 108 },
  chartBar: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  chartXp: { color: C.dim, fontSize: 9, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chartBarFill: { width: '100%', borderRadius: 6, borderWidth: 1, minHeight: 6 },
  chartLabel: { color: C.dim, fontSize: 9, fontWeight: '700' },
  sessionsList: { gap: 8 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  sessionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sessionIconText: { fontSize: 18 },
  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionLabel: { color: C.text, fontSize: 14, fontWeight: '800' },
  sessionDate: { color: C.dim, fontSize: 11, fontWeight: '600' },
  sessionBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionMeta: { fontSize: 12, fontWeight: '600' },
  sessionScore: { fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  correctionsList: { gap: 10 },
  correctionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 18, backgroundColor: C.surface2, padding: 12 },
  scoreCircle: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  feedbackText: { color: C.text, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  correctedText: { color: C.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  focusText: { color: C.dim, fontSize: 11, fontWeight: '800' },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeTile: { width: '48%', borderRadius: 16, borderWidth: 1.5, padding: 11, gap: 4 },
  badgeTileLocked: { backgroundColor: C.surface2, borderColor: C.border, opacity: 0.62 },
  badgeIcon: { fontSize: 22 },
  badgeIconLocked: { opacity: 0.45 },
  badgeTitle: { color: C.text, fontSize: 13, fontWeight: '900' },
  badgeTitleLocked: { color: C.muted },
  badgeDescription: { color: C.muted, fontSize: 11, fontWeight: '700', lineHeight: 15 },
});
