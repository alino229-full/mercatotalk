import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { LessonNode } from '@/components/italpro/lesson-node';
import {
  allGateIds,
  chapters,
  computePathState,
  type Chapter,
  type NodeState,
  type PathNode,
} from '@/data/curriculum';
import {
  ensureLessonProgressSeed,
  getLessonProgress,
  type LessonProgressRow,
} from '@/database/italpro-local-db';
import { tapFeedback, warningFeedback } from '@/services/haptics';

const C = {
  bg: '#F7F7F7',
  surface: '#FFFFFF',
  surface2: '#F2F2F2',
  border: '#E5E5E5',
  text: '#3C3C3C',
  muted: '#777777',
  dim: '#AFAFAF',
  primary: '#58CC02',
  gold: '#FF9600',
} as const;

// motif sinueux (décalage horizontal des nœuds)
const OFFSETS = [0, 0.55, 0.85, 0.55, 0, -0.55, -0.85, -0.55];

export default function LearnScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const nodeRefs = useRef<Map<string, View>>(new Map());
  const [progress, setProgress] = useState<LessonProgressRow[]>([]);

  const completedSet = useMemo(
    () => new Set(progress.filter((r) => r.status === 'completed').map((r) => r.lessonId)),
    [progress],
  );
  const scoreByGate = useMemo(
    () => new Map(progress.map((r) => [r.lessonId, r.quizScore])),
    [progress],
  );

  const { states, resumeId } = useMemo(() => computePathState(completedSet), [completedSet]);

  const reload = useCallback(async () => {
    await ensureLessonProgressSeed(allGateIds);
    const rows = await getLessonProgress();
    setProgress(rows);
    return rows;
  }, []);

  const scrollToNode = useCallback((id: string | null, animated: boolean) => {
    if (!id) return;
    const target = nodeRefs.current.get(id);
    const content = contentRef.current;
    if (!target || !content) return;
    // New RN architecture (Fabric): measureLayout takes the relative
    // component instance directly, not a numeric findNodeHandle.
    target.measureLayout(
      content,
      (_x: number, y: number) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 180), animated });
      },
      () => {},
    );
  }, []);

  // recharge la progression + reprend exactement sur la leçon courante
  useFocusEffect(
    useCallback(() => {
      let active = true;
      reload().then((rows) => {
        if (!active) return;
        const completed = new Set(rows.filter((r) => r.status === 'completed').map((r) => r.lessonId));
        const nextResumeId = computePathState(completed).resumeId;
        setTimeout(() => scrollToNode(nextResumeId, true), 250);
      });
      return () => {
        active = false;
      };
    }, [reload, scrollToNode]),
  );

  const handleNodePress = useCallback(
    (node: PathNode, state: NodeState) => {
      if (state === 'locked') {
        warningFeedback();
        return;
      }
      tapFeedback();
      if (node.kind === 'checkpoint') {
        router.push(`/checkpoint/${node.chapterId}` as never);
      } else {
        router.push(`/lesson/${node.id}` as never);
      }
    },
    [router],
  );

  const registerNode = useCallback((id: string, view: View | null) => {
    if (view) nodeRefs.current.set(id, view);
    else nodeRefs.current.delete(id);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Parcours</Text>
        <Text style={styles.headerSub}>
          {chapters.length} chapitres · reprise auto sur ta leçon en cours
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}>
        <View ref={contentRef} collapsable={false}>
          {chapters.map((chapter, ci) => (
            <ChapterSection
              key={chapter.id}
              chapter={chapter}
              index={ci}
              states={states}
              scoreByGate={scoreByGate}
              completedSet={completedSet}
              resumeId={resumeId}
              onNodePress={handleNodePress}
              registerNode={registerNode}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Chapitre ────────────────────────────────────────────────────────────────

function ChapterSection({
  chapter,
  index,
  states,
  scoreByGate,
  completedSet,
  resumeId,
  onNodePress,
  registerNode,
}: {
  chapter: Chapter;
  index: number;
  states: Map<string, NodeState>;
  scoreByGate: Map<string, number | null>;
  completedSet: Set<string>;
  resumeId: string | null;
  onNodePress: (node: PathNode, state: NodeState) => void;
  registerNode: (id: string, view: View | null) => void;
}) {
  const accent = chapter.accentColor;
  const doneLessons = chapter.lessons.filter((l) => completedSet.has(l.id)).length;
  const totalLessons = chapter.lessons.length;
  const checkpointScore = scoreByGate.get(chapter.checkpoint.id) ?? null;
  const checkpointDone = states.get(chapter.checkpoint.id) === 'completed';
  const ratio = totalLessons > 0 ? doneLessons / totalLessons : 0;
  const stars = checkpointDone ? Math.max(1, Math.round((checkpointScore ?? 80) / 34)) : 0;

  return (
    <View style={styles.chapter}>
      <Animated.View
        entering={FadeIn.delay(Math.min(index, 6) * 60).springify()}
        style={[styles.chapterCard, { backgroundColor: accent }]}>
        <View style={styles.chapterTopRow}>
          <Text style={styles.chapterKicker}>
            CHAPITRE {chapter.number} · {chapter.weeks}
          </Text>
          {checkpointDone ? (
            <View style={styles.validBadge}>
              <Text style={styles.validBadgeText}>✓ Validé</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.chapterTitle}>{chapter.title}</Text>
        <Text style={styles.chapterGoal} numberOfLines={2}>
          {chapter.goal}
        </Text>

        <View style={styles.chapterEval}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
          </View>
          <Text style={styles.evalText}>
            {doneLessons}/{totalLessons}
          </Text>
          <View style={styles.starsRow}>
            {[0, 1, 2].map((i) => (
              <Text key={i} style={[styles.star, i < stars && styles.starOn]}>
                ★
              </Text>
            ))}
          </View>
        </View>
      </Animated.View>

      <View style={styles.path}>
        {chapter.nodes.map((node, ni) => {
          const state = states.get(node.id) ?? 'locked';
          const offset = node.kind === 'checkpoint' ? 0 : OFFSETS[ni % OFFSETS.length] ?? 0;
          return (
            <View
              key={node.id}
              ref={(v) => registerNode(node.id, v)}
              collapsable={false}
              style={styles.nodeRow}>
              <LessonNode
                icon={node.kind === 'lesson' ? node.icon : '🏆'}
                state={state}
                accentColor={node.kind === 'checkpoint' ? C.gold : accent}
                variant={node.kind === 'checkpoint' ? 'checkpoint' : 'lesson'}
                offset={offset}
                showStartBubble={node.id === resumeId}
                onPress={() => onNodePress(node, state)}
              />
              {node.kind === 'lesson' ? (
                <Text style={[styles.nodeLabel, { transform: [{ translateX: offset * 64 }] }]}>
                  {node.title}
                </Text>
              ) : (
                <Text style={styles.checkpointLabel}>Checkpoint du chapitre</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { color: C.text, fontSize: 26, fontWeight: '900' },
  headerSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  scroll: { paddingTop: 8 },
  chapter: { marginBottom: 8 },
  chapterCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  chapterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chapterKicker: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  validBadge: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  validBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  chapterTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 6 },
  chapterGoal: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18, marginTop: 4 },
  chapterEval: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  progressTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#FFFFFF' },
  evalText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  starsRow: { flexDirection: 'row' },
  star: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  starOn: { color: C.gold },
  path: { alignItems: 'center', paddingVertical: 18, gap: 26 },
  nodeRow: { alignItems: 'center', gap: 8 },
  nodeLabel: {
    color: C.text,
    fontSize: 13,
    fontWeight: '800',
    maxWidth: 220,
    textAlign: 'center',
  },
  checkpointLabel: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
