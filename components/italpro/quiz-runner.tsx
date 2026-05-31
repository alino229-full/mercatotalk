import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  ZoomIn,
} from 'react-native-reanimated';

import type { QuizQuestion } from '@/services/lesson-quiz';
import { successFeedback, warningFeedback } from '@/services/haptics';
import { playQuizSound, preloadQuizSounds } from '@/services/quiz-sounds';

const C = {
  text: '#F4F5F7',
  muted: '#9AA3B2',
  surface: '#242935',
  border: '#2C313C',
  primary: '#58CC02',
  primarySoft: '#1E3A12',
  red: '#FF4B4B',
  redSoft: '#3A1F22',
};

export function QuizRunner({
  questions,
  accentColor,
  passThreshold = 80,
  onComplete,
}: {
  questions: QuizQuestion[];
  accentColor: string;
  passThreshold?: number;
  onComplete: (score: number, passed: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const total = questions.length;
  const question = questions[index];

  useEffect(() => {
    preloadQuizSounds();
  }, []);

  const answer = useCallback(
    (choice: string) => {
      if (selected || !question) return;
      setSelected(choice);
      const ok = choice === question.correct;
      const nextCorrect = correct + (ok ? 1 : 0);
      if (ok) {
        playQuizSound('correct');
        successFeedback();
      } else {
        playQuizSound('wrong');
        warningFeedback();
      }

      setTimeout(() => {
        if (index + 1 >= total) {
          const score = Math.round((nextCorrect / total) * 100);
          setCorrect(nextCorrect);
          playQuizSound(score >= 80 ? 'bravo' : 'complete');
          onComplete(score, score >= passThreshold);
        } else {
          setCorrect(nextCorrect);
          setIndex((i) => i + 1);
          setSelected(null);
        }
      }, 600);
    },
    [correct, index, onComplete, passThreshold, question, selected, total],
  );

  const progress = useMemo(() => (total > 0 ? (index + (selected ? 1 : 0)) / total : 0), [
    index,
    selected,
    total,
  ]);

  if (!question) return null;

  return (
    <View style={styles.root}>
      {/* barre de progression */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: accentColor }]} />
      </View>
      <Text style={styles.counter}>
        {index + 1} / {total}
      </Text>

      <Animated.View
        key={index}
        entering={SlideInRight.duration(280)}
        exiting={SlideOutLeft.duration(200)}
        style={styles.card}>
        <Text style={styles.askLabel}>Traduis ce mot</Text>
        <Animated.Text entering={ZoomIn.duration(320)} style={styles.prompt}>
          {question.prompt}
        </Animated.Text>

        <View style={styles.choices}>
          {question.choices.map((choice) => {
            const isSelected = selected === choice;
            const isCorrect = choice === question.correct;
            const showCorrect = selected != null && isCorrect;
            const showWrong = isSelected && !isCorrect;
            return (
              <Pressable
                key={choice}
                disabled={selected != null}
                onPress={() => answer(choice)}
                style={[
                  styles.choice,
                  showCorrect && styles.choiceCorrect,
                  showWrong && styles.choiceWrong,
                ]}>
                <Text
                  style={[
                    styles.choiceText,
                    (showCorrect || showWrong) && styles.choiceTextOn,
                  ]}>
                  {choice}
                </Text>
                {showCorrect ? <Text style={styles.mark}>✓</Text> : null}
                {showWrong ? <Text style={styles.mark}>✗</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

export function QuizResult({
  score,
  passed,
  accentColor,
  passLabel = 'Leçon validée !',
  failLabel = 'Pas encore, réessaie',
  onPrimary,
  onSecondary,
  primaryLabel,
  secondaryLabel = 'Rejouer',
}: {
  score: number;
  passed: boolean;
  accentColor: string;
  passLabel?: string;
  failLabel?: string;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryLabel: string;
  secondaryLabel?: string;
}) {
  const stars = passed ? Math.max(1, Math.round(score / 34)) : 0;
  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut} style={styles.result}>
      <Animated.Text entering={ZoomIn.delay(120).springify()} style={styles.resultEmoji}>
        {passed ? '🎉' : '💪'}
      </Animated.Text>
      <View style={styles.resultStars}>
        {[0, 1, 2].map((i) => (
          <Animated.Text
            key={i}
            entering={ZoomIn.delay(220 + i * 140).springify()}
            style={[styles.resultStar, i < stars && { color: '#FFC800' }]}>
            ★
          </Animated.Text>
        ))}
      </View>
      <Text style={styles.resultScore}>{score}%</Text>
      <Text style={styles.resultLabel}>{passed ? passLabel : failLabel}</Text>

      <Pressable onPress={onPrimary} style={[styles.primaryBtn, { backgroundColor: accentColor }]}>
        <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
      </Pressable>
      <Pressable onPress={onSecondary} style={styles.secondaryBtn}>
        <Text style={styles.secondaryBtnText}>{secondaryLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  track: {
    height: 12,
    borderRadius: 6,
    backgroundColor: C.surface,
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: { height: '100%', borderRadius: 6 },
  counter: { color: C.muted, fontSize: 12, fontWeight: '900', marginTop: 8 },
  card: { flex: 1, justifyContent: 'center' },
  askLabel: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  prompt: { color: C.text, fontSize: 38, fontWeight: '900', marginTop: 8, marginBottom: 28 },
  choices: { gap: 12 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  choiceCorrect: { borderColor: C.primary, backgroundColor: C.primarySoft },
  choiceWrong: { borderColor: C.red, backgroundColor: C.redSoft },
  choiceText: { color: C.text, fontSize: 16, fontWeight: '800', flex: 1 },
  choiceTextOn: { color: '#FFFFFF' },
  mark: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginLeft: 10 },
  result: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  resultEmoji: { fontSize: 72 },
  resultStars: { flexDirection: 'row', gap: 8, marginTop: 12 },
  resultStar: { fontSize: 40, color: '#3A3F47' },
  resultScore: { color: C.text, fontSize: 44, fontWeight: '900', marginTop: 10 },
  resultLabel: { color: C.muted, fontSize: 15, fontWeight: '700', marginTop: 4, marginBottom: 28 },
  primaryBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 16,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryBtn: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  secondaryBtnText: { color: C.muted, fontSize: 14, fontWeight: '800' },
});
