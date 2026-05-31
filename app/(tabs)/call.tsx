import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { b2bMoods, type B2BMood } from '@/data/b2b-operational';
import {
  addXp,
  getCachedGuidedChoiceSets,
  getLearningSessionCountByType,
  insertCachedGuidedChoices,
  insertLearningSession,
  saveCallReplay,
  unlockAchievement,
  type DialogueMessageRow,
  type ScenarioRow,
} from '@/database/italpro-local-db';
import { useLocalDialogueSession } from '@/hooks/use-local-dialogue-session';
import { useItalianTTS } from '@/hooks/use-italian-tts';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { buildCallReport, CALL_PHASES, getContextualHints } from '@/services/call-session-helpers';
import { successFeedback, tapFeedback } from '@/services/haptics';
import { requestGuidedReplyChoices, type GuidedReplyChoice } from '@/services/guided-choices-ai-client';
import { classifyDialogueTopic, type GuidedChoiceQuality } from '@/services/local-dialogue-engine';
import { hasSpeechProxy } from '@/services/speech-ai-client';
import { transcribeLocalAudio } from '@/services/transcription-client';
import { useCallSessionStore } from '@/stores/call-session-store';

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
  red: '#FF4B4B',
  redSoft: '#FFE1E1',
} as const;

type CallStatus = 'ringing' | 'active' | 'ended';
type CallMode = 'guided' | 'free';
type ClientSpeed = 0.85 | 1 | 1.15;

