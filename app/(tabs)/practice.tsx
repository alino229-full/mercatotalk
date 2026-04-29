import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { QuizQuestion, QuizSessionState } from '@/hooks/use-quiz-session';
import { useItalianTTS } from '@/hooks/use-italian-tts';
import { useQuizSession } from '@/hooks/use-quiz-session';
import { useXp } from '@/hooks/use-xp';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#F7F7F7',
  surface: '#FFFFFF',
  surface2: '#F0F0F0',
  border: '#E5E5E5',
  primary: '#58CC02',
  primaryDark: '#46A302',
  primaryLight: '#D7F5B1',
  text: '#3C3C3C',
  muted: '#777777',
  dim: '#AFAFAF',
  correct: '#58CC02',
  correctBg: '#F0FBE6',
  correctBorder: '#B8E986',
  wrong: '#FF4B4B',
  wrongBg: '#FFF0F0',
  wrongBorder: '#FFB3B3',
  blue: '#1CB0F6',
  blueBg: '#D0F0FF',
  orange: '#FF9600',
  purple: '#CE82FF',
} as const;

const TYPE_LABELS: Record<string, string> = {
  it_to_fr: '🇮🇹 → 🇫🇷  Que signifie ce mot ?',
  fr_to_it: '🇫🇷 → 🇮🇹  Comment dit-on en italien ?',
  listen_to_fr: '🔊  Écoutez et choisissez la traduction',
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PracticeScreen() {
  const { quick } = useLocalSearchParams<{ quick?: string }>();
  const seriesSize = quick === '1' ? 5 : 20;

  const session = useQuizSession({ seriesSize });
  const { pauseSession, resumeSession } = session;

  useFocusEffect(
    useCallback(() => {
      resumeSession();
      return () => {
        pauseSession();
      };
    }, [pauseSession, resumeSession]),
  );

  if (session.isLoading) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <ActivityIndicator color={C.primary} size="large" />
        <Text style={styles.loadingText}>Préparation du quiz...</Text>
      </View>
    );
  }

  if (session.questions.length < 4) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <Text style={styles.doneEmoji}>📚</Text>
        <Text style={styles.doneTitle}>Pas assez de cartes</Text>
        <Text style={styles.doneSub}>Le quiz nécessite au moins 4 cartes SM-2.{'\n'}Consulte les leçons avant de commencer.</Text>
      </View>
    );
  }

  if (session.isSeriesDone) {
    return <SeriesResultScreen session={session} />;
  }

  if (!session.hasStarted) {
    return <QuizStartScreen session={session} isQuick={quick === '1'} />;
  }

  return <QuizQuestionScreen session={session} />;
}

// ─── Start screen ─────────────────────────────────────────────────────────────

