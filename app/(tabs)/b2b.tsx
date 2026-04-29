import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

import {
  cultureCards,
  dailyB2BNews,
  listenActionQuestions,
  phonemeTargets,
  roadmap120,
  technicalTerms,
  warmupPhrases,
  type ListenActionQuestion,
} from '@/data/b2b-operational';
import {
  addXp,
  getCallReplays,
  getDayProgress,
  getPhonemeStats,
  getRecentNumberLookups,
  insertLearningSession,
  logNumberLookup,
  upsertPhonemeAttempt,
  type CallReplayRow,
  type DayProgressRow,
  type NumberLookupRow,
  type PhonemeStatRow,
} from '@/database/italpro-local-db';
import { speakIt } from '@/services/italian-tts';
import {
  buildNumberDrill,
  normalizeNumberAnswer,
  readItalianNumber,
  type NumberDrillItem,
  type NumberDrillMode,
} from '@/services/italian-numbers';

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
  blue: '#1CB0F6',
  blueSoft: '#D0F0FF',
  orange: '#FF9600',
  orangeSoft: '#FFF0D6',
  purple: '#CE82FF',
  purpleSoft: '#F0E0FF',
  red: '#FF4B4B',
  redSoft: '#FFE1E1',
} as const;

type B2BTab = 'today' | 'exercises' | 'resources';
type VocabCategory = 'container' | 'logistique' | 'legal' | 'finance' | 'telephone' | 'temps';

const MODE_LABELS: Record<NumberDrillMode, string> = {
  price: 'Prix',
  dimension: 'Dimensions',
  date: 'Dates',
  plain: 'Libre',
};

const VOCAB_CATEGORIES: { id: VocabCategory; label: string }[] = [
  { id: 'telephone', label: 'Téléphone' },
  { id: 'temps', label: 'Dates · Heure' },
  { id: 'finance', label: 'Finance' },
  { id: 'container', label: 'Container' },
  { id: 'logistique', label: 'Logistique' },
  { id: 'legal', label: 'Légal' },
];