export default function CallScreen() {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [callStatus, setCallStatus] = useState<CallStatus>('ringing');
  const [callMode, setCallMode] = useState<CallMode>('guided');
  const [immersionMode, setImmersionMode] = useState(false);
  const [clientSpeed, setClientSpeed] = useState<ClientSpeed>(1);
  const [revealedMessageIds, setRevealedMessageIds] = useState<Set<string>>(new Set());
  const [selectedGuidedHint, setSelectedGuidedHint] = useState<GuidedReplyChoice | null>(null);
  const [aiGuidedHints, setAiGuidedHints] = useState<GuidedReplyChoice[] | null>(null);
  const [isLoadingGuidedHints, setIsLoadingGuidedHints] = useState(false);
  const [cheatDraft, setCheatDraft] = useState('');
  const [cheatIt, setCheatIt] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [xpAwarded, setXpAwarded] = useState(false);
  const recordingStartedAt = useRef<number | null>(null);
  const callStartedAt = useRef<number | null>(null);
  const lastSpokenClientMessageId = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const {
    activeScenario,
    messages,
    corrections,
    isLoading,
    isSending,
    error,
    activeScenarioId,
    sendLearnerReply,
    resetActiveConversation,
  } = useLocalDialogueSession();

  const recorder = useVoiceRecorder();
  const tts = useItalianTTS();
  const mood = useCallSessionStore((state) => state.mood);
  const setMood = useCallSessionStore((state) => state.setMood);
  const speechReady = hasSpeechProxy();
  const learnerTurns = useMemo(() => messages.filter((message) => message.role === 'learner').length, [messages]);
  const latestClientMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'client'),
    [messages],
  );
  const phaseIndex = Math.min(CALL_PHASES.length - 1, Math.floor(learnerTurns / 2));
  const report = useMemo(() => buildCallReport(corrections), [corrections]);
  const contextualHints = useMemo(
    () => getContextualHints(latestClientMessage, phaseIndex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latestClientMessage?.id, phaseIndex],
  );
  const guidedHints = aiGuidedHints ?? contextualHints;
  const isUsingAiGuidedHints = aiGuidedHints !== null;

  useEffect(() => {
    if (!activeScenario || !latestClientMessage) {
      queueMicrotask(() => {
        setAiGuidedHints(null);
        setIsLoadingGuidedHints(false);
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setAiGuidedHints(null);
        setIsLoadingGuidedHints(true);
      }
    });

    const topic = classifyDialogueTopic(
      `${latestClientMessage.contentIt} ${latestClientMessage.contentFr}`,
    );

    requestGuidedReplyChoices({
      scenario: activeScenario,
      latestClientMessage,
      history: messages,
      mood,
    })
      .then(async (choices) => {
        if (choices) {
          // AI succeeded: cache the option set for offline reuse.
          await insertCachedGuidedChoices({
            scenarioId: activeScenario.id,
            mood,
            topic,
            choicesJson: JSON.stringify(choices),
          }).catch(() => null);
          if (!cancelled) setAiGuidedHints(choices);
          return;
        }
        // AI unavailable: reuse a previously cached AI option set for this topic
        // (richer than the static hints) before falling back to static.
        const sets = await getCachedGuidedChoiceSets(activeScenario.id, mood, topic).catch(() => []);
        if (!cancelled) {
          if (sets.length > 0) {
            try {
              const pick = JSON.parse(sets[Math.floor(Math.random() * sets.length)]!) as GuidedReplyChoice[];
              setAiGuidedHints(pick);
            } catch {
              setAiGuidedHints(null);
            }
          } else {
            setAiGuidedHints(null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setAiGuidedHints(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingGuidedHints(false);
      });

    return () => {
      cancelled = true;
    };
    // A new guided generation is needed only when the visible client turn changes.
    // Including every messages update would regenerate choices while the learner reply is still being sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario?.id, latestClientMessage?.id, mood]);

  useEffect(() => {
    if (recorder.state !== 'recording') {
      queueMicrotask(() => setRecordingSeconds(0));
      return;
    }

    const intervalId = setInterval(() => {
      if (recordingStartedAt.current) {
        setRecordingSeconds(Math.floor((Date.now() - recordingStartedAt.current) / 1000));
      }
    }, 250);

    return () => clearInterval(intervalId);
  }, [recorder.state]);

  useEffect(() => {
    if (callStatus !== 'active' || !latestClientMessage) return;
    if (lastSpokenClientMessageId.current === latestClientMessage.id) return;

    const timeoutId = setTimeout(() => {
      lastSpokenClientMessageId.current = latestClientMessage.id;
      tts.speak(latestClientMessage.contentIt, { pitch: 1, rate: 0.86 * clientSpeed, preferElevenLabs: true });
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, [callStatus, clientSpeed, latestClientMessage, tts]);

  useEffect(() => {
    if (callStatus !== 'active') return;

    const intervalId = setInterval(() => {
      if (callStartedAt.current) {
        setElapsedSeconds(Math.floor((Date.now() - callStartedAt.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [callStatus]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [messages.length]);

  const answerCall = useCallback(async () => {
    await tapFeedback();
    callStartedAt.current = Date.now();
    setElapsedSeconds(0);
    setCallStatus('active');
    setXpAwarded(false);
    if (latestClientMessage) {
      lastSpokenClientMessageId.current = latestClientMessage.id;
      tts.speak(latestClientMessage.contentIt, { pitch: 1, rate: 0.86 * clientSpeed, preferElevenLabs: true });
    }
  }, [clientSpeed, latestClientMessage, tts]);

  const endCall = useCallback(async () => {
    setCallStatus('ended');
    tts.stop();

    if (xpAwarded) return;

    const avgScore = report.averageScore ?? 0;
    await insertLearningSession({
      sessionType: 'call',
      durationSeconds: Math.max(10, elapsedSeconds),
      cardsReviewed: learnerTurns,
      scoreAvg: avgScore,
    }).catch(() => null);

    await addXp(100).catch(() => null);
    await unlockAchievement('first_call').catch(() => false);
    const callCount = await getLearningSessionCountByType('call').catch(() => 0);
    if (callCount >= 5) await unlockAchievement('five_calls').catch(() => false);
    await successFeedback();
    setXpAwarded(true);
  }, [elapsedSeconds, learnerTurns, report.averageScore, tts, xpAwarded]);

  const restartCall = useCallback(async () => {
    await resetActiveConversation();
    callStartedAt.current = null;
    setElapsedSeconds(0);
    setDraft('');
    setSelectedGuidedHint(null);
    setAiGuidedHints(null);
    setCallStatus('ringing');
    setXpAwarded(false);
    setRevealedMessageIds(new Set());
    lastSpokenClientMessageId.current = null;
  }, [resetActiveConversation]);

  const handleSend = useCallback(async () => {
    const clean = draft.trim();
    if (!clean) return;
    const guidedQuality = selectedGuidedHint && clean === selectedGuidedHint.text ? selectedGuidedHint.quality : undefined;
    setDraft('');
    setSelectedGuidedHint(null);
    await sendLearnerReply(clean, guidedQuality);
  }, [draft, selectedGuidedHint, sendLearnerReply]);

  const speakClient = useCallback(() => {
    if (!latestClientMessage) return;
    tts.speak(latestClientMessage.contentIt, { pitch: 1, rate: 0.86 * clientSpeed, preferElevenLabs: true });
  }, [clientSpeed, latestClientMessage, tts]);

  const revealMessage = useCallback(async (messageId: string) => {
    setRevealedMessageIds((current) => new Set([...current, messageId]));
    await addXp(-5).catch(() => null);
  }, []);

  const translateCheat = useCallback(() => {
    const text = cheatDraft.toLowerCase();
    const translated =
      text.includes('devis') ? 'Le invio un preventivo dettagliato entro oggi.' :
      text.includes('rappeler') || text.includes('rappel') ? 'Posso richiamarLa domani mattina?' :
      text.includes('cher') || text.includes('prix') ? 'Capisco la Sua preoccupazione sul prezzo. Posso spiegarLe cosa e incluso?' :
      text.includes('livraison') ? 'La consegna dipende dalla disponibilita e dalla zona. Mi puo indicare l indirizzo?' :
      text.includes('garantie') ? 'Le garanzie coprono il prodotto e possiamo inviarLe la documentazione tecnica.' :
      'Capisco. Posso verificare e mandarLe una risposta precisa per email.';
    setCheatIt(translated);
  }, [cheatDraft]);

  const insertHint = useCallback((hint: string, quality?: GuidedChoiceQuality, id?: string) => {
    setSelectedGuidedHint(quality ? { id: id ?? hint, text: hint, quality } : null);
    setDraft((current) => {
      const clean = current.trim();
      return clean.length > 0 ? `${clean} ${hint}` : hint;
    });
  }, []);

  const handleVoicePress = useCallback(async () => {
    setVoiceError(null);

    if (recorder.state === 'recording') {
      const result = await recorder.stopRecording();
      recordingStartedAt.current = null;

      if (!result) {
        setVoiceError('Enregistrement vide. Réessayez.');
        return;
      }

      if (result.durationMs < 900) {
        setVoiceError('Audio trop court. Parlez au moins une seconde avant d\'arrêter.');
        return;
      }

      const replayUri = await persistReplayAudio(result.uri).catch(() => result.uri);
      await saveCallReplay({
        scenarioId: activeScenario?.id ?? activeScenarioId,
        title: activeScenario?.title ?? 'Appel B2B',
        audioUri: replayUri,
        durationSeconds: Math.max(1, Math.round(result.durationMs / 1000)),
        score: report.averageScore,
      }).catch(() => null);

      if (!speechReady) {
        setVoiceError('Dictée vocale non disponible. Tapez votre réponse au clavier.');
        return;
      }

      setIsTranscribing(true);
      const transcription = await transcribeLocalAudio({ uri: result.uri, language: 'it' });
      setIsTranscribing(false);

      if (!transcription?.text || transcription.text.trim().length === 0) {
        setVoiceError('Aucune voix détectée. Rapprochez-vous du micro et réessayez.');
        return;
      }

      setDraft((currentDraft) => {
        const cleanCurrent = currentDraft.trim();
        const cleanTranscript = transcription.text.trim();
        return cleanCurrent.length > 0 ? `${cleanCurrent} ${cleanTranscript}` : cleanTranscript;
      });
    } else {
      if (!speechReady) {
        setVoiceError('Dictée vocale non disponible. Tapez votre réponse au clavier.');
        return;
      }

      const ok = await recorder.startRecording();
      if (ok) {
        recordingStartedAt.current = Date.now();
        setRecordingSeconds(0);
      } else {
        setVoiceError('Accès au micro refusé. Autorisez-le dans les paramètres.');
      }
    }
  }, [activeScenario, activeScenarioId, recorder, report.averageScore, speechReady]);

  const isCallActive = callStatus === 'active';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Fixed header ────────────────────────────────────────────────────── */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.kicker}>Simulation commerciale</Text>
          {activeScenario ? (
            <Text style={styles.title} numberOfLines={1}>{activeScenario.title}</Text>
          ) : (
            <Text style={styles.title}>Appel client italien</Text>
          )}
        </View>
      </View>

      {/* ── Scrollable content (sans le Composer) ───────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scrollFlex}
        contentContainerStyle={styles.scroll}>

        <MoodControl mood={mood} onChange={setMood} />

        {callStatus === 'ringing' ? (
          <RingingPanel scenario={activeScenario} onAnswer={answerCall} />
        ) : callStatus === 'ended' ? (
          <EndReport
            elapsedSeconds={elapsedSeconds}
            learnerTurns={learnerTurns}
            report={report}
            onRestart={restartCall}
          />
        ) : (
          <>
            <CallPanel
              elapsedSeconds={elapsedSeconds}
              isLoading={isLoading}
              isSending={isSending}
              messages={messages}
              phaseIndex={phaseIndex}
              immersionMode={immersionMode}
              clientSpeed={clientSpeed}
              revealedMessageIds={revealedMessageIds}
              onChangeImmersion={setImmersionMode}
              onChangeClientSpeed={setClientSpeed}
              onEndCall={endCall}
              onRestartCall={restartCall}
              onSpeakClient={speakClient}
              onRevealMessage={revealMessage}
            />

            <ModeSwitch mode={callMode} onChange={setCallMode} />

            <CheatSheet
              draft={cheatDraft}
              translated={cheatIt}
              onChangeDraft={setCheatDraft}
              onTranslate={translateCheat}
              onUse={(text) => { insertHint(text); setCheatDraft(''); setCheatIt(''); }}
            />

            {callMode === 'guided' ? (
              <View style={styles.hintsCard}>
                <View style={styles.hintsHeader}>
                  <Text selectable style={styles.cardLabel}>Que répondre ?</Text>
                  <Text selectable style={styles.hintsPhaseLabel}>{CALL_PHASES[phaseIndex]}</Text>
                </View>
                <Text selectable style={styles.hintsSubLabel}>
                  {isLoadingGuidedHints
                    ? "L'IA prépare 4 réponses cohérentes…"
                    : isUsingAiGuidedHints
                      ? 'IA · 1 bonne réponse · 1 approximation · 2 pièges'
                      : 'Secours local · 1 bonne réponse · 1 approximation · 2 pièges'}
                </Text>
                <View style={styles.hintsList}>
                  {guidedHints.map((hint) => {
                    const isSelected = selectedGuidedHint?.id === hint.id;
                    return (
                      <Pressable
                        key={hint.id}
                        accessibilityRole="button"
                        accessibilityLabel="Utiliser cette réponse"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => insertHint(hint.text, hint.quality, hint.id)}
                        style={({ pressed }) => [
                          styles.hintChip,
                          isSelected && styles.hintChipSelected,
                          pressed && styles.hintChipPressed,
                        ]}>
                        <Text selectable style={[styles.hintText, isSelected && styles.hintTextSelected]}>{hint.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        )}

        {error ? <Text selectable style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      {/* ── Composer fixe en bas, au-dessus du clavier ──────────────────────── */}
      {isCallActive && (
        <View style={[styles.composerBar, { paddingBottom: insets.bottom }]}>
          {voiceError ? <Text selectable style={styles.errorText}>{voiceError}</Text> : null}
          <Composer
            draft={draft}
            isSending={isSending}
            isRecording={recorder.state === 'recording'}
            isProcessing={recorder.state === 'processing' || isTranscribing}
            recordingSeconds={recordingSeconds}
            onDraftChange={(value) => {
              setSelectedGuidedHint(null);
              setDraft(value);
            }}
            onSend={handleSend}
            onVoicePress={handleVoicePress}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function MoodControl({ mood, onChange }: { mood: B2BMood; onChange: (mood: B2BMood) => void }) {
  const activeMood = b2bMoods.find((item) => item.id === mood) ?? b2bMoods[0]!;

  return (
    <View style={styles.moodCard}>
      <View style={styles.cardHeader}>
        <Text selectable style={styles.cardLabel}>Aujourd&apos;hui</Text>
        <Text selectable style={styles.moodActive}>Client {activeMood.label.replace('client ', '')}</Text>
      </View>
      <Text selectable style={styles.moodTone}>{activeMood.tone}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRail}>
        {b2bMoods.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`Choisir le mood ${item.label}`}
            onPress={() => onChange(item.id)}
            style={[styles.moodChip, mood === item.id && styles.moodChipActive]}>
            <Text style={[styles.moodChipText, mood === item.id && styles.moodChipTextActive]}>
              {item.label.replace('client ', '')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function RingingPanel({ scenario, onAnswer }: { scenario: ScenarioRow | null; onAnswer: () => void }) {
  return (
    <Animated.View entering={ZoomIn.duration(420)} style={styles.ringingPanel}>
      <View style={styles.avatarPulse}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{scenario?.clientPersona.slice(0, 1) ?? 'C'}</Text>
        </View>
      </View>
      <Text selectable style={styles.ringingLabel}>Appel entrant</Text>
      <Text selectable style={styles.ringingName}>{scenario?.title ?? 'Client italien'}</Text>
      <Text selectable style={styles.ringingSub} numberOfLines={2}>
        {scenario?.starterIt ?? 'Pronto?'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Décrocher l'appel"
        onPress={onAnswer}
        style={({ pressed }) => [styles.answerButton, pressed && styles.answerButtonPressed]}>
        <IconSymbol name="phone.fill" color="#FFFFFF" size={22} />
        <Text style={styles.answerText}>Décrocher</Text>
      </Pressable>
    </Animated.View>
  );
}

function CallPanel({
  elapsedSeconds,
  isLoading,
  isSending,
  messages,
  phaseIndex,
  immersionMode,
  clientSpeed,
  revealedMessageIds,
  onChangeImmersion,
  onChangeClientSpeed,
  onEndCall,
  onRestartCall,
  onSpeakClient,
  onRevealMessage,
}: {
  elapsedSeconds: number;
  isLoading: boolean;
  isSending: boolean;
  messages: DialogueMessageRow[];
  phaseIndex: number;
  immersionMode: boolean;
  clientSpeed: ClientSpeed;
  revealedMessageIds: Set<string>;
  onChangeImmersion: (value: boolean) => void;
  onChangeClientSpeed: (value: ClientSpeed) => void;
  onEndCall: () => void;
  onRestartCall: () => void;
  onSpeakClient: () => void;
  onRevealMessage: (messageId: string) => void;
}) {
  return (
    <View style={styles.callPanel}>
      <View style={styles.callPanelHeader}>
        <View>
          <Text selectable style={styles.callTitle}>En appel</Text>
          <Text selectable style={styles.callMeta}>{formatDuration(elapsedSeconds)}</Text>
        </View>
        <View style={styles.callActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Écouter le client" onPress={onSpeakClient} style={styles.iconButton}>
            <IconSymbol name="play.fill" color={C.primaryDark} size={18} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Réinitialiser cette simulation" onPress={onRestartCall} style={styles.iconButton}>
            <IconSymbol name="arrow.counterclockwise" color={C.orange} size={18} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Terminer l'appel" onPress={onEndCall} style={styles.endButton}>
            <IconSymbol name="phone.down.fill" color="#FFFFFF" size={18} />
          </Pressable>
        </View>
      </View>

      <View style={styles.immersionRow}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: immersionMode }}
          accessibilityLabel="Activer le mode immersion audio uniquement"
          onPress={() => onChangeImmersion(!immersionMode)}
          style={[styles.immersionToggle, immersionMode && styles.immersionToggleActive]}>
          <Text style={[styles.immersionText, immersionMode && styles.immersionTextActive]}>
            {immersionMode ? 'Immersion audio' : 'Texte visible'}
          </Text>
        </Pressable>
        {[0.85, 1, 1.15].map((speed) => (
          <Pressable
            key={speed}
            accessibilityRole="button"
            accessibilityLabel={`Vitesse client ${speed}`}
            onPress={() => onChangeClientSpeed(speed as ClientSpeed)}
            style={[styles.speedButton, clientSpeed === speed && styles.speedButtonActive]}>
            <Text style={[styles.speedButtonText, clientSpeed === speed && styles.speedButtonTextActive]}>{speed}x</Text>
          </Pressable>
        ))}
      </View>

      <PhaseBar activeIndex={phaseIndex} />

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={C.primary} />
          <Text selectable style={styles.loadingText}>{"Préparation de l'appel..."}</Text>
        </View>
      ) : (
        <View style={styles.messagesList}>
          {messages.map((message, i) => (
            <MessageBubble
              key={message.id}
              message={message}
              index={i}
              immersionMode={immersionMode}
              revealed={revealedMessageIds.has(message.id)}
              onReveal={() => onRevealMessage(message.id)}
            />
          ))}
          {isSending ? (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.thinkingBubble}>
              <ActivityIndicator color={C.primary} size="small" />
              <Text selectable style={styles.thinkingText}>Le client répond...</Text>
            </Animated.View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function PhaseBar({ activeIndex }: { activeIndex: number }) {
  return (
    <View style={styles.phaseWrap}>
      {CALL_PHASES.map((phase, index) => {
        const active = index <= activeIndex;
        return (
          <View key={phase} style={styles.phaseItem}>
            <View style={[styles.phaseDot, active && styles.phaseDotActive]}>
              <Text style={[styles.phaseNumber, active && styles.phaseNumberActive]}>{index + 1}</Text>
            </View>
            <Text selectable numberOfLines={1} style={[styles.phaseLabel, active && styles.phaseLabelActive]}>
              {phase}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ModeSwitch({ mode, onChange }: { mode: CallMode; onChange: (mode: CallMode) => void }) {
  return (
    <View style={styles.modeSwitch}>
      <Pressable onPress={() => onChange('guided')} style={[styles.switchOption, mode === 'guided' && styles.switchOptionActive]}>
        <Text style={[styles.switchText, mode === 'guided' && styles.switchTextActive]}>Guidé</Text>
      </Pressable>
      <Pressable onPress={() => onChange('free')} style={[styles.switchOption, mode === 'free' && styles.switchOptionActive]}>
        <Text style={[styles.switchText, mode === 'free' && styles.switchTextActive]}>Libre</Text>
      </Pressable>
    </View>
  );
}

function MessageBubble({
  message,
  index,
  immersionMode,
  revealed,
  onReveal,
}: {
  message: DialogueMessageRow;
  index: number;
  immersionMode: boolean;
  revealed: boolean;
  onReveal: () => void;
}) {
  const isLearner = message.role === 'learner';
  const isCoach = message.role === 'coach';
  const hiddenClientText = immersionMode && message.role === 'client' && !revealed;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 35).duration(300)}
      accessibilityLabel={`${message.role}: ${message.contentIt}`}
      style={[styles.messageBubble, isLearner ? styles.messageLearner : isCoach ? styles.messageCoach : styles.messageClient]}>
      {isLearner ? (
        <Text style={styles.messageRoleLabel}>Vous</Text>
      ) : message.role === 'client' ? (
        <Text style={styles.messageRoleLabelClient}>Client</Text>
      ) : null}
      <View style={styles.messageTop}>
        <Text selectable={!hiddenClientText} style={[styles.messageIt, isLearner && styles.messageLearnerText, hiddenClientText && styles.messageHiddenText]}>
          {hiddenClientText ? 'Audio uniquement - texte masqué' : message.contentIt}
        </Text>
        {isLearner && message.coachingNote ? <Text style={styles.warnMark}>⚠</Text> : null}
      </View>
      {hiddenClientText ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Révéler le texte du client pour moins cinq XP" onPress={onReveal} style={styles.revealButton}>
          <Text style={styles.revealText}>Révéler le texte (-5 XP)</Text>
        </Pressable>
      ) : message.contentFr && !isLearner ? (
        <Text selectable style={[styles.messageFr, isLearner && styles.messageFrLearner]}>{message.contentFr}</Text>
      ) : null}
      {message.coachingNote ? <Text selectable style={styles.messageCoachNote}>Coach: {message.coachingNote}</Text> : null}
    </Animated.View>
  );
}

function CheatSheet({
  draft,
  translated,
  onChangeDraft,
  onTranslate,
  onUse,
}: {
  draft: string;
  translated: string;
  onChangeDraft: (value: string) => void;
  onTranslate: () => void;
  onUse: (value: string) => void;
}) {
  return (
    <View style={styles.cheatCard}>
      <View style={styles.cardHeader}>
        <Text selectable style={styles.cardLabel}>Cheat sheet vrai appel</Text>
        <Text selectable style={styles.cheatBadge}>FR {'->'} IT</Text>
      </View>
      <TextInput
        accessibilityLabel="Phrase francaise a traduire rapidement"
        onChangeText={onChangeDraft}
        placeholder="Ex: expliquer le devis, rassurer sur la garantie..."
        placeholderTextColor={C.dim}
        style={styles.cheatInput}
        value={draft}
      />
      <View style={styles.composerActions}>
        <Pressable onPress={onTranslate} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionText}>Traduire</Text>
        </Pressable>
        <Pressable disabled={!translated} onPress={() => onUse(translated)} style={[styles.secondaryAction, !translated && styles.sendButtonDisabled]}>
          <Text style={styles.secondaryActionText}>Utiliser</Text>
        </Pressable>
      </View>
      {translated ? <Text selectable style={styles.cheatResult}>{translated}</Text> : null}
    </View>
  );
}

function Composer({
  draft,
  isSending,
  isRecording,
  isProcessing,
  recordingSeconds,
  onDraftChange,
  onSend,
  onVoicePress,
}: {
  draft: string;
  isSending: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  recordingSeconds: number;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onVoicePress: () => void;
}) {
  return (
    <View style={styles.composer}>
      <TextInput
        accessibilityLabel="Votre réponse en italien"
        autoCapitalize="sentences"
        multiline
        onChangeText={onDraftChange}
        placeholder="Répondez au client en italien..."
        placeholderTextColor={C.dim}
        returnKeyType="send"
        style={styles.input}
        value={draft}
      />
      <View style={styles.composerActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Arrêter l enregistrement vocal' : 'Dicter en vocal'}
          disabled={isSending || isProcessing}
          onPress={onVoicePress}
          style={({ pressed }) => [styles.micButton, isRecording && styles.micButtonActive, pressed && styles.pressed]}>
          {isProcessing ? (
            <ActivityIndicator color={C.blue} size="small" />
          ) : (
            <IconSymbol name="waveform" color={isRecording ? '#FFFFFF' : C.red} size={20} />
          )}
          <Text style={[styles.micButtonText, isRecording && styles.micButtonTextActive]}>
            {isRecording ? `Arrêter · ${recordingSeconds}s` : isProcessing ? 'Transcription…' : 'Parler'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Envoyer la réponse"
          disabled={isSending || draft.trim().length === 0}
          onPress={onSend}
          style={({ pressed }) => [styles.sendButton, draft.trim().length === 0 && styles.sendButtonDisabled, pressed && styles.pressed]}>
          <Text style={styles.sendText}>{isSending ? 'Envoi...' : 'Répondre'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EndReport({
  elapsedSeconds,
  learnerTurns,
  report,
  onRestart,
}: {
  elapsedSeconds: number;
  learnerTurns: number;
  report: ReturnType<typeof buildCallReport>;
  onRestart: () => void;
}) {
  const score = report.averageScore ?? 0;
  const color = score >= 80 ? C.primary : score >= 60 ? C.orange : C.red;

  return (
    <Animated.View entering={FadeInUp.duration(420)} style={styles.reportCard}>
      <View style={styles.reportHero}>
        <Text style={styles.reportEmoji}>✅</Text>
        <Text selectable style={[styles.reportScore, { color }]}>{score || '--'}</Text>
        <Text selectable style={styles.reportLabel}>Score global</Text>
        <Text selectable style={styles.reportXp}>+100 XP appel terminé</Text>
      </View>

      <View style={styles.reportStats}>
        <ReportStat label="Durée" value={formatDuration(elapsedSeconds)} />
        <ReportStat label="Tours" value={`${learnerTurns}`} />
        <ReportStat label="Phases" value={`${CALL_PHASES.length}/4`} />
      </View>

      <View style={styles.reportSection}>
        <Text selectable style={styles.cardLabel}>Top erreurs récurrentes</Text>
        {(report.recurringErrors.length > 0 ? report.recurringErrors : ['Lei / vouvoiement', 'Question de qualification', 'Phrase plus concise']).map((item) => (
          <Text selectable key={item} style={styles.reportBullet}>• {item}</Text>
        ))}
      </View>

      {report.bestTurns.length > 0 ? (
        <View style={styles.reportSection}>
          <Text selectable style={styles.cardLabel}>Meilleures formulations</Text>
          {report.bestTurns.map((turn) => (
            <View key={turn.id} style={styles.bestTurn}>
              <Text selectable style={styles.bestTurnScore}>{turn.score}/100</Text>
              <Text selectable style={styles.bestTurnText}>{turn.correctedIt}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel="Recommencer un appel" onPress={onRestart} style={styles.restartButton}>
        <Text style={styles.restartText}>Nouvel appel</Text>
      </Pressable>
    </Animated.View>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reportStat}>
      <Text selectable style={styles.reportStatValue}>{value}</Text>
      <Text selectable style={styles.reportStatLabel}>{label}</Text>
    </View>
  );
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function persistReplayAudio(uri: string): Promise<string> {
  if (process.env.EXPO_OS === 'web') return uri;

  const { Directory, File, Paths } = await import('expo-file-system');
  const dir = new Directory(Paths.document, 'italpro-call-replays');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  const source = new File(uri);
  const target = new File(dir, `call-${Date.now()}.m4a`);
  source.copy(target);
  return target.uri;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scrollFlex: { flex: 1 },
  composerBar: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  fixedHeader: {
    backgroundColor: C.bg,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 2,
  },
  scroll: { padding: 16, paddingBottom: 16, gap: 12 },
  kicker: { color: C.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { color: C.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: C.muted, fontSize: 13, lineHeight: 18 },
  modeBadge: { minWidth: 82, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', gap: 1 },
  modeRemote: { backgroundColor: C.blueSoft, borderColor: '#9FE3FF' },
  modeLocal: { backgroundColor: C.primarySoft, borderColor: '#B8E986' },
  modeTitle: { fontSize: 15, fontWeight: '900' },
  modeSub: { color: C.muted, fontSize: 10, fontWeight: '800' },
  scenarioRail: { gap: 10, paddingRight: 20 },
  scenarioCard: { width: 244, minHeight: 132, backgroundColor: C.surface, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, padding: 16, gap: 7 },
  scenarioCardSelected: { borderColor: C.primary, backgroundColor: '#F3FFE8' },
  scenarioTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  scenarioLabel: { color: C.dim, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  scenarioLabelSelected: { color: C.primaryDark },
  diffBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  diffText: { fontSize: 10, fontWeight: '900' },
  scenarioTitle: { color: C.text, fontSize: 16, fontWeight: '900', lineHeight: 20 },
  scenarioGoal: { color: C.muted, fontSize: 12, lineHeight: 17 },
  missionCard: { backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  missionTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  missionIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  missionIconText: { fontSize: 22 },
  cardLabel: { color: C.dim, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  missionTitle: { color: C.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  personaText: { color: C.muted, fontSize: 13, lineHeight: 19 },
  criteriaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  criteriaChip: { overflow: 'hidden', backgroundColor: C.surface2, borderRadius: 999, color: C.text, fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 6 },
  moodCard: { backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10 },
  moodActive: { color: C.orange, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  moodTone: { color: C.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  moodRail: { gap: 8, paddingRight: 12 },
  moodChip: { borderRadius: 999, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 8 },
  moodChipActive: { backgroundColor: C.orangeSoft, borderColor: C.orange },
  moodChipText: { color: C.muted, fontSize: 11, fontWeight: '900' },
  moodChipTextActive: { color: C.orange },
  ringingPanel: { backgroundColor: C.surface, borderRadius: 28, borderWidth: 1, borderColor: C.border, padding: 24, alignItems: 'center', gap: 12 },
  avatarPulse: { width: 118, height: 118, borderRadius: 59, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  ringingLabel: { color: C.dim, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  ringingName: { color: C.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  ringingSub: { color: C.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  answerButton: { marginTop: 8, backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 9 },
  answerButtonPressed: { backgroundColor: C.primaryDark },
  answerText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  callPanel: { backgroundColor: C.surface, borderRadius: 24, borderWidth: 1, borderColor: C.border, padding: 14, gap: 12, minHeight: 420 },
  callPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  callTitle: { color: C.text, fontSize: 18, fontWeight: '900' },
  callMeta: { color: C.primaryDark, fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  callActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  endButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  immersionRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  immersionToggle: { flex: 1, borderRadius: 16, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, paddingVertical: 10, alignItems: 'center' },
  immersionToggleActive: { backgroundColor: C.redSoft, borderColor: C.red },
  immersionText: { color: C.muted, fontSize: 12, fontWeight: '900' },
  immersionTextActive: { color: C.red },
  speedButton: { borderRadius: 14, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 9 },
  speedButtonActive: { backgroundColor: C.blueSoft, borderColor: C.blue },
  speedButtonText: { color: C.muted, fontSize: 11, fontWeight: '900' },
  speedButtonTextActive: { color: C.blue },
  phaseWrap: { flexDirection: 'row', gap: 7 },
  phaseItem: { flex: 1, alignItems: 'center', gap: 5 },
  phaseDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  phaseDotActive: { backgroundColor: C.primary, borderColor: C.primary },
  phaseNumber: { color: C.dim, fontSize: 12, fontWeight: '900' },
  phaseNumberActive: { color: '#FFFFFF' },
  phaseLabel: { color: C.dim, fontSize: 10, fontWeight: '800' },
  phaseLabelActive: { color: C.primaryDark },
  loadingBox: { minHeight: 250, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: C.muted, fontSize: 13, fontWeight: '800' },
  messagesList: { gap: 14 },
  messageBubble: { maxWidth: '85%', borderRadius: 21, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  messageClient: { alignSelf: 'flex-start', backgroundColor: C.surface2 },
  messageLearner: { alignSelf: 'flex-end', backgroundColor: C.primary },
  messageCoach: { alignSelf: 'center', maxWidth: '100%', backgroundColor: C.blueSoft },
  messageTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  messageRoleLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  messageRoleLabelClient: { color: C.dim, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  messageIt: { flexShrink: 1, color: C.text, fontSize: 15, fontWeight: '800', lineHeight: 21 },
  messageLearnerText: { color: '#FFFFFF' },
  messageFrLearner: { color: 'rgba(255,255,255,0.75)' },
  messageHiddenText: { color: C.dim, fontStyle: 'italic' },
  revealButton: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: C.redSoft, paddingHorizontal: 10, paddingVertical: 6 },
  revealText: { color: C.red, fontSize: 11, fontWeight: '900' },
  warnMark: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', opacity: 0.85 },
  messageFr: { color: C.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  messageCoachNote: { color: '#0369A1', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  thinkingBubble: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, backgroundColor: '#F3FFE8', paddingHorizontal: 12, paddingVertical: 10 },
  thinkingText: { color: C.primaryDark, fontSize: 13, fontWeight: '800' },
  modeSwitch: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 18, padding: 4 },
  switchOption: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 10 },
  switchOptionActive: { backgroundColor: C.surface },
  switchText: { color: C.muted, fontSize: 13, fontWeight: '900' },
  switchTextActive: { color: C.primaryDark },
  hintsCard: { backgroundColor: C.blueSoft, borderRadius: 22, padding: 14, gap: 8 },
  hintsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hintsPhaseLabel: { color: C.blue, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  hintsSubLabel: { color: C.blue, fontSize: 11, fontWeight: '700', opacity: 0.75 },
  hintsList: { gap: 8 },
  hintChip: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 2, borderColor: C.border, padding: 12, gap: 5 },
  hintChipSelected: { borderColor: C.blue, backgroundColor: C.blueSoft },
  hintChipPressed: { opacity: 0.82 },
  hintTextSelected: { color: C.blue },
  hintText: { color: C.text, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  cheatCard: { backgroundColor: C.orangeSoft, borderRadius: 22, padding: 14, gap: 10 },
  cheatBadge: { color: C.orange, fontSize: 11, fontWeight: '900' },
  cheatInput: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: '#FFD18C', color: C.text, fontSize: 14, fontWeight: '700', padding: 12 },
  cheatResult: { color: C.text, fontSize: 13, fontWeight: '900', lineHeight: 19 },
  secondaryAction: { flex: 1, alignItems: 'center', borderRadius: 16, backgroundColor: C.surface, paddingVertical: 12 },
  secondaryActionText: { color: C.orange, fontSize: 13, fontWeight: '900' },
  composer: { backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border, padding: 12, gap: 10 },
  input: { minHeight: 88, color: C.text, fontSize: 16, fontWeight: '700', lineHeight: 22, textAlignVertical: 'top' },
  composerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  micButton: { minWidth: 112, height: 48, borderRadius: 24, borderWidth: 2, borderColor: C.red, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 13 },
  micButtonActive: { backgroundColor: C.red, borderColor: C.red },
  micButtonText: { color: C.red, fontSize: 12, fontWeight: '900' },
  micButtonTextActive: { color: '#FFFFFF' },
  sendButton: { flex: 1, alignItems: 'center', borderRadius: 18, backgroundColor: C.primary, paddingVertical: 15 },
  sendButtonDisabled: { backgroundColor: C.border },
  sendText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  reportCard: { backgroundColor: C.surface, borderRadius: 26, borderWidth: 1, borderColor: C.border, padding: 18, gap: 16 },
  reportHero: { alignItems: 'center', gap: 4 },
  reportEmoji: { fontSize: 48 },
  reportScore: { fontSize: 58, fontWeight: '900', fontVariant: ['tabular-nums'] },
  reportLabel: { color: C.muted, fontSize: 14, fontWeight: '800' },
  reportXp: { color: C.primaryDark, fontSize: 15, fontWeight: '900', marginTop: 3 },
  reportStats: { flexDirection: 'row', gap: 8 },
  reportStat: { flex: 1, backgroundColor: C.surface2, borderRadius: 16, padding: 12, alignItems: 'center', gap: 3 },
  reportStatValue: { color: C.text, fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
  reportStatLabel: { color: C.muted, fontSize: 11, fontWeight: '800' },
  reportSection: { gap: 8 },
  reportBullet: { color: C.text, fontSize: 13, fontWeight: '800', lineHeight: 19 },
  bestTurn: { backgroundColor: '#F3FFE8', borderRadius: 16, padding: 12, gap: 4 },
  bestTurnScore: { color: C.primaryDark, fontSize: 12, fontWeight: '900' },
  bestTurnText: { color: C.text, fontSize: 13, fontWeight: '800', lineHeight: 19 },
  restartButton: { backgroundColor: C.primary, borderRadius: 18, alignItems: 'center', paddingVertical: 15 },
  restartText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  errorText: { color: C.red, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  pressed: { opacity: 0.82 },
});