function QuizStartScreen({ session, isQuick }: { session: QuizSessionState; isQuick: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.startScroll, { paddingTop: insets.top + 24 }]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <Animated.View entering={ZoomIn.duration(420)} style={styles.startHero}>
        <Text style={styles.startEmoji}>{isQuick ? '⚡' : '🎯'}</Text>
        <Text style={styles.startTitle}>{isQuick ? 'Révision rapide' : 'Quiz prêt'}</Text>
        <Text style={styles.startSub}>
          {session.totalInSeries} questions · 15 secondes par question
        </Text>
      </Animated.View>

      <View style={styles.startRules}>
        <Text selectable style={styles.startRule}>+10 XP par bonne réponse · combo ×2 dès le 3e</Text>
      </View>

      <View style={styles.modeToggleRow}>
        <Pressable
          onPress={session.toggleHardMode}
          style={[styles.modeToggle, session.hardMode && styles.modeToggleActive]}>
          <Text style={[styles.modeToggleText, session.hardMode && styles.modeToggleTextActive]}>
            {session.hardMode ? '⌨️  Mode difficile (frappe) — actif' : '⌨️  Mode difficile (frappe) — inactif'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Commencer le quiz"
        onPress={session.startSession}
        style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}>
        <Text style={styles.startButtonText}>Commencer</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Active question screen ───────────────────────────────────────────────────

function QuizQuestionScreen({ session }: { session: QuizSessionState }) {
  const xp = useXp();
  const q = session.questions[session.currentIndex];
  if (!q) return null;

  const progress = ((session.currentIndex) / session.totalInSeries) * 100;
  const isAnswered = session.answerState !== 'unanswered';
  const timerColor = session.timeLeft <= 5 ? C.wrong : session.timeLeft <= 9 ? C.orange : C.blue;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: `${progress}%` as unknown as number }]} />
      </View>
      <View style={styles.timerTrack}>
        <View
          style={[
            styles.timerFill,
            { width: `${Math.max(0, session.timerProgress * 100)}%`, backgroundColor: timerColor },
          ]}
        />
      </View>

      {session.isPaused ? (
        <View style={styles.pausedBanner}>
          <Text style={styles.pausedText}>Quiz en pause</Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.seriesCounter}>
            {session.currentIndex + 1}
            <Text style={styles.seriesTotal}> / {session.totalInSeries}</Text>
          </Text>
          <Text style={styles.questionTypeLabel}>{TYPE_LABELS[q.type] ?? ''}</Text>
        </View>
        <View style={styles.headerRight}>
          {xp.profile ? (
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Niv. {xp.profile.level}</Text>
            </View>
          ) : null}

          {session.combo >= 3 ? (
            <Animated.View entering={ZoomIn.duration(220)} style={[
              styles.comboBadge,
              { backgroundColor: session.combo >= 5 ? C.orange : C.purple },
            ]}>
              <Text style={styles.comboBadgeText}>
                {session.combo >= 5 ? '🔥' : '⚡'} ×{session.comboMultiplier}
              </Text>
            </Animated.View>
          ) : null}

          <View style={[styles.timeBadge, { backgroundColor: timerColor + '18', borderColor: timerColor + '55' }]}>
            <Text style={[styles.timeBadgeText, { color: timerColor }]}>{session.timeLeft}s</Text>
          </View>
          {session.isGroqLoading && (
            <View style={styles.groqBadge}>
              <ActivityIndicator size="small" color={C.blue} />
            </View>
          )}
          <ScoreBadge results={session.results} />
        </View>
      </View>

      <ScrollView
        key={q.uid}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        <PromptCard question={q} onPlayAudio={session.playAudio} />

        {session.hardMode ? (
          <HardModeInput
            question={q}
            isAnswered={isAnswered}
            answerState={session.answerState}
            onSubmit={session.submitTypedAnswer}
          />
        ) : (
          <View style={styles.choicesGrid}>
            {q.choices.map((choice) => {
              const isSelected = session.selectedId === choice.id;
              const isCorrect = choice.id === q.correctId;

              const btnStyle: ViewStyle[] = [styles.choiceBtn];
              const textStyle: TextStyle[] = [styles.choiceText];

              if (isAnswered) {
                if (isCorrect) {
                  btnStyle.push(styles.choiceBtnCorrect);
                  textStyle.push(styles.choiceTextCorrect);
                } else if (isSelected && !isCorrect) {
                  btnStyle.push(styles.choiceBtnWrong);
                  textStyle.push(styles.choiceTextWrong);
                } else {
                  btnStyle.push(styles.choiceBtnDimmed);
                }
              }

              return (
                <View key={choice.id}>
                  <Pressable
                    onPress={() => session.selectChoice(choice.id)}
                    disabled={isAnswered}
                    style={({ pressed }) => [
                      btnStyle,
                      !isAnswered && pressed && styles.choiceBtnPressed,
                    ]}>
                    <Text style={textStyle} numberOfLines={3}>{choice.label}</Text>
                    {isAnswered && isCorrect && <Text style={styles.choiceIcon}>✓</Text>}
                    {isAnswered && isSelected && !isCorrect && <Text style={[styles.choiceIcon, { color: C.wrong }]}>✗</Text>}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {isAnswered && (
          <Animated.View entering={FadeInUp.duration(280)} style={[
            styles.feedbackCard,
            session.answerState === 'correct' ? styles.feedbackCorrect : styles.feedbackWrong,
          ]}>
            <Text style={[styles.feedbackTitle, { color: session.answerState === 'correct' ? C.primaryDark : C.wrong }]}>
              {session.answerState === 'correct' ? '✓  Correct !' : session.selectedId === '__timeout__' ? '⏱  Temps écoulé' : '✗  Incorrect'}
            </Text>
            {session.lastXpAward && session.answerState === 'correct' ? (
              <Animated.View entering={ZoomIn.duration(240)} style={styles.xpFlash}>
                <Text style={styles.xpFlashText}>+{session.lastXpAward} XP{session.comboMultiplier > 1 ? ' 🔥' : ''}</Text>
              </Animated.View>
            ) : null}
            {session.answerState === 'wrong' && (
              <Text style={styles.feedbackHint}>
                Réponse :{' '}
                <Text style={styles.feedbackAnswer}>
                  {q.choices.find((c) => c.id === q.correctId)?.label ?? ''}
                </Text>
              </Text>
            )}
            {q.phonetic ? <Text style={styles.feedbackPhonetic}>{q.phonetic}</Text> : null}
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Hard mode input ──────────────────────────────────────────────────────────

function HardModeInput({
  question,
  isAnswered,
  answerState,
  onSubmit,
}: {
  question: QuizQuestion;
  isAnswered: boolean;
  answerState: string;
  onSubmit: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const correctLabel = question.choices.find((c) => c.id === question.correctId)?.label ?? '';

  const handleSubmit = useCallback(() => {
    if (!draft.trim()) return;
    onSubmit(draft.trim());
    setDraft('');
  }, [draft, onSubmit]);

  return (
    <View style={styles.hardModeBox}>
      <Text style={styles.hardModeHint}>Tapez votre traduction en {question.type === 'fr_to_it' ? 'italien' : 'français'}</Text>
      <TextInput
        autoFocus
        editable={!isAnswered}
        onChangeText={setDraft}
        onSubmitEditing={handleSubmit}
        placeholder={question.type === 'fr_to_it' ? 'Répondre en italien...' : 'Répondre en français...'}
        placeholderTextColor={C.dim}
        returnKeyType="done"
        style={[
          styles.hardModeInput,
          isAnswered && answerState === 'correct' && styles.hardModeInputCorrect,
          isAnswered && answerState === 'wrong' && styles.hardModeInputWrong,
        ]}
        value={draft}
      />
      {!isAnswered ? (
        <Pressable
          disabled={!draft.trim()}
          onPress={handleSubmit}
          style={({ pressed }) => [styles.hardModeSubmit, !draft.trim() && styles.hardModeSubmitDisabled, pressed && { opacity: 0.85 }]}>
          <Text style={styles.hardModeSubmitText}>Valider →</Text>
        </Pressable>
      ) : (
        <View style={[styles.hardModeReveal, answerState === 'correct' ? styles.hardModeRevealCorrect : styles.hardModeRevealWrong]}>
          <Text style={styles.hardModeRevealText}>
            {answerState === 'correct' ? '✓ Bonne réponse' : `Réponse correcte : ${correctLabel}`}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Prompt card ─────────────────────────────────────────────────────────────

function PromptCard({ question, onPlayAudio }: { question: QuizQuestion; onPlayAudio: () => void }) {
  const isListen = question.type === 'listen_to_fr';

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.promptCard}>
      {isListen ? (
        <View style={styles.promptListen}>
          <Pressable
            onPress={onPlayAudio}
            style={({ pressed }) => [styles.audioBtn, pressed && styles.audioBtnPressed]}
            accessibilityLabel="Écouter le mot en italien">
            <Text style={styles.audioBtnIcon}>🔊</Text>
          </Pressable>
          <Text style={styles.promptHint}>Appuyez pour écouter</Text>
        </View>
      ) : (
        <View style={styles.promptText}>
          <Text style={styles.promptWord}>{question.prompt}</Text>
          {question.type === 'it_to_fr' && question.phonetic ? (
            <Text style={styles.promptPhonetic}>{question.phonetic}</Text>
          ) : null}
          {question.type === 'it_to_fr' && (
            <Pressable onPress={onPlayAudio} style={styles.listenSmallBtn}>
              <Text style={styles.listenSmallText}>🔊 Écouter</Text>
            </Pressable>
          )}
        </View>
      )}
    </Animated.View>
  );
}

// ─── Score badge ─────────────────────────────────────────────────────────────

function ScoreBadge({ results }: { results: { correct: boolean }[] }) {
  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  if (total === 0) return <View style={styles.scoreBadgeEmpty} />;
  const pct = Math.round((correct / total) * 100);
  const color = pct >= 70 ? C.primary : pct >= 50 ? C.orange : C.wrong;
  return (
    <View style={[styles.scoreBadge, { borderColor: color + '55', backgroundColor: color + '15' }]}>
      <Text style={[styles.scoreBadgeText, { color }]}>{correct}/{total}</Text>
    </View>
  );
}

// ─── Series result screen ─────────────────────────────────────────────────────

function SeriesResultScreen({ session }: { session: QuizSessionState }) {
  const xp = useXp();
  const correct = session.results.filter((r) => r.correct).length;
  const total = session.results.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '💪';
  const color = pct >= 80 ? C.primary : pct >= 60 ? C.orange : C.wrong;

  return (
    <ScrollView
      style={styles.root}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.resultScroll}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <Animated.View entering={ZoomIn.duration(500)} style={styles.resultHero}>
        <Text style={styles.resultEmoji}>{emoji}</Text>
        <Text style={[styles.resultPct, { color }]}>{pct}%</Text>
        <Text style={styles.resultLabel}>{correct} / {total} bonnes réponses</Text>
        <Text style={styles.resultXp}>+{session.totalXpAwarded} XP gagnés</Text>
      </Animated.View>

      {xp.profile ? (
        <Animated.View entering={FadeInUp.delay(120).duration(400)} style={styles.levelCard}>
          <View style={styles.levelCardTop}>
            <Text style={styles.cardLabel}>Niveau {xp.profile.level}</Text>
            <Text style={styles.levelCardXp}>{xp.profile.totalXp} XP</Text>
          </View>
          <View style={styles.levelTrack}>
            <View style={[styles.levelFill, { width: `${Math.round((xp.profile.xpIntoLevel / xp.profile.xpForNextLevel) * 100)}%` }]} />
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.resultMsgCard}>
        <Text style={styles.resultMsg}>
          {pct >= 80
            ? 'Excellent ! Tes connaissances B2B progressent très bien.'
            : pct >= 60
            ? 'Bonne base. Continue à réviser les cartes difficiles.'
            : 'Ne lâche pas ! La répétition espacée va consolider ça.'}
        </Text>
      </Animated.View>

      {session.results.some((r) => !r.correct) && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.resultMissed}>
          <Text style={styles.resultMissedTitle}>À retravailler</Text>
          {session.results
            .filter((r) => !r.correct)
            .slice(0, 8)
            .map((r) => (
              <MissedRow key={r.question.uid} it={r.question.it} fr={r.question.fr} />
            ))}
        </Animated.View>
      )}

      <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.resultActions}>
        <Pressable
          onPress={session.startNewSeries}
          style={({ pressed }) => [styles.newSeriesBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.newSeriesBtnText}>Nouvelle série de {total} →</Text>
        </Pressable>
        <Text style={styles.resultTotal}>{session.totalItems} mots dans ta banque</Text>
      </Animated.View>
    </ScrollView>
  );
}

function MissedRow({ it, fr }: { it: string; fr: string }) {
  const tts = useItalianTTS();
  const speak = useCallback(() => {
    tts.speak(it, { rate: 0.82 });
  }, [it, tts]);

  return (
    <Pressable onPress={speak} style={styles.missedRow}>
      <View style={styles.missedLeft}>
        <Text style={styles.missedIt}>{it}</Text>
        <Text style={styles.missedFr}>{fr}</Text>
      </View>
      <Text style={styles.missedPlay}>▶</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const correctDark = '#2D8E00';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: {
    flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12,
  },
  loadingText: { color: C.muted, fontSize: 15, marginTop: 8 },
  doneEmoji: { fontSize: 52, marginBottom: 8 },
  doneTitle: { color: C.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  doneSub: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 21 },

  // Start
  startScroll: { paddingHorizontal: 24, paddingBottom: 42, gap: 18 },
  startHero: {
    backgroundColor: C.surface, borderRadius: 24, borderWidth: 1, borderColor: C.border,
    padding: 26, alignItems: 'center', gap: 10,
  },
  startEmoji: { fontSize: 56 },
  startTitle: { color: C.text, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  startSub: { color: C.muted, fontSize: 14, fontWeight: '700', lineHeight: 20, textAlign: 'center' },
  startRules: { backgroundColor: C.blueBg, borderRadius: 20, padding: 16, gap: 9 },
  startRule: { color: '#075985', fontSize: 13, fontWeight: '800', lineHeight: 18 },
  modeToggleRow: {},
  modeToggle: {
    borderRadius: 16, borderWidth: 2, borderColor: C.border, backgroundColor: C.surface,
    padding: 14, alignItems: 'center',
  },
  modeToggleActive: { borderColor: C.purple, backgroundColor: C.purple + '18' },
  modeToggleText: { color: C.muted, fontSize: 14, fontWeight: '800' },
  modeToggleTextActive: { color: C.purple },
  startButton: {
    backgroundColor: C.primary, borderRadius: 18, alignItems: 'center', paddingVertical: 17,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
    shadowRadius: 8, elevation: 4,
  },
  startButtonPressed: { backgroundColor: C.primaryDark },
  startButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },

  // Progress
  progressTrack: { height: 8, backgroundColor: C.border },
  progressFill: { height: 8, backgroundColor: C.primary },
  timerTrack: { height: 4, backgroundColor: '#EAF6FF' },
  timerFill: { height: 4 },
  pausedBanner: { backgroundColor: C.orange, paddingVertical: 7, alignItems: 'center' },
  pausedText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
  },
  headerLeft: { flex: 1, gap: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelBadge: { backgroundColor: C.primaryLight, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  levelBadgeText: { color: C.primaryDark, fontSize: 11, fontWeight: '900' },
  comboBadge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  comboBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  timeBadge: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 },
  timeBadgeText: { fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  groqBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.blueBg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
  },
  groqBadgeText: { color: C.blue, fontSize: 11, fontWeight: '900' },
  seriesCounter: { color: C.text, fontSize: 18, fontWeight: '900' },
  seriesTotal: { color: C.dim, fontWeight: '400' },
  questionTypeLabel: { color: C.muted, fontSize: 12, fontWeight: '700' },
  scoreBadge: { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  scoreBadgeEmpty: { width: 60 },
  scoreBadgeText: { fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },

  // Scroll
  scroll: { padding: 20, gap: 14 },

  // Prompt
  promptCard: {
    backgroundColor: C.surface, borderRadius: 24, borderWidth: 1.5, borderColor: C.border,
    padding: 28, alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  promptListen: { alignItems: 'center', gap: 10, paddingVertical: 10 },
  audioBtn: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: C.blueBg,
    borderWidth: 2, borderColor: C.blue, alignItems: 'center', justifyContent: 'center',
  },
  audioBtnPressed: { backgroundColor: C.blue + '40' },
  audioBtnIcon: { fontSize: 38 },
  promptHint: { color: C.muted, fontSize: 13, fontWeight: '700' },
  promptText: { alignItems: 'center', gap: 10 },
  promptWord: { color: C.text, fontSize: 38, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  promptPhonetic: { color: C.dim, fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  listenSmallBtn: { backgroundColor: C.blueBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7, marginTop: 4 },
  listenSmallText: { color: C.blue, fontSize: 13, fontWeight: '800' },

  // Hard mode
  hardModeBox: { gap: 10 },
  hardModeHint: { color: C.muted, fontSize: 12, fontWeight: '700' },
  hardModeInput: {
    backgroundColor: C.surface, borderRadius: 18, borderWidth: 2, borderColor: C.border,
    padding: 16, fontSize: 18, fontWeight: '700', color: C.text,
  },
  hardModeInputCorrect: { borderColor: C.primary, backgroundColor: C.correctBg },
  hardModeInputWrong: { borderColor: C.wrong, backgroundColor: C.wrongBg },
  hardModeSubmit: { backgroundColor: C.primary, borderRadius: 15, alignItems: 'center', paddingVertical: 14 },
  hardModeSubmitDisabled: { backgroundColor: C.border },
  hardModeSubmitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  hardModeReveal: { borderRadius: 14, padding: 12, alignItems: 'center' },
  hardModeRevealCorrect: { backgroundColor: C.correctBg },
  hardModeRevealWrong: { backgroundColor: C.wrongBg },
  hardModeRevealText: { color: C.text, fontSize: 14, fontWeight: '800' },

  // Choices
  choicesGrid: { gap: 10 },
  choiceBtn: {
    backgroundColor: C.surface, borderRadius: 18, borderWidth: 2, borderColor: C.border,
    paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  choiceBtnPressed: { backgroundColor: C.surface2, borderColor: C.primary },
  choiceBtnCorrect: { backgroundColor: C.correctBg, borderColor: C.correctBorder },
  choiceBtnWrong: { backgroundColor: C.wrongBg, borderColor: C.wrongBorder },
  choiceBtnDimmed: { opacity: 0.55 },
  choiceText: { flex: 1, color: C.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  choiceTextCorrect: { color: correctDark },
  choiceTextWrong: { color: C.wrong },
  choiceIcon: { fontSize: 20, fontWeight: '900', color: C.correct, marginLeft: 8 },

  // Feedback
  feedbackCard: { borderRadius: 20, borderWidth: 1.5, padding: 16, gap: 10 },
  feedbackCorrect: { backgroundColor: C.correctBg, borderColor: C.correctBorder },
  feedbackWrong: { backgroundColor: C.wrongBg, borderColor: C.wrongBorder },
  feedbackTitle: { fontSize: 18, fontWeight: '900' },
  xpFlash: { alignSelf: 'flex-start', backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  xpFlashText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  feedbackHint: { color: C.text, fontSize: 14, lineHeight: 20 },
  feedbackAnswer: { fontWeight: '900', color: C.primaryDark },
  feedbackPhonetic: { color: C.muted, fontSize: 12, fontStyle: 'italic' },
  nextBtn: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  nextBtnCorrect: { backgroundColor: C.primary },
  nextBtnWrong: { backgroundColor: C.wrong },
  nextBtnPressed: { opacity: 0.85 },
  nextBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },

  // Results
  resultScroll: { padding: 24, gap: 16 },
  resultHero: { alignItems: 'center', gap: 6, paddingVertical: 16 },
  resultEmoji: { fontSize: 60, marginBottom: 8 },
  resultPct: { fontSize: 64, fontWeight: '900', fontVariant: ['tabular-nums'] },
  resultLabel: { color: C.muted, fontSize: 16, fontWeight: '700' },
  resultXp: { color: C.primaryDark, fontSize: 16, fontWeight: '900', marginTop: 4 },
  levelCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10 },
  levelCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { color: C.dim, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  levelCardXp: { color: C.primaryDark, fontSize: 14, fontWeight: '900' },
  levelTrack: { height: 10, backgroundColor: C.border, borderRadius: 5, overflow: 'hidden' },
  levelFill: { height: 10, backgroundColor: C.primary, borderRadius: 5 },
  resultMsgCard: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 18 },
  resultMsg: { color: C.text, fontSize: 15, fontWeight: '700', lineHeight: 22, textAlign: 'center' },
  resultMissed: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 14, gap: 2 },
  resultMissedTitle: { color: C.wrong, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  missedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  missedLeft: { flex: 1, gap: 2 },
  missedIt: { color: C.text, fontSize: 15, fontWeight: '800' },
  missedFr: { color: C.muted, fontSize: 13 },
  missedPlay: { color: C.primary, fontSize: 14 },
  resultActions: { alignItems: 'center', gap: 10, paddingTop: 8 },
  newSeriesBtn: {
    backgroundColor: C.primary, borderRadius: 18, paddingHorizontal: 32, paddingVertical: 18,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  newSeriesBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  resultTotal: { color: C.dim, fontSize: 13 },
});