export default function B2BScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<B2BTab>('today');
  const [readerInput, setReaderInput] = useState('2547');
  const [readerOutput, setReaderOutput] = useState(readItalianNumber(2547, 'price'));
  const [readerMode, setReaderMode] = useState<NumberDrillMode>('price');
  const [drillMode, setDrillMode] = useState<NumberDrillMode>('price');
  const [drillSpeed, setDrillSpeed] = useState(1);
  const [drillItem, setDrillItem] = useState<NumberDrillItem>(() => buildNumberDrill('price', 1));
  const [drillAnswer, setDrillAnswer] = useState('');
  const [drillFeedback, setDrillFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [listenQuestionIndex, setListenQuestionIndex] = useState(0);
  const [listenChoiceId, setListenChoiceId] = useState<string | null>(null);
  const [listenPlayed, setListenPlayed] = useState(false);
  const [warmupIndex, setWarmupIndex] = useState(0);
  const [numberLookups, setNumberLookups] = useState<NumberLookupRow[]>([]);
  const [replays, setReplays] = useState<CallReplayRow[]>([]);
  const [phonemes, setPhonemes] = useState<PhonemeStatRow[]>([]);
  const [dayInfo, setDayInfo] = useState<DayProgressRow>({ daysActive: 0, daysSinceStart: 0, firstSessionAt: null });
  const [vocabCategory, setVocabCategory] = useState<VocabCategory>('telephone');

  const listenQuestion = listenActionQuestions[listenQuestionIndex] ?? listenActionQuestions[0]!;
  const currentWarmup = warmupPhrases[warmupIndex % warmupPhrases.length]!;

  const load = useCallback(async () => {
    const [lookups, savedReplays, phonemeRows, day] = await Promise.all([
      getRecentNumberLookups(5),
      getCallReplays(6),
      getPhonemeStats(),
      getDayProgress(),
    ]);
    setNumberLookups(lookups);
    setReplays(savedReplays);
    setPhonemes(phonemeRows);
    setDayInfo(day);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const dayNumber = Math.min(120, Math.max(0, dayInfo.daysSinceStart));
  const progressPct = Math.round((dayNumber / 120) * 100);
  const currentMilestone = useMemo(
    () => roadmap120.find((m) => dayNumber <= m.day) ?? roadmap120[roadmap120.length - 1]!,
    [dayNumber],
  );

  const handleReader = useCallback(async () => {
    const spoken = readItalianNumber(readerInput, readerMode);
    setReaderOutput(spoken);
    if (!spoken) return;
    speakIt(spoken, { rate: 0.84 });
    await logNumberLookup({ inputValue: readerInput, spokenIt: spoken, mode: readerMode }).catch(() => null);
    load();
  }, [load, readerInput, readerMode]);

  const playWarmup = useCallback(async () => {
    speakIt(currentWarmup, { rate: 0.84 });
    await addXp(5).catch(() => null);
    setWarmupIndex((i) => i + 1);
  }, [currentWarmup]);

  const playDrill = useCallback(() => {
    speakIt(drillItem.spoken, { rate: drillSpeed === 1 ? 0.72 : drillSpeed === 2 ? 0.88 : 1.05 });
  }, [drillItem.spoken, drillSpeed]);

  const nextDrill = useCallback(() => {
    const next = buildNumberDrill(drillMode, drillSpeed);
    setDrillItem(next);
    setDrillAnswer('');
    setDrillFeedback(null);
    setTimeout(() => speakIt(next.spoken, { rate: drillSpeed === 1 ? 0.72 : drillSpeed === 2 ? 0.88 : 1.05 }), 120);
  }, [drillMode, drillSpeed]);

  const submitDrill = useCallback(async () => {
    const expected = normalizeNumberAnswer(drillItem.numeric);
    const actual = normalizeNumberAnswer(drillAnswer);
    const expectedDigits = expected.replace(/[^0-9/]/g, '');
    const actualDigits = actual.replace(/[^0-9/]/g, '');
    const ok = actualDigits.length > 0 && (actual === expected || actualDigits === expectedDigits);
    setDrillFeedback({ ok, text: ok ? 'Bravo, c\'est bon !' : `Presque. La bonne réponse : ${drillItem.numeric}` });
    await addXp(ok ? 20 : 5).catch(() => null);
    await insertLearningSession({ sessionType: 'quiz', durationSeconds: 30, cardsReviewed: 1, scoreAvg: ok ? 100 : 40 }).catch(() => null);
    setTimeout(nextDrill, ok ? 1100 : 2400);
  }, [drillAnswer, drillItem, nextDrill]);

  const playListenQuestion = useCallback((q: ListenActionQuestion) => {
    setListenChoiceId(null);
    setListenPlayed(true);
    speakIt(q.audioIt, { rate: 0.92 });
  }, []);

  const answerListen = useCallback(async (choiceId: string) => {
    if (!listenPlayed) return;
    setListenChoiceId(choiceId);
    const ok = choiceId === listenQuestion.answerId;
    await addXp(ok ? 25 : 5).catch(() => null);
    await insertLearningSession({ sessionType: 'quiz', durationSeconds: 45, cardsReviewed: 1, scoreAvg: ok ? 100 : 40 }).catch(() => null);
    setTimeout(() => {
      setListenQuestionIndex((i) => (i + 1) % listenActionQuestions.length);
      setListenChoiceId(null);
      setListenPlayed(false);
    }, 1600);
  }, [listenPlayed, listenQuestion.answerId]);

  const markPhoneme = useCallback(async (phoneme: string, missed: boolean) => {
    await upsertPhonemeAttempt(phoneme, missed);
    await load();
  }, [load]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text selectable style={styles.kicker}>Objectif commercial</Text>
          <Text selectable style={styles.title}>B2B en 120 jours</Text>
        </View>
        <View style={styles.dayBadge}>
          <Text selectable style={styles.dayValue}>J{dayNumber}</Text>
          <Text selectable style={styles.dayLabel}>/120</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <TabBar activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'today' ? (
          <>
            <HeroCard dayNumber={dayNumber} progressPct={progressPct} dayInfo={dayInfo} currentMilestone={currentMilestone} />
            <WarmupCard currentWarmup={currentWarmup} warmupIndex={warmupIndex} onPlay={playWarmup} />
            <ReaderCard
              input={readerInput}
              output={readerOutput}
              mode={readerMode}
              lookups={numberLookups}
              onInputChange={setReaderInput}
              onModeChange={setReaderMode}
              onRead={handleReader}
            />
          </>
        ) : null}

        {activeTab === 'exercises' ? (
          <>
            <NumberDrillCard
              drillMode={drillMode}
              drillSpeed={drillSpeed}
              drillItem={drillItem}
              drillAnswer={drillAnswer}
              drillFeedback={drillFeedback}
              onModeChange={(mode) => {
                setDrillMode(mode);
                setDrillItem(buildNumberDrill(mode, drillSpeed));
                setDrillAnswer('');
                setDrillFeedback(null);
              }}
              onSpeedChange={setDrillSpeed}
              onAnswerChange={setDrillAnswer}
              onPlay={playDrill}
              onSubmit={submitDrill}
            />
            <ListenActionCard question={listenQuestion} selectedId={listenChoiceId} played={listenPlayed} onPlay={() => playListenQuestion(listenQuestion)} onAnswer={answerListen} />
            <PhonemeCard stats={phonemes} onMark={markPhoneme} />
          </>
        ) : null}

        {activeTab === 'resources' ? (
          <>
            <RoadmapCard currentDay={dayNumber} />
            <TechnicalVocabularyCard category={vocabCategory} onCategoryChange={setVocabCategory} />
            <NewsCard />
            <ReplayCard replays={replays} />
            <CultureCard />
            <CertificateCard dayNumber={dayNumber} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function TabBar({ activeTab, onChange }: { activeTab: B2BTab; onChange: (tab: B2BTab) => void }) {
  return (
    <View style={styles.tabBar}>
      <TabButton label="Aujourd'hui" active={activeTab === 'today'} onPress={() => onChange('today')} />
      <TabButton label="Exercices" active={activeTab === 'exercises'} onPress={() => onChange('exercises')} />
      <TabButton label="Ressources" active={activeTab === 'resources'} onPress={() => onChange('resources')} />
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

function HeroCard({
  dayNumber,
  progressPct,
  dayInfo,
  currentMilestone,
}: {
  dayNumber: number;
  progressPct: number;
  dayInfo: DayProgressRow;
  currentMilestone: (typeof roadmap120)[number];
}) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text selectable style={styles.heroLabel}>Prochain palier</Text>
          <Text selectable style={styles.heroTitle}>{currentMilestone.title} · {currentMilestone.promise}</Text>
        </View>
        <Text selectable style={styles.heroPct}>{progressPct}%</Text>
      </View>
      <View style={styles.track}><View style={[styles.trackFill, { width: `${progressPct}%` }]} /></View>
      <Text selectable style={styles.heroSub}>
        {dayInfo.firstSessionAt
          ? `${dayInfo.daysActive} jour${dayInfo.daysActive > 1 ? 's' : ''} actif${dayInfo.daysActive > 1 ? 's' : ''} sur ${dayNumber} jour${dayNumber > 1 ? 's' : ''}.`
          : 'Démarre une session pour activer le compteur 120 jours.'}
      </Text>
    </View>
  );
}

function WarmupCard({ currentWarmup, warmupIndex, onPlay }: { currentWarmup: string; warmupIndex: number; onPlay: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text selectable style={styles.cardLabel}>Échauffement avant appel</Text>
        <Text selectable style={styles.cardCount}>2 min</Text>
      </View>
      <Text selectable style={styles.bigPhrase}>{currentWarmup}</Text>
      <Text selectable style={styles.helpText}>{(warmupIndex % warmupPhrases.length) + 1} / {warmupPhrases.length}</Text>
      <View style={styles.actionRow}>
        <Pressable onPress={onPlay} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>Écouter · suivant</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(tabs)/call')} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryButtonText}>Lancer un appel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReaderCard({
  input,
  output,
  mode,
  lookups,
  onInputChange,
  onModeChange,
  onRead,
}: {
  input: string;
  output: string;
  mode: NumberDrillMode;
  lookups: NumberLookupRow[];
  onInputChange: (value: string) => void;
  onModeChange: (mode: NumberDrillMode) => void;
  onRead: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text selectable style={styles.cardLabel}>Lire un chiffre</Text>
        <Text selectable style={styles.cardCount}>Outil rapide</Text>
      </View>
      <Segmented modes={['price', 'dimension', 'plain']} selected={mode} onSelect={onModeChange} />
      <TextInput accessibilityLabel="Nombre à lire en italien" keyboardType="numeric" onChangeText={onInputChange} placeholder="2547" placeholderTextColor={C.dim} style={styles.input} value={input} />
      {output ? <Text selectable style={styles.readerOutput}>{output}</Text> : null}
      <Pressable onPress={onRead} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>Lire en italien</Text>
      </Pressable>
      {lookups.length > 0 ? (
        <View style={styles.miniList}>
          <Text selectable style={styles.miniHeader}>Historique récent</Text>
          {lookups.map((lookup) => (
            <Text selectable key={lookup.id} style={styles.miniItem}>
              <Text style={{ fontWeight: '900', color: C.text }}>{lookup.inputValue}</Text>
              {'  →  '}
              {lookup.spokenIt}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function NumberDrillCard({
  drillMode,
  drillSpeed,
  drillItem,
  drillAnswer,
  drillFeedback,
  onModeChange,
  onSpeedChange,
  onAnswerChange,
  onPlay,
  onSubmit,
}: {
  drillMode: NumberDrillMode;
  drillSpeed: number;
  drillItem: NumberDrillItem;
  drillAnswer: string;
  drillFeedback: { ok: boolean; text: string } | null;
  onModeChange: (mode: NumberDrillMode) => void;
  onSpeedChange: (speed: number) => void;
  onAnswerChange: (value: string) => void;
  onPlay: () => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text selectable style={styles.cardLabel}>Entraînement chiffres</Text>
        <Text selectable style={styles.cardCount}>{MODE_LABELS[drillMode]}</Text>
      </View>
      <Segmented modes={['price', 'dimension', 'date']} selected={drillMode} onSelect={onModeChange} />
      <View style={styles.speedRow}>
        {[1, 2, 3].map((speed) => (
          <Pressable key={speed} onPress={() => onSpeedChange(speed)} style={[styles.speedChip, drillSpeed === speed && styles.speedChipActive]}>
            <Text style={[styles.speedText, drillSpeed === speed && styles.speedTextActive]}>{speed === 1 ? 'lent' : speed === 2 ? 'moyen' : 'rapide'}</Text>
          </Pressable>
        ))}
      </View>
      <Text selectable style={styles.drillPrompt}>{drillItem.promptFr}</Text>
      <Pressable onPress={onPlay} style={({ pressed }) => [styles.listenButton, pressed && styles.pressed]}>
        <Text style={styles.listenButtonText}>Audio uniquement</Text>
      </Pressable>
      <TextInput
        accessibilityLabel="Ta réponse"
        keyboardType={drillMode === 'date' ? 'default' : 'numeric'}
        onChangeText={onAnswerChange}
        onSubmitEditing={onSubmit}
        placeholder={drillMode === 'date' ? 'Ex : 15/03' : 'Tape ce que tu as entendu'}
        placeholderTextColor={C.dim}
        returnKeyType="done"
        style={[styles.input, drillFeedback?.ok === true && styles.inputCorrect, drillFeedback?.ok === false && styles.inputWrong]}
        value={drillAnswer}
      />
      <Pressable disabled={!drillAnswer.trim()} onPress={onSubmit} style={({ pressed }) => [styles.primaryButton, !drillAnswer.trim() && styles.primaryButtonDisabled, pressed && drillAnswer.trim() && styles.pressed]}>
        <Text style={styles.primaryButtonText}>Valider</Text>
      </Pressable>
      {drillFeedback ? <Text selectable style={[styles.feedback, { color: drillFeedback.ok ? C.primaryDark : C.red }]}>{drillFeedback.text}</Text> : null}
    </View>
  );
}

function ListenActionCard({
  question,
  selectedId,
  played,
  onPlay,
  onAnswer,
}: {
  question: ListenActionQuestion;
  selectedId: string | null;
  played: boolean;
  onPlay: () => void;
  onAnswer: (choiceId: string) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text selectable style={styles.cardLabel}>Compréhension orale</Text>
        <Text selectable style={styles.cardCount}>1 écoute</Text>
      </View>
      <Pressable onPress={onPlay} style={({ pressed }) => [styles.listenButton, pressed && styles.pressed]}>
        <Text style={styles.listenButtonText}>{played ? 'Rejouer' : "Lancer l'audio client"}</Text>
      </Pressable>
      {!played ? <Text selectable style={styles.helpText}>{"Lance l'audio puis choisis l'action commerciale pertinente."}</Text> : null}
      <View style={styles.choiceList}>
        {question.choices.map((choice) => {
          const answered = selectedId !== null;
          const correct = choice.id === question.answerId;
          const selected = choice.id === selectedId;
          return (
            <Pressable
              key={choice.id}
              disabled={!played || answered}
              onPress={() => onAnswer(choice.id)}
              style={[styles.choice, !played && styles.choiceDisabled, answered && correct && styles.choiceCorrect, answered && selected && !correct && styles.choiceWrong]}>
              <Text style={styles.choiceText}>{choice.label}</Text>
              {answered && correct ? <Text style={styles.choiceMark}>✓</Text> : null}
              {answered && selected && !correct ? <Text style={[styles.choiceMark, { color: C.red }]}>✗</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PhonemeCard({ stats, onMark }: { stats: PhonemeStatRow[]; onMark: (phoneme: string, missed: boolean) => void }) {
  return (
    <View style={styles.card}>
      <Text selectable style={styles.cardLabel}>Travailler ta prononciation</Text>
      <Text selectable style={styles.helpText}>Écoute, répète, puis indique si c&apos;était bon.</Text>
      {phonemeTargets.map((target) => {
        const stat = stats.find((s) => s.phoneme === target.id);
        const attempts = stat?.attempts ?? 0;
        const misses = stat?.misses ?? 0;
        const missPct = attempts > 0 ? Math.round((misses / attempts) * 100) : null;
        const color = missPct === null ? C.dim : missPct >= 50 ? C.red : missPct >= 25 ? C.orange : C.primary;
        return (
          <View key={target.id} style={styles.phonemeRow}>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.phonemeTitleRow}>
                <Text selectable style={styles.phonemeLabel}>{target.label}</Text>
                <Text selectable style={[styles.phonemeStat, { color }]}>{missPct === null ? 'jamais essayé' : `${missPct}% à revoir · ${attempts} essai${attempts > 1 ? 's' : ''}`}</Text>
              </View>
              <Text selectable style={styles.phonemeWords}>{target.examples.join(' · ')}</Text>
            </View>
            <View style={styles.phonemeActions}>
              <Pressable onPress={() => speakIt(target.examples.join(', '), { rate: 0.78 })} style={({ pressed }) => [styles.tinyButton, pressed && styles.pressed]}>
                <Text style={styles.tinyButtonText}>🔊</Text>
              </Pressable>
              <Pressable onPress={() => onMark(target.id, false)} style={({ pressed }) => [styles.tinyButton, styles.tinyButtonOk, pressed && styles.pressed]}>
                <Text style={styles.tinyButtonText}>✓</Text>
              </Pressable>
              <Pressable onPress={() => onMark(target.id, true)} style={({ pressed }) => [styles.tinyButton, styles.tinyButtonDanger, pressed && styles.pressed]}>
                <Text style={styles.tinyButtonText}>✗</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function RoadmapCard({ currentDay }: { currentDay: number }) {
  return (
    <View style={styles.card}>
      <Text selectable style={styles.cardLabel}>Ton parcours 120 jours</Text>
      <View style={styles.roadmap}>
        {roadmap120.map((item, index) => {
          const previousDay = index === 0 ? 0 : roadmap120[index - 1]!.day;
          const reached = currentDay >= item.day;
          const current = !reached && currentDay >= previousDay;
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
  );
}

function TechnicalVocabularyCard({ category, onCategoryChange }: { category: VocabCategory; onCategoryChange: (c: VocabCategory) => void }) {
  const filtered = technicalTerms.filter((t) => t.category === category);
  return (
    <View style={styles.card}>
      <Text selectable style={styles.cardLabel}>Vocabulaire technique</Text>
      <View style={styles.segmented}>
        {VOCAB_CATEGORIES.map((cat) => (
          <Pressable key={cat.id} onPress={() => onCategoryChange(cat.id)} style={[styles.segment, category === cat.id && styles.segmentActive]}>
            <Text style={[styles.segmentText, category === cat.id && styles.segmentTextActive]}>{cat.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.termGrid}>
        {filtered.map((term) => (
          <Pressable key={term.id} onPress={() => speakIt(term.it, { rate: 0.82 })} style={({ pressed }) => [styles.termChip, pressed && styles.pressed]}>
            <Text selectable style={styles.termIt}>{term.it}</Text>
            <Text selectable style={styles.termFr}>{term.fr}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function NewsCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text selectable style={styles.cardLabel}>L&apos;actu pro italienne</Text>
        <Text selectable style={styles.cardCount}>1 min</Text>
      </View>
      <Text selectable style={styles.newsTitle}>{dailyB2BNews.title}</Text>
      <Text selectable style={styles.newsBody}>{dailyB2BNews.it}</Text>
      <View style={styles.keywordRow}>
        {dailyB2BNews.keywords.map((word) => (
          <Pressable key={word} onPress={() => speakIt(word)} style={styles.keyword}>
            <Text style={styles.keywordText}>{word}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ReplayCard({ replays }: { replays: CallReplayRow[] }) {
  return (
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
  );
}

function CultureCard() {
  return (
    <View style={styles.card}>
      <Text selectable style={styles.cardLabel}>Codes pro à l&apos;italienne</Text>
      {cultureCards.map((card) => (
        <View key={card.title} style={styles.cultureItem}>
          <Text selectable style={styles.cultureTitle}>{card.title}</Text>
          <Text selectable style={styles.cultureBody}>{card.body}</Text>
        </View>
      ))}
    </View>
  );
}

function CertificateCard({ dayNumber }: { dayNumber: number }) {
  const remaining = Math.max(0, 120 - dayNumber);
  return (
    <View style={styles.certificateCard}>
      <Text selectable style={styles.certificateKicker}>Objectif final</Text>
      <Text selectable style={styles.certificateTitle}>MercatoTalk · Certificat B2B</Text>
      <Text selectable style={styles.certificateSub}>
        {remaining > 0
          ? `Encore ${remaining} jour${remaining > 1 ? 's' : ''} pour le test final : 30 min · 10 quiz · 1 appel libre noté ≥ 80/100.`
          : 'Tu peux lancer le test final : 30 min · 10 quiz · 1 appel libre noté ≥ 80/100.'}
      </Text>
      <Pressable onPress={() => router.push('/(tabs)/call')} style={({ pressed }) => [styles.certificateButton, pressed && styles.pressed]}>
        <Text style={styles.certificateButtonText}>{remaining > 0 ? "S'entraîner sur un appel" : 'Lancer le test final'}</Text>
      </Pressable>
    </View>
  );
}

function Segmented({ modes, selected, onSelect }: { modes: NumberDrillMode[]; selected: NumberDrillMode; onSelect: (mode: NumberDrillMode) => void }) {
  return (
    <View style={styles.segmented}>
      {modes.map((mode) => (
        <Pressable key={mode} onPress={() => onSelect(mode)} style={[styles.segment, selected === mode && styles.segmentActive]}>
          <Text style={[styles.segmentText, selected === mode && styles.segmentTextActive]}>{MODE_LABELS[mode]}</Text>
        </Pressable>
      ))}
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
    gap: 12,
  },
  kicker: { color: C.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { color: C.text, fontSize: 28, fontWeight: '900' },
  dayBadge: { minWidth: 78, borderRadius: 18, backgroundColor: C.primarySoft, borderWidth: 1.5, borderColor: '#B8E986', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12 },
  dayValue: { color: C.primaryDark, fontSize: 19, fontWeight: '900', fontVariant: ['tabular-nums'] },
  dayLabel: { color: C.primaryDark, fontSize: 10, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 44, gap: 14 },
  tabBar: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 18, padding: 4, gap: 4 },
  tabButton: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 11 },
  tabButtonActive: { backgroundColor: C.surface },
  tabText: { color: C.muted, fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: C.primaryDark },
  heroCard: { backgroundColor: C.surface, borderRadius: 24, borderWidth: 1, borderColor: C.border, padding: 18, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroLabel: { color: C.dim, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  heroTitle: { color: C.text, fontSize: 17, fontWeight: '900', lineHeight: 22 },
  heroPct: { color: C.primaryDark, fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  track: { height: 12, backgroundColor: C.border, borderRadius: 6, overflow: 'hidden' },
  trackFill: { height: 12, backgroundColor: C.primary, borderRadius: 6, minWidth: 4 },
  heroSub: { color: C.muted, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  card: { backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardLabel: { color: C.dim, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  cardCount: { color: C.blue, fontSize: 12, fontWeight: '900' },
  helpText: { color: C.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  bigPhrase: { color: C.text, fontSize: 18, fontWeight: '800', lineHeight: 25 },
  actionRow: { flexDirection: 'row', gap: 10 },
  primaryButton: { backgroundColor: C.primary, borderRadius: 16, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, flex: 1 },
  primaryButtonDisabled: { backgroundColor: C.border },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  secondaryButton: { backgroundColor: C.blueSoft, borderRadius: 16, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, flex: 1 },
  secondaryButtonText: { color: C.blue, fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.85 },
  segmented: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 14, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', borderRadius: 11, paddingVertical: 9 },
  segmentActive: { backgroundColor: C.surface },
  segmentText: { color: C.muted, fontSize: 12, fontWeight: '900' },
  segmentTextActive: { color: C.primaryDark },
  input: { color: C.text, backgroundColor: C.surface2, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, padding: 14, fontSize: 16, fontWeight: '800' },
  inputCorrect: { borderColor: C.primary, backgroundColor: '#F0FBE6' },
  inputWrong: { borderColor: C.red, backgroundColor: C.redSoft },
  readerOutput: { color: C.text, fontSize: 19, fontWeight: '900', lineHeight: 26, backgroundColor: C.primarySoft, borderRadius: 14, padding: 14 },
  miniList: { gap: 5, paddingTop: 4 },
  miniHeader: { color: C.dim, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  miniItem: { color: C.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  empty: { color: C.muted, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  speedRow: { flexDirection: 'row', gap: 8 },
  speedChip: { flex: 1, borderRadius: 999, backgroundColor: C.surface2, alignItems: 'center', paddingVertical: 9 },
  speedChipActive: { backgroundColor: C.orangeSoft },
  speedText: { color: C.muted, fontSize: 12, fontWeight: '900' },
  speedTextActive: { color: C.orange },
  drillPrompt: { color: C.muted, fontSize: 13, fontWeight: '800' },
  listenButton: { backgroundColor: C.purpleSoft, borderRadius: 16, alignItems: 'center', paddingVertical: 16 },
  listenButtonText: { color: C.purple, fontSize: 15, fontWeight: '900' },
  feedback: { fontSize: 13, fontWeight: '900' },
  choiceList: { gap: 8 },
  choice: { borderRadius: 16, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface2, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  choiceDisabled: { opacity: 0.5 },
  choiceCorrect: { backgroundColor: '#F0FBE6', borderColor: C.primary },
  choiceWrong: { backgroundColor: C.redSoft, borderColor: C.red },
  choiceText: { flex: 1, color: C.text, fontSize: 14, fontWeight: '800', lineHeight: 19 },
  choiceMark: { color: C.primary, fontSize: 18, fontWeight: '900' },
  phonemeRow: { flexDirection: 'row', gap: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 12 },
  phonemeTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  phonemeLabel: { color: C.text, fontSize: 14, fontWeight: '900' },
  phonemeStat: { fontSize: 11, fontWeight: '900' },
  phonemeWords: { color: C.muted, fontSize: 11, fontWeight: '700' },
  phonemeActions: { flexDirection: 'row', gap: 6 },
  tinyButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  tinyButtonOk: { backgroundColor: C.primarySoft },
  tinyButtonDanger: { backgroundColor: C.redSoft },
  tinyButtonText: { color: C.text, fontSize: 13, fontWeight: '900' },
  roadmap: { gap: 12 },
  milestone: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  milestoneDot: { width: 50, height: 50, borderRadius: 16, backgroundColor: C.surface2, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  milestoneDotCurrent: { backgroundColor: C.orangeSoft, borderColor: C.orange },
  milestoneDotDone: { backgroundColor: C.primary, borderColor: C.primaryDark },
  milestoneDay: { color: C.muted, fontSize: 13, fontWeight: '900' },
  milestoneDayDone: { color: '#FFFFFF' },
  milestonePromise: { color: C.text, fontSize: 14, fontWeight: '900', lineHeight: 19 },
  milestoneGate: { color: C.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  milestoneCheck: { color: C.primaryDark, fontSize: 22, fontWeight: '900' },
  termGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  termChip: { width: '48%', backgroundColor: C.surface2, borderRadius: 14, padding: 12, gap: 3 },
  termIt: { color: C.text, fontSize: 13, fontWeight: '900' },
  termFr: { color: C.muted, fontSize: 11, fontWeight: '700' },
  newsTitle: { color: C.text, fontSize: 17, fontWeight: '900' },
  newsBody: { color: C.text, fontSize: 14, fontWeight: '700', lineHeight: 21 },
  keywordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  keyword: { backgroundColor: C.orangeSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  keywordText: { color: C.orange, fontSize: 11, fontWeight: '900' },
  replayRow: { backgroundColor: C.surface2, borderRadius: 14, padding: 12, gap: 3 },
  replayTitle: { color: C.text, fontSize: 14, fontWeight: '900' },
  replayMeta: { color: C.muted, fontSize: 11, fontWeight: '700' },
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
