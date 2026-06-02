import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useItalianTTS } from '@/hooks/use-italian-tts';
import { successFeedback, warningFeedback } from '@/services/haptics';
import { playQuizSound, preloadQuizSounds } from '@/services/quiz-sounds';
import {
  normaliseAnswer,
  speakableIt,
  type AgreementTableQuestion,
  type BuildQuestion,
  type ClozeQuestion,
  type EndingChoiceQuestion,
  type ListenQuestion,
  type MatchPair,
  type MatchQuestion,
  type QuizQuestion,
  type TranslateQuestion,
  type TypeQuestion,
} from '@/services/lesson-quiz-builder';

const C = {
  bg: '#F7F7F7',
  surface: '#FFFFFF',
  surface2: '#F2F2F2',
  border: '#E5E5E5',
  primary: '#58CC02',
  primaryDark: '#46A302',
  primarySoft: '#D7F5B1',
  text: '#3C3C3C',
  muted: '#777777',
  dim: '#AFAFAF',
  red: '#FF4B4B',
  redSoft: '#FFE3E3',
  orange: '#FF9600',
  blue: '#1CB0F6',
} as const;

const ADVANCE_DELAY = 850;

type Props = {
  questions: QuizQuestion[];
  accentColor: string;
  onComplete: (score: number) => void;
  onAbort?: () => void;
};

/** Animated, multi-format lesson quiz. */
export function LessonQuiz({ questions, accentColor, onComplete, onAbort }: Props) {
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const total = questions.length;
  const current = questions[index];
  const progress = useSharedValue(0);
  const mounted = useRef(true);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    preloadQuizSounds();
    return () => {
      mounted.current = false;
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  useEffect(() => {
    progress.value = withTiming(total === 0 ? 0 : index / total, { duration: 400 });
  }, [index, total, progress]);

  const handleResult = useCallback(
    (isCorrect: boolean) => {
      const nextCorrect = correctCount + (isCorrect ? 1 : 0);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        if (!mounted.current) return;
        if (index + 1 >= total) {
          const score = Math.round((nextCorrect / Math.max(total, 1)) * 100);
          progress.value = withTiming(1, { duration: 400 });
          setCorrectCount(nextCorrect);
          playQuizSound(score >= 80 ? 'bravo' : 'complete');
          onComplete(score);
        } else {
          setCorrectCount(nextCorrect);
          setIndex((i) => i + 1);
        }
      }, ADVANCE_DELAY);
    },
    [correctCount, index, total, onComplete, progress],
  );

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  if (!current) return null;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        {onAbort ? (
          <Pressable onPress={onAbort} hitSlop={10} style={styles.closeBtn}>
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        ) : null}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { backgroundColor: accentColor }, barStyle]} />
        </View>
        <Text style={styles.progressCount}>{index + 1}/{total}</Text>
      </View>

      <Animated.View
        key={current.id}
        entering={FadeInRight.duration(320)}
        exiting={FadeOutLeft.duration(220)}
        style={styles.questionArea}>
        <QuestionRenderer question={current} accentColor={accentColor} onResult={handleResult} />
      </Animated.View>
    </View>
  );
}

function QuestionRenderer({
  question,
  accentColor,
  onResult,
}: {
  question: QuizQuestion;
  accentColor: string;
  onResult: (correct: boolean) => void;
}) {
  switch (question.type) {
    case 'translate':
      return <TranslateView q={question} accentColor={accentColor} onResult={onResult} />;
    case 'listen':
      return <ListenView q={question} accentColor={accentColor} onResult={onResult} />;
    case 'match':
      return <MatchView q={question} accentColor={accentColor} onResult={onResult} />;
    case 'build':
      return <BuildView q={question} accentColor={accentColor} onResult={onResult} />;
    case 'type':
      return <TypeView q={question} accentColor={accentColor} onResult={onResult} />;
    case 'ending-choice':
      return <EndingChoiceView q={question} accentColor={accentColor} onResult={onResult} />;
    case 'cloze':
      return <ClozeView q={question} accentColor={accentColor} onResult={onResult} />;
    case 'agreement-table':
      return <AgreementTableView q={question} accentColor={accentColor} onResult={onResult} />;
    default:
      return null;
  }
}

// ─── Choice button (shared by translate + listen) ────────────────────────────

function ChoiceButton({
  label,
  state,
  disabled,
  onPress,
}: {
  label: string;
  state: 'idle' | 'correct' | 'wrong';
  disabled: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (state === 'correct') scale.value = withSequence(withSpring(1.04), withSpring(1));
    if (state === 'wrong') {
      shake.value = withSequence(
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 60 }),
        withTiming(-4, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
    }
  }, [state, scale, shake]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shake.value }],
  }));

  return (
    <Animated.View style={aStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => {
          scale.set(withSequence(withSpring(0.96), withSpring(1)));
          onPress();
        }}
        style={[
          styles.choice,
          state === 'correct' && styles.choiceCorrect,
          state === 'wrong' && styles.choiceWrong,
        ]}>
        <Text
          style={[
            styles.choiceText,
            state === 'correct' && { color: C.primaryDark },
            state === 'wrong' && { color: C.red },
          ]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function startsWithPunctuation(value: string): boolean {
  return /^[,.;:!?)]/.test(value.trimStart());
}

function isShortEnding(value: string): boolean {
  const clean = value.trim().replace(/^-/, '');
  return clean.length <= 2 && /^[\p{L}'’]+$/u.test(clean);
}

function needsWordGap(left: string, right?: string): boolean {
  if (!right) return false;
  if (!left || /\s$/.test(left) || /^\s/.test(right)) return false;
  if (startsWithPunctuation(right)) return false;
  return true;
}

function inlineCompletionParts({
  before,
  answer,
  after,
  mode,
}: {
  before: string;
  answer: string;
  after?: string;
  mode: 'ending' | 'cloze';
}): { beforeText: string; answerText: string; afterText: string } {
  const gapBeforeAnswer = mode === 'cloze' || !isShortEnding(answer) ? needsWordGap(before, answer) : false;
  const answerText = `${gapBeforeAnswer ? ' ' : ''}${answer}`;
  const gapAfterAnswer = needsWordGap(answer, after);
  return {
    beforeText: before,
    answerText,
    afterText: after ? `${gapAfterAnswer ? ' ' : ''}${after}` : '',
  };
}

// ─── Translate ────────────────────────────────────────────────────────────────

function TranslateView({
  q,
  accentColor,
  onResult,
}: {
  q: TranslateQuestion;
  accentColor: string;
  onResult: (correct: boolean) => void;
}) {
  const tts = useItalianTTS();
  const [picked, setPicked] = useState<string | null>(null);

  const answer = useCallback(
    (choice: string) => {
      if (picked) return;
      setPicked(choice);
      const correct = choice === q.correct;
      if (correct) void successFeedback();
      else void warningFeedback();
      playQuizSound(correct ? 'correct' : 'wrong');
      onResult(correct);
    },
    [picked, q.correct, onResult],
  );

  return (
    <View style={styles.body}>
      <Text style={styles.instruction}>Traduis ce mot</Text>
      <Pressable onPress={() => tts.speak(q.speakText ?? speakableIt(q.prompt), { rate: 0.85 })} style={styles.promptCard}>
        <Text style={styles.promptBig}>{q.prompt}</Text>
        {q.phonetic ? <Text style={styles.promptPhonetic}>{q.phonetic}</Text> : null}
        <Text style={[styles.listenHint, { color: accentColor }]}>▶ écouter</Text>
      </Pressable>
      <View style={styles.choices}>
        {q.choices.map((choice) => (
          <ChoiceButton
            key={choice}
            label={choice}
            disabled={Boolean(picked)}
            state={
              !picked ? 'idle' : choice === q.correct ? 'correct' : choice === picked ? 'wrong' : 'idle'
            }
            onPress={() => answer(choice)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Listen ───────────────────────────────────────────────────────────────────

function ListenView({
  q,
  accentColor,
  onResult,
}: {
  q: ListenQuestion;
  accentColor: string;
  onResult: (correct: boolean) => void;
}) {
  const tts = useItalianTTS();
  const [picked, setPicked] = useState<string | null>(null);
  const pulse = useSharedValue(1);

  useEffect(() => {
    const t = setTimeout(() => tts.speak(q.audio, { rate: 0.8 }), 250);
    pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
    return () => clearTimeout(t);
  }, [q.audio, tts, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const answer = useCallback(
    (choice: string) => {
      if (picked) return;
      setPicked(choice);
      const correct = choice === q.correct;
      if (correct) void successFeedback();
      else void warningFeedback();
      playQuizSound(correct ? 'correct' : 'wrong');
      onResult(correct);
    },
    [picked, q.correct, onResult],
  );

  return (
    <View style={styles.body}>
      <Text style={styles.instruction}>{"Qu'as-tu entendu ?"}</Text>
      <View style={styles.speakerWrap}>
        <Animated.View style={pulseStyle}>
          <Pressable
            onPress={() => tts.speak(q.audio, { rate: 0.8 })}
            style={[styles.speakerBtn, { backgroundColor: accentColor }]}>
            <Text style={styles.speakerIcon}>🔊</Text>
          </Pressable>
        </Animated.View>
        <Pressable onPress={() => tts.speak(q.audio, { rate: 0.55 })} style={styles.slowBtn}>
          <Text style={styles.slowBtnText}>🐢 lent</Text>
        </Pressable>
      </View>
      <View style={styles.choices}>
        {q.choices.map((choice) => (
          <ChoiceButton
            key={choice}
            label={choice}
            disabled={Boolean(picked)}
            state={
              !picked ? 'idle' : choice === q.correct ? 'correct' : choice === picked ? 'wrong' : 'idle'
            }
            onPress={() => answer(choice)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Grammar: ending choice ─────────────────────────────────────────────────

function EndingChoiceView({
  q,
  accentColor,
  onResult,
}: {
  q: EndingChoiceQuestion;
  accentColor: string;
  onResult: (correct: boolean) => void;
}) {
  const tts = useItalianTTS();
  const [picked, setPicked] = useState<string | null>(null);
  const display = inlineCompletionParts({
    before: q.before,
    answer: picked ?? '___',
    after: q.after,
    mode: 'ending',
  });

  const answer = useCallback(
    (choice: string) => {
      if (picked) return;
      setPicked(choice);
      const correct = normaliseAnswer(choice) === normaliseAnswer(q.correct);
      if (correct) void successFeedback();
      else void warningFeedback();
      playQuizSound(correct ? 'correct' : 'wrong');
      if (q.speakText) tts.speak(q.speakText, { rate: 0.85 });
      onResult(correct);
    },
    [picked, q.correct, q.speakText, onResult, tts],
  );

  return (
    <View style={styles.body}>
      <Text selectable style={styles.instruction}>{q.title}</Text>
      <Text selectable style={styles.grammarPrompt}>{q.prompt}</Text>
      <View style={[styles.grammarFrame, { borderLeftColor: accentColor }]}>
        <Text selectable style={styles.wordAssembly}>
          {display.beforeText}
          <Text style={[styles.blankInline, { color: picked ? C.text : accentColor }]}>
            {display.answerText}
          </Text>
          {display.afterText}
        </Text>
        {q.translation ? <Text selectable style={styles.translationText}>{q.translation}</Text> : null}
      </View>
      <View style={styles.choices}>
        {q.choices.map((choice) => (
          <ChoiceButton
            key={choice}
            label={choice}
            disabled={Boolean(picked)}
            state={!picked ? 'idle' : choice === q.correct ? 'correct' : choice === picked ? 'wrong' : 'idle'}
            onPress={() => answer(choice)}
          />
        ))}
      </View>
      {picked ? (
        <Animated.View entering={FadeInDown.duration(220)} style={styles.explanationBox}>
          <Text selectable style={styles.explanationTitle}>Pourquoi ?</Text>
          <Text selectable style={styles.explanationText}>{q.explanation}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─── Grammar: cloze listening ───────────────────────────────────────────────

function ClozeView({
  q,
  accentColor,
  onResult,
}: {
  q: ClozeQuestion;
  accentColor: string;
  onResult: (correct: boolean) => void;
}) {
  const tts = useItalianTTS();
  const [picked, setPicked] = useState<string | null>(null);
  const display = inlineCompletionParts({
    before: q.before,
    answer: picked ?? '____',
    after: q.after,
    mode: 'cloze',
  });

  useEffect(() => {
    if (!q.speakText) return;
    const t = setTimeout(() => tts.speak(q.speakText!, { rate: 0.78 }), 260);
    return () => clearTimeout(t);
  }, [q.speakText, tts]);

  const answer = useCallback(
    (choice: string) => {
      if (picked) return;
      setPicked(choice);
      const correct = normaliseAnswer(choice) === normaliseAnswer(q.correct);
      if (correct) void successFeedback();
      else void warningFeedback();
      playQuizSound(correct ? 'correct' : 'wrong');
      onResult(correct);
    },
    [picked, q.correct, onResult],
  );

  return (
    <View style={styles.body}>
      <Text selectable style={styles.instruction}>{q.title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ecouter la phrase"
        onPress={() => q.speakText && tts.speak(q.speakText, { rate: 0.78 })}
        style={[styles.listenCircle, { borderColor: accentColor }]}>
        <Text style={[styles.listenCircleIcon, { color: accentColor }]}>🔊</Text>
      </Pressable>
      <Text selectable style={styles.grammarPrompt}>{q.prompt}</Text>
      <Text selectable style={styles.clozeSentence}>
        {display.beforeText}
        <Text style={[styles.clozeBlank, { color: picked ? C.text : accentColor }]}>
          {display.answerText}
        </Text>
        {display.afterText}
      </Text>
      {q.translation ? <Text selectable style={styles.translationText}>{q.translation}</Text> : null}
      <View style={styles.choices}>
        {q.choices.map((choice) => (
          <ChoiceButton
            key={choice}
            label={choice}
            disabled={Boolean(picked)}
            state={!picked ? 'idle' : choice === q.correct ? 'correct' : choice === picked ? 'wrong' : 'idle'}
            onPress={() => answer(choice)}
          />
        ))}
      </View>
      {picked ? (
        <Animated.View entering={FadeInDown.duration(220)} style={styles.explanationBox}>
          <Text selectable style={styles.explanationTitle}>Pourquoi ?</Text>
          <Text selectable style={styles.explanationText}>{q.explanation}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─── Grammar: agreement table ───────────────────────────────────────────────

function AgreementTableView({
  q,
  accentColor,
  onResult,
}: {
  q: AgreementTableQuestion;
  accentColor: string;
  onResult: (correct: boolean) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const selectedCount = Object.keys(answers).length;

  const pick = useCallback((rowId: string, value: string) => {
    if (checked !== 'idle') return;
    setAnswers((current) => ({ ...current, [rowId]: value }));
    playQuizSound('tap');
  }, [checked]);

  const check = useCallback(() => {
    const correct = q.rows.every((row) => normaliseAnswer(answers[row.id] ?? '') === normaliseAnswer(row.correct));
    setChecked(correct ? 'correct' : 'wrong');
    if (correct) void successFeedback();
    else void warningFeedback();
    playQuizSound(correct ? 'correct' : 'wrong');
    onResult(correct);
  }, [answers, q.rows, onResult]);

  return (
    <View style={styles.body}>
      <Text selectable style={styles.instruction}>{q.title}</Text>
      <Text selectable style={styles.tableTitle}>{q.prompt}</Text>
      <View style={[styles.tableFrame, { borderLeftColor: accentColor }]}>
        {q.rows.map((row) => {
          const picked = answers[row.id];
          const isRight = checked !== 'idle' && picked === row.correct;
          const isWrong = checked !== 'idle' && picked !== row.correct;
          return (
            <View key={row.id} style={styles.tableRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text selectable style={styles.tableSentence}>
                  {row.before}
                  <Text style={[
                    styles.tableBlank,
                    picked && { color: C.text },
                    isRight && { color: C.primaryDark },
                    isWrong && { color: C.red },
                  ]}>
                    {picked ?? '_'}
                  </Text>
                  {row.after ?? ''}
                </Text>
                {row.translation ? <Text selectable style={styles.translationText}>{row.translation}</Text> : null}
              </View>
              <View style={styles.suffixBank}>
                {q.choices.map((choice) => (
                  <Pressable
                    key={`${row.id}-${choice}`}
                    disabled={checked !== 'idle'}
                    onPress={() => pick(row.id, choice)}
                    style={[
                      styles.suffixChip,
                      picked === choice && { borderColor: accentColor, backgroundColor: accentColor + '18' },
                    ]}>
                    <Text style={[styles.suffixChipText, picked === choice && { color: accentColor }]}>{choice}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </View>
      {checked === 'idle' ? (
        <Pressable
          disabled={selectedCount < q.rows.length}
          onPress={check}
          style={[
            styles.primaryBtn,
            { backgroundColor: accentColor },
            selectedCount < q.rows.length && styles.primaryBtnDisabled,
          ]}>
          <Text style={styles.primaryBtnText}>Vérifier</Text>
        </Pressable>
      ) : (
        <Animated.View entering={FadeInDown.duration(220)} style={styles.explanationBox}>
          <Text selectable style={[styles.explanationTitle, { color: checked === 'correct' ? C.primaryDark : C.red }]}>
            {checked === 'correct' ? 'Accords corrects' : 'Correction'}
          </Text>
          <Text selectable style={styles.explanationText}>{q.explanation}</Text>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Match ────────────────────────────────────────────────────────────────────

type MatchState = 'idle' | 'selected' | 'done' | 'error';

function stableHash(value: string): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }
  return hash >>> 0;
}

function derangeMatchPairs(pairs: MatchPair[], questionId: string): MatchPair[] {
  if (pairs.length <= 1) return [...pairs];

  const ordered = [...pairs].sort(
    (a, b) => stableHash(`${questionId}:fr:${a.id}`) - stableHash(`${questionId}:fr:${b.id}`),
  );

  for (let offset = 1; offset < ordered.length; offset++) {
    const rotated = ordered.map((_, index) => ordered[(index + offset) % ordered.length]!);
    const hasAlignedPair = rotated.some((pair, index) => pair.id === pairs[index]?.id);
    if (!hasAlignedPair) return rotated;
  }

  // Fallback for unusual duplicate/short inputs: swap any aligned row with the
  // next row so the answer is not visually placed opposite its prompt.
  const fallback = [...ordered];
  for (let index = 0; index < fallback.length; index++) {
    if (fallback[index]?.id !== pairs[index]?.id) continue;
    const swapIndex = (index + 1) % fallback.length;
    [fallback[index], fallback[swapIndex]] = [fallback[swapIndex]!, fallback[index]!];
  }
  return fallback;
}

function MatchView({
  q,
  accentColor,
  onResult,
}: {
  q: MatchQuestion;
  accentColor: string;
  onResult: (correct: boolean) => void;
}) {
  const tts = useItalianTTS();
  const itColumn = useMemo(() => q.pairs.map((p) => ({ key: p.id, text: p.it })), [q.pairs]);
  const frColumn = useMemo(
    () => derangeMatchPairs(q.pairs, q.id).map((p) => ({ key: p.id, text: p.fr })),
    [q.id, q.pairs],
  );
  const [selectedIt, setSelectedIt] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const mistakes = useRef(0);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const correct = mistakes.current <= 1;
    if (correct) void successFeedback();
    else void warningFeedback();
    playQuizSound(correct ? 'correct' : 'wrong');
    onResult(correct);
  }, [onResult]);

  const tapIt = useCallback(
    (key: string, text: string) => {
      if (matched.has(key)) return;
      setSelectedIt(key);
      setErrorKey(null);
      tts.speak(speakableIt(text), { rate: 0.85 });
    },
    [matched, tts],
  );

  const tapFr = useCallback(
    (key: string) => {
      if (!selectedIt || matched.has(key)) return;
      if (key === selectedIt) {
        const next = new Set(matched).add(key);
        setMatched(next);
        setSelectedIt(null);
        void successFeedback();
        playQuizSound('correct');
        if (next.size === q.pairs.length) setTimeout(finish, 280);
      } else {
        mistakes.current += 1;
        setErrorKey(key);
        void warningFeedback();
        playQuizSound('wrong');
        setTimeout(() => setErrorKey(null), 450);
      }
    },
    [selectedIt, matched, q.pairs.length, finish],
  );

  const stateFor = (key: string, selectedKey: string | null): MatchState => {
    if (matched.has(key)) return 'done';
    if (errorKey === key) return 'error';
    if (selectedKey === key) return 'selected';
    return 'idle';
  };

  return (
    <View style={styles.body}>
      <Text style={styles.instruction}>Associe les paires</Text>
      <View style={styles.matchGrid}>
        <View style={styles.matchCol}>
          {itColumn.map((item) => (
            <MatchCell
              key={item.key}
              label={item.text}
              accentColor={accentColor}
              state={stateFor(item.key, selectedIt)}
              onPress={() => tapIt(item.key, item.text)}
            />
          ))}
        </View>
        <View style={styles.matchCol}>
          {frColumn.map((item) => (
            <MatchCell
              key={item.key}
              label={item.text}
              accentColor={accentColor}
              state={stateFor(item.key, null)}
              onPress={() => tapFr(item.key)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function MatchCell({
  label,
  accentColor,
  state,
  onPress,
}: {
  label: string;
  accentColor: string;
  state: MatchState;
  onPress: () => void;
}) {
  const shake = useSharedValue(0);
  useEffect(() => {
    if (state === 'error') {
      shake.value = withSequence(
        withTiming(-5, { duration: 55 }),
        withTiming(5, { duration: 55 }),
        withTiming(0, { duration: 55 }),
      );
    }
  }, [state, shake]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  return (
    <Animated.View style={aStyle} layout={LinearTransition}>
      <Pressable
        disabled={state === 'done'}
        onPress={onPress}
        style={[
          styles.matchCell,
          state === 'selected' && { borderColor: accentColor, backgroundColor: accentColor + '18' },
          state === 'error' && styles.matchCellError,
          state === 'done' && styles.matchCellDone,
        ]}>
        <Text style={[styles.matchCellText, state === 'done' && { color: C.dim }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Build sentence ─────────────────────────────────────────────────────────

function BuildView({
  q,
  accentColor,
  onResult,
}: {
  q: BuildQuestion;
  accentColor: string;
  onResult: (correct: boolean) => void;
}) {
  const tts = useItalianTTS();
  const [bank, setBank] = useState<{ id: string; word: string }[]>(
    () => q.tiles.map((word, i) => ({ id: `tile-${i}`, word })),
  );
  const [answer, setAnswer] = useState<{ id: string; word: string }[]>([]);
  const [checked, setChecked] = useState<'idle' | 'correct' | 'wrong'>('idle');

  const moveToAnswer = useCallback((tile: { id: string; word: string }) => {
    if (checked !== 'idle') return;
    setBank((b) => b.filter((t) => t.id !== tile.id));
    setAnswer((a) => [...a, tile]);
  }, [checked]);

  const moveToBank = useCallback((tile: { id: string; word: string }) => {
    if (checked !== 'idle') return;
    setAnswer((a) => a.filter((t) => t.id !== tile.id));
    setBank((b) => [...b, tile]);
  }, [checked]);

  const check = useCallback(() => {
    const attempt = answer.map((t) => t.word);
    const correct =
      attempt.length === q.solution.length &&
      attempt.every((w, i) => normaliseAnswer(w) === normaliseAnswer(q.solution[i]!));
    setChecked(correct ? 'correct' : 'wrong');
    if (correct) {
      void successFeedback();
      playQuizSound('correct');
      tts.speak(q.sentence, { rate: 0.85 });
    } else {
      void warningFeedback();
      playQuizSound('wrong');
    }
    onResult(correct);
  }, [answer, q.solution, q.sentence, onResult, tts]);

  return (
    <View style={styles.body}>
      <Text style={styles.instruction}>Reconstitue la phrase</Text>
      {q.translation ? <Text style={styles.buildHint}>« {q.translation} »</Text> : null}

      <View style={[styles.answerZone, checked === 'correct' && styles.answerZoneOk, checked === 'wrong' && styles.answerZoneKo]}>
        {answer.length === 0 ? (
          <Text style={styles.answerPlaceholder}>{"Tape les mots dans l'ordre..."}</Text>
        ) : (
          answer.map((tile) => (
            <Animated.View key={tile.id} entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} layout={LinearTransition}>
              <Pressable onPress={() => moveToBank(tile)} style={[styles.tile, { borderColor: accentColor + '55' }]}>
                <Text style={styles.tileText}>{tile.word}</Text>
              </Pressable>
            </Animated.View>
          ))
        )}
      </View>

      <View style={styles.tileBank}>
        {bank.map((tile) => (
          <Animated.View key={tile.id} entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)} layout={LinearTransition}>
            <Pressable onPress={() => moveToAnswer(tile)} style={styles.tile}>
              <Text style={styles.tileText}>{tile.word}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>

      {checked === 'idle' ? (
        <Pressable
          disabled={answer.length === 0}
          onPress={check}
          style={[styles.primaryBtn, { backgroundColor: accentColor }, answer.length === 0 && styles.primaryBtnDisabled]}>
          <Text style={styles.primaryBtnText}>Vérifier</Text>
        </Pressable>
      ) : (
        <Text style={[styles.buildResult, { color: checked === 'correct' ? C.primaryDark : C.red }]}>
          {checked === 'correct' ? '✓ Parfait !' : `✗ ${q.sentence}`}
        </Text>
      )}
    </View>
  );
}

// ─── Type (free input + timer) ────────────────────────────────────────────────

function TypeView({
  q,
  accentColor,
  onResult,
}: {
  q: TypeQuestion;
  accentColor: string;
  onResult: (correct: boolean) => void;
}) {
  const tts = useItalianTTS();
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [seconds, setSeconds] = useState(q.timerSeconds);
  const settled = useRef(false);

  const settle = useCallback(
    (correct: boolean) => {
      if (settled.current) return;
      settled.current = true;
      setChecked(correct ? 'correct' : 'wrong');
      if (correct) {
        void successFeedback();
        playQuizSound('correct');
        tts.speak(q.accepted[0]!, { rate: 0.85 });
      } else {
        void warningFeedback();
        playQuizSound('wrong');
      }
      onResult(correct);
    },
    [q.accepted, onResult, tts],
  );

  useEffect(() => {
    if (checked !== 'idle') return;
    if (seconds <= 0) {
      settle(false);
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, checked, settle]);

  const submit = useCallback(() => {
    const correct = q.accepted.some((a) => normaliseAnswer(a) === normaliseAnswer(value));
    settle(correct);
  }, [q.accepted, value, settle]);

  const danger = seconds <= 5;

  return (
    <View style={styles.body}>
      <View style={styles.typeHeader}>
        <Text style={styles.instruction}>Écris en italien</Text>
        <View style={[styles.timerPill, { backgroundColor: danger ? C.redSoft : C.surface2 }]}>
          <Text style={[styles.timerText, { color: danger ? C.red : C.muted }]}>{seconds}s</Text>
        </View>
      </View>
      <View style={styles.promptCard}>
        <Text style={styles.promptBig}>{q.prompt}</Text>
        {/* Phonétique révélée seulement après réponse : avant, elle donnerait
            la prononciation (donc la réponse) du mot italien à écrire. */}
        {checked !== 'idle' && q.phonetic ? (
          <Text style={styles.promptPhonetic}>{q.phonetic}</Text>
        ) : null}
      </View>
      <TextInput
        value={value}
        onChangeText={setValue}
        editable={checked === 'idle'}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Ta réponse…"
        placeholderTextColor={C.dim}
        onSubmitEditing={submit}
        style={[
          styles.input,
          checked === 'correct' && { borderColor: C.primary, backgroundColor: C.primarySoft },
          checked === 'wrong' && { borderColor: C.red, backgroundColor: C.redSoft },
        ]}
      />
      {checked === 'idle' ? (
        <Pressable
          disabled={value.trim().length === 0}
          onPress={submit}
          style={[styles.primaryBtn, { backgroundColor: accentColor }, value.trim().length === 0 && styles.primaryBtnDisabled]}>
          <Text style={styles.primaryBtnText}>Valider</Text>
        </Pressable>
      ) : (
        <Text style={[styles.buildResult, { color: checked === 'correct' ? C.primaryDark : C.red }]}>
          {checked === 'correct' ? '✓ Correct !' : `✗ ${q.accepted[0]}`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  closeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { color: C.dim, fontSize: 18, fontWeight: '900' },
  progressTrack: { flex: 1, height: 14, borderRadius: 7, backgroundColor: C.surface2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 7 },
  progressCount: { color: C.dim, fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  questionArea: { flex: 1 },
  body: { flex: 1, gap: 16 },
  instruction: { color: C.text, fontSize: 18, fontWeight: '900' },
  promptCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 26,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
  },
  promptBig: { color: C.text, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  promptPhonetic: { color: C.dim, fontSize: 14, fontStyle: 'italic' },
  listenHint: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  choices: { gap: 10 },
  choice: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  choiceCorrect: { borderColor: C.primary, backgroundColor: C.primarySoft },
  choiceWrong: { borderColor: C.red, backgroundColor: C.redSoft },
  choiceText: { color: C.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  grammarPrompt: { color: C.muted, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  grammarFrame: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: C.border,
    padding: 16,
    gap: 8,
  },
  wordAssembly: { color: C.text, fontSize: 38, lineHeight: 46, fontWeight: '900', textAlign: 'center' },
  blankInline: { fontWeight: '900' },
  translationText: { color: C.muted, fontSize: 14, lineHeight: 19 },
  explanationBox: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    padding: 13,
    gap: 4,
  },
  explanationTitle: { color: C.text, fontSize: 13, fontWeight: '900' },
  explanationText: { color: C.muted, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  listenCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: C.surface,
  },
  listenCircleIcon: { fontSize: 40 },
  clozeSentence: { color: C.text, fontSize: 32, lineHeight: 42, fontWeight: '800', textAlign: 'center' },
  clozeBlank: { fontWeight: '900', textDecorationLine: 'underline' },
  tableTitle: { color: C.text, fontSize: 30, fontWeight: '900' },
  tableFrame: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: C.border,
    padding: 14,
    gap: 14,
  },
  tableRow: { gap: 10 },
  tableSentence: { color: C.text, fontSize: 25, lineHeight: 33, fontWeight: '800' },
  tableBlank: { color: C.dim, fontWeight: '900', textDecorationLine: 'underline' },
  suffixBank: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suffixChip: {
    minWidth: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  suffixChipText: { color: C.text, fontSize: 15, fontWeight: '900' },
  speakerWrap: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  speakerBtn: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  speakerIcon: { fontSize: 40 },
  slowBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface2 },
  slowBtnText: { color: C.muted, fontSize: 13, fontWeight: '800' },
  matchGrid: { flexDirection: 'row', gap: 12 },
  matchCol: { flex: 1, gap: 10 },
  matchCell: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingVertical: 16,
    paddingHorizontal: 10,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchCellError: { borderColor: C.red, backgroundColor: C.redSoft },
  matchCellDone: { borderColor: C.primarySoft, backgroundColor: C.surface2, opacity: 0.55 },
  matchCellText: { color: C.text, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  buildHint: { color: C.muted, fontSize: 15, fontStyle: 'italic' },
  answerZone: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.border,
    borderStyle: 'dashed',
    backgroundColor: C.surface,
    padding: 12,
    alignItems: 'flex-start',
  },
  answerZoneOk: { borderColor: C.primary, borderStyle: 'solid', backgroundColor: C.primarySoft },
  answerZoneKo: { borderColor: C.red, borderStyle: 'solid', backgroundColor: C.redSoft },
  answerPlaceholder: { color: C.dim, fontSize: 14, fontStyle: 'italic' },
  tileBank: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 50 },
  tile: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    boxShadow: '0 2px 0 rgba(0,0,0,0.06)',
  },
  tileText: { color: C.text, fontSize: 16, fontWeight: '800' },
  buildResult: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  typeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timerPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  timerText: { fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  input: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  primaryBtn: { alignItems: 'center', borderRadius: 16, paddingVertical: 16 },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
