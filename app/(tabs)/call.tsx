import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
  getLearningSessionCountByType,
  insertLearningSession,
  saveCallReplay,
  unlockAchievement,
  type CorrectionRow,
  type DialogueMessageRow,
  type ScenarioRow,
} from '@/database/italpro-local-db';
import { useLocalDialogueSession } from '@/hooks/use-local-dialogue-session';
import { useItalianTTS } from '@/hooks/use-italian-tts';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { successFeedback, tapFeedback } from '@/services/haptics';
import { requestGuidedReplyChoices, type GuidedReplyChoice } from '@/services/guided-choices-ai-client';
import type { GuidedChoiceQuality } from '@/services/local-dialogue-engine';
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

const CALL_PHASES = ['Accroche', 'Qualification', 'Objection', 'Closing'] as const;

// ─── Context-aware hint system ────────────────────────────────────────────────
// Each HintSet has 1 best response, 1 approximation, 2 wrong distractors.
// The 4 options are shuffled before display so the learner must understand
// the client's actual question to pick the right response.

type HintSet = { best: string; approx: string; wrong: [string, string] };

const HINT_SETS: Record<string, HintSet> = {
  identification: {
    best: 'Buongiorno, sono Pierre di MercatoTalk. Ci occupiamo di soluzioni container modulari per il settore edile e logistico.',
    approx: 'Sono un commerciale. Le volevo presentare la nostra offerta.',
    wrong: ['La consegna è prevista entro 48 ore dalla conferma dell\'ordine.', 'Posso offrire uno sconto del 5% per ordini multipli.'],
  },
  cold_open: {
    best: 'Buongiorno, sono Pierre di MercatoTalk. Le disturbo un momento? Volevamo presentarLe le nostre soluzioni container.',
    approx: 'Pronto. Chiamo da MercatoTalk per presentarLe la nostra gamma.',
    wrong: ['Il pagamento è a 30 giorni dalla data di fattura.', 'Abbiamo la certificazione IICL su tutti i container.'],
  },
  price: {
    best: 'Per un 20 piedi standard siamo intorno ai 2.500 euro. Il prezzo include il trasporto. Posso inviarLe un preventivo personalizzato oggi stesso?',
    approx: 'Il prezzo dipende dal modello e dalle opzioni scelte. È molto competitivo.',
    wrong: ['La consegna avviene entro 48 ore se il prodotto è in stock.', 'Abbiamo oltre 200 clienti soddisfatti in Italia.'],
  },
  delivery: {
    best: 'Se il container è in stock, la consegna è entro 48 ore. Quando ne avrebbe bisogno esattamente e qual è la Sua zona?',
    approx: 'I tempi di consegna variano in base alla disponibilità e alla distanza.',
    wrong: ['Il prezzo base è di 2.100 euro per un 20 piedi usato grade A.', 'Le garanzie coprono 12 mesi dall\'installazione.'],
  },
  quality: {
    best: 'I nostri container sono certificati IICL e forniti con rapporto di ispezione fotografico. Posso inviarLe la documentazione tecnica?',
    approx: 'La qualità è garantita. Tutti i container vengono ispezionati prima della consegna.',
    wrong: ['Il prezzo include il trasporto fino a 200 km.', 'La consegna avviene entro 48 ore in tutta Italia.'],
  },
  comfort_trust: {
    best: 'Capisco il Suo dubbio. I moduli da 20 piedi sono isolati, ventilati e collaudati prima della consegna. Posso inviarLe foto reali, scheda tecnica e referenze clienti?',
    approx: 'Sì, possono essere comodi e affidabili se sono ben isolati e controllati. Le mando la documentazione tecnica.',
    wrong: ['Il pagamento si effettua con acconto del 30% e saldo alla consegna.', 'Il container da 40 piedi costa di più ma offre più spazio interno.'],
  },
  winter_comfort: {
    best: 'Sì, resta caldo se l’isolamento è dimensionato correttamente. Le mando la scheda tecnica dei materiali, foto di moduli già installati e, se vuole, organizziamo una visita o videochiamata.',
    approx: 'Sì, con un buon isolamento il container può restare confortevole anche in inverno. Le invio qualche foto reale.',
    wrong: ['Possiamo consegnarlo in 48 ore se il trasportatore è disponibile.', 'Il colore RAL può essere verde, grigio o bianco secondo il Suo gusto.'],
  },
  availability: {
    best: 'Sì, abbiamo unità disponibili in stock. Quale dimensione cerca — 20 o 40 piedi — e per quale utilizzo?',
    approx: 'Dipende dal modello. Può dirmi di cosa ha bisogno esattamente?',
    wrong: ['Il pagamento si effettua a 30 giorni dalla data di fattura.', 'Offriamo uno sconto del 5% per pagamento anticipato.'],
  },
  competitor: {
    best: 'Capisco che stia confrontando le offerte. Cosa è prioritario per Lei: il prezzo, la qualità o la rapidità di consegna?',
    approx: 'Siamo competitivi. Posso mostrarLe i nostri punti di forza rispetto al mercato.',
    wrong: ['La certificazione ATP è inclusa nel prezzo del container frigorifero.', 'L\'installazione avviene su plots réglables o su base in cemento.'],
  },
  trust: {
    best: 'Comprendo la Sua cautela. Siamo operativi dal 2009. Posso fornirLe il nostro numero SIRET, referenze clienti e organizzare un\'ispezione prima di qualsiasi pagamento.',
    approx: 'Siamo un\'azienda seria con garanzie contrattuali su ogni ordine.',
    wrong: ['Il prezzo per un 40 piedi nuovo è di 6.200 euro.', 'La consegna in tutta Italia avviene in 48-72 ore.'],
  },
  discount: {
    best: 'Possiamo valutare uno sconto del 5% per pagamento anticipato o per ordini da 2 unità o più. Cosa si adatta meglio alla Sua situazione?',
    approx: 'La nostra offerta è già molto vantaggiosa. Vediamo cosa possiamo fare.',
    wrong: ['La consegna è inclusa per distanze fino a 200 km.', 'Il container è certificato IICL con rapporto di ispezione.'],
  },
  regulation: {
    best: 'Per un\'installazione temporanea fino a 3 anni basta la CILA asseverata; oltre i 3 anni serve il permesso di costruire. Si tratta di un uso temporaneo o permanente?',
    approx: 'Dipende dall\'uso e dalla durata. Le invio una scheda riepilogativa sulle normative italiane.',
    wrong: ['Il sistema di filtraggio ha una portata di 8 m³/h.', 'Il container frigorifero funziona con un attacco da 32 ampere.'],
  },
  installation: {
    best: 'L\'installazione avviene su plots réglables in acciaio zincato o su una soletta in cemento da 15 cm. I raccordi elettrici e idrici sono a cura del cliente. Vuole un preventivo chiavi in mano?',
    approx: 'Forniamo tutta la documentazione tecnica. Il posizionamento richiede 2-3 ore.',
    wrong: ['Il prezzo per un 20 piedi usato grade A è di 2.100 euro.', 'Offriamo uno sconto del 5% per ordini multipli.'],
  },
  technical: {
    best: 'Le invio la scheda tecnica completa. Per il 20 piedi: 5,90 x 2,35 x 2,39 m interni, carico utile 28 t. Quale modello La interessa di più?',
    approx: 'Dipende dal modello. Abbiamo 20 e 40 piedi con varie configurazioni. Quale si adatta al Suo uso?',
    wrong: ['Il preventivo è valido per 30 giorni dalla data di emissione.', 'Offriamo il pagamento a 30% all\'ordine e 70% alla consegna.'],
  },
  mobile: {
    best: 'Sì, abbiamo container su rimorchio omologato: il 20 piedi pesa meno di 3,5 t, quindi basta la patente B. Il dispiegamento richiede circa 30 minuti. Vuole sapere di più sull\'allestimento?',
    approx: 'Abbiamo soluzioni mobili su rimorchio. Dipende dal peso e dall\'uso previsto.',
    wrong: ['Il container frigorifero mantiene la temperatura tra -25°C e +10°C.', 'La CILA asseverata è sufficiente per installazioni fino a 3 anni.'],
  },
  objection_price: {
    best: 'Capisco. Il prezzo include garanzia, inspection e trasporto. Possiamo però scaglionare il pagamento in due rate. Cosa sarebbe più utile per Lei?',
    approx: 'È un investimento che si ammortizza rapidamente. Posso mostrarLe il calcolo.',
    wrong: ['La consegna è inclusa per distanze fino a 200 km.', 'Siamo certificati ISO 9001 per tutti i processi produttivi.'],
  },
  closing: {
    best: 'Ottimo! Posso inviarLe il contratto e il preventivo definitivo oggi stesso. Ha un indirizzo email a cui mandarli?',
    approx: 'Perfetto. Quando potremmo procedere alla firma? Le mando tutto per email.',
    wrong: ['La nostra azienda è specializzata nei settori edile e logistico dal 2009.', 'Offriamo anche container refrigerati e container piscina su misura.'],
  },
  generic: {
    best: 'Ho capito la Sua richiesta. Posso spiegarLe meglio il prodotto e le condizioni di fornitura. Cosa vuole sapere esattamente?',
    approx: 'Certo, Le rispondo subito. Può darmi qualche dettaglio in più?',
    wrong: ['Il container è disponibile nei colori verde, grigio o bianco RAL.', 'Abbiamo punti di consegna in tutta Italia con tempi ridotti.'],
  },
};

// Fallback par phase quand il n'y a pas encore de message client
const PHASE_INTRO_HINTS: Record<typeof CALL_PHASES[number], HintSet> = {
  Accroche: {
    best: 'Buongiorno, sono Pierre di MercatoTalk. Le disturbo un momento? Volevamo presentarLe le nostre soluzioni modulari.',
    approx: 'Pronto, sono Pierre. Chiamo da MercatoTalk per un\'offerta.',
    wrong: ['La consegna è prevista entro 48 ore.', 'Il prezzo base è di 2.100 euro per un container usato.'],
  },
  Qualification: {
    best: 'Cosa cerca esattamente per il Suo progetto? E\' Lei il responsabile degli acquisti?',
    approx: 'Di cosa ha bisogno? Abbiamo diverse soluzioni container.',
    wrong: ['Offriamo uno sconto del 5% per pagamento anticipato.', 'La certificazione IICL è inclusa su tutti i prodotti.'],
  },
  Objection: {
    best: 'Capisco la Sua preoccupazione. Posso spiegarLe perché il nostro prezzo è giustificato rispetto alla qualità offerta?',
    approx: 'Possiamo trovare una soluzione che si adatta al Suo budget.',
    wrong: ['La consegna avviene entro 48 ore in tutta Italia.', 'Abbiamo clienti soddisfatti da Nord a Sud.'],
  },
  Closing: {
    best: 'Posso inviarLe il preventivo definitivo oggi stesso. Ha un indirizzo email?',
    approx: 'Quando possiamo procedere? Le mando tutto per email.',
    wrong: ['Il container è disponibile in verde, grigio o bianco.', 'Siamo operativi dal 2009 con oltre 200 clienti in Italia.'],
  },
};

function classifyClientMessage(contentIt: string, contentFr: string): string {
  const t = (contentIt + ' ' + contentFr).toLowerCase();

  if (/chi (è|sei|parla)|non (la|ti) conosco|chi siete|che azienda/.test(t)) return 'identification';
  if (/pronto\?|chi è\?|cosa vuole|non (la|ti) (conosco|conosc)/.test(t)) return 'cold_open';
  if (/(inverno|freddo|caldo|resta caldo|riscald|bello solo in foto|sembra bello solo in foto|hiver|chaud|froid)/.test(t)) return 'winter_comfort';
  if (/(comod|confort|confortable|comfortable).*(affidabil|fiable|fiducia|garanzi)|(?:affidabil|fiable|fiducia|garanzi).*(comod|confort|confortable|comfortable)/.test(t)) return 'comfort_trust';
  if (/truffat|arnaque|truffe|garanzie serie|fidarsi|sicuro che non|come faccio a sapere|affidabil|fiable/.test(t)) return 'trust';
  if (/(quanto|costo|prezzo|budget|spend|cher|prix|coût|euro|cost)/.test(t)) {
    if (/(trop.*cher|troppo.*car|non posso|eccede|non ho|beyond|dépasse)/.test(t)) return 'objection_price';
    return 'price';
  }
  if (/(sconto|remise|riduzion|rabais|abbass|réduct|discount)/.test(t)) return 'discount';
  if (/(consegna|quando.*arriv|livraison|tempi|délai|quando.*avr|entro quando)/.test(t)) return 'delivery';
  if (/(certif|garanzi|qualit|norme|haccp|atp|iicl|standard|conform)/.test(t)) return 'quality';
  if (/(disponibil|avete|stock|l\'avete|ce l\'avez|en stock)/.test(t)) return 'availability';
  if (/(concorrent|altro.*fornitore|confronto|concurrent|altri prezzi|compare)/.test(t)) return 'competitor';
  if (/(permesso|autorizzazione|cila|permis|bureaucrazia|réglementation|costruire)/.test(t)) return 'regulation';
  if (/(installaz|fondament|raccordo|installation|fondation|montage|pose)/.test(t)) return 'installation';
  if (/(filtraz|corrente|pompa|kw|tecnico|scheda tecnica|specifiche|technique|dimension)/.test(t)) return 'technical';
  if (/(rimorchio|remorque|mobile|itinerant|spostare|deplacer|patente|permis.*conduire)/.test(t)) return 'mobile';
  if (/(d'accordo|capito|bene.*proceed|andiamo avanti|procediamo|firmar|accord|décider)/.test(t)) return 'closing';
  return 'generic';
}

function buildHintOptions(set: HintSet, type: string): GuidedReplyChoice[] {
  const options: GuidedReplyChoice[] = [
    { id: `${type}-best`, text: set.best, quality: 'best' },
    { id: `${type}-approx`, text: set.approx, quality: 'approx' },
    { id: `${type}-wrong-1`, text: set.wrong[0], quality: 'wrong' },
    { id: `${type}-wrong-2`, text: set.wrong[1], quality: 'wrong' },
  ];
  // Fisher-Yates shuffle (stable per render via useMemo dependency)
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = options[i]!;
    options[i] = options[j]!;
    options[j] = tmp;
  }
  return options;
}

function getContextualHints(
  latestClientMsg: { contentIt: string; contentFr: string } | undefined,
  phaseIndex: number,
): GuidedReplyChoice[] {
  if (!latestClientMsg) {
    const phase = CALL_PHASES[phaseIndex];
    return buildHintOptions(PHASE_INTRO_HINTS[phase], `phase-${phase}`);
  }
  const type = classifyClientMessage(latestClientMsg.contentIt, latestClientMsg.contentFr);
  const set = HINT_SETS[type] ?? HINT_SETS['generic']!;
  return buildHintOptions(set, type);
}

const SCENARIO_DIFFICULTY: Record<string, 'Facile' | 'Moyen' | 'Difficile'> = {
  'container-20-habitable': 'Facile',
  'confirmation-commande': 'Facile',
  'container-stockage-standard': 'Facile',
  'renouvellement-contrat': 'Moyen',
  'relance-devis-b2b': 'Moyen',
  'salon-btp': 'Moyen',
  'secteur-pharma': 'Moyen',
  'relance-email-cold': 'Moyen',
  'piscine-container': 'Moyen',
  'habitable-autorisation': 'Moyen',
  'frigo-restauration': 'Moyen',
  'remorque-mobile': 'Moyen',
  'prospection-froide': 'Difficile',
  'objection-budget': 'Difficile',
  'client-mecontent': 'Difficile',
  'distributeur-italie': 'Difficile',
  'client-arnaque': 'Difficile',
};

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

  const {
    scenarios,
    activeScenario,
    messages,
    corrections,
    isLoading,
    isSending,
    error,
    activeScenarioId,
    setActiveScenarioId,
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
      setAiGuidedHints(null);
      setIsLoadingGuidedHints(false);
      return;
    }

    let cancelled = false;
    setAiGuidedHints(null);
    setIsLoadingGuidedHints(true);

    requestGuidedReplyChoices({
      scenario: activeScenario,
      latestClientMessage,
      history: messages,
      mood,
    })
      .then((choices) => {
        if (!cancelled) setAiGuidedHints(choices);
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
      setRecordingSeconds(0);
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
      tts.speak(latestClientMessage.contentIt, { pitch: 1, rate: 0.86 * clientSpeed });
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

  const answerCall = useCallback(async () => {
    await tapFeedback();
    callStartedAt.current = Date.now();
    setElapsedSeconds(0);
    setCallStatus('active');
    setXpAwarded(false);
    if (latestClientMessage) {
      lastSpokenClientMessageId.current = latestClientMessage.id;
      tts.speak(latestClientMessage.contentIt, { pitch: 1, rate: 0.86 * clientSpeed });
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

  const handleScenarioChange = useCallback(
    (scenarioId: string) => {
      setActiveScenarioId(scenarioId);
      callStartedAt.current = null;
      setElapsedSeconds(0);
      setDraft('');
      setSelectedGuidedHint(null);
      setAiGuidedHints(null);
      setCallStatus('ringing');
      setXpAwarded(false);
      setRevealedMessageIds(new Set());
      lastSpokenClientMessageId.current = null;
    },
    [setActiveScenarioId],
  );

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
    tts.speak(latestClientMessage.contentIt, { pitch: 1, rate: 0.86 * clientSpeed });
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

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} style={styles.root}>
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

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
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
              onUse={insertHint}
            />

            {callMode === 'guided' ? (
              <View style={styles.hintsCard}>
                <View style={styles.hintsHeader}>
                  <Text selectable style={styles.cardLabel}>Que répondre ?</Text>
                  <Text selectable style={styles.hintsPhaseLabel}>{CALL_PHASES[phaseIndex]}</Text>
                </View>
                <Text selectable style={styles.hintsSubLabel}>
                  {isLoadingGuidedHints
                    ? 'L’IA prépare 4 réponses cohérentes…'
                    : isUsingAiGuidedHints
                      ? 'IA · 1 bonne réponse · 1 approximation · 2 pièges'
                      : 'Secours local · 1 bonne réponse · 1 approximation · 2 pièges'}
                </Text>
                <View style={styles.hintsList}>
                  {guidedHints.map((hint) => (
                    <Pressable
                      key={hint.id}
                      accessibilityRole="button"
                      accessibilityLabel="Utiliser cette réponse"
                      onPress={() => insertHint(hint.text, hint.quality, hint.id)}
                      style={({ pressed }) => [styles.hintChip, pressed && styles.hintChipPressed]}>
                      <Text selectable style={styles.hintText}>{hint.text}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

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
          </>
        )}

        {error || voiceError ? <Text selectable style={styles.errorText}>{error ?? voiceError}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function buildCallReport(corrections: CorrectionRow[]) {
  const averageScore =
    corrections.length > 0
      ? Math.round(corrections.reduce((sum, correction) => sum + correction.score, 0) / corrections.length)
      : null;
  const focusCounts = new Map<string, number>();

  for (const correction of corrections) {
    for (const focus of correction.nextFocus) {
      focusCounts.set(focus, (focusCounts.get(focus) ?? 0) + 1);
    }
  }

  return {
    averageScore,
    recurringErrors: [...focusCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label]) => label),
    bestTurns: corrections
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 3),
  };
}

function ScenarioCard({ scenario, selected, onPress }: { scenario: ScenarioRow; selected: boolean; onPress: () => void }) {
  const diff = SCENARIO_DIFFICULTY[scenario.id] ?? 'Moyen';
  const diffColor = diff === 'Facile' ? C.primary : diff === 'Moyen' ? C.orange : C.red;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Choisir le scénario ${scenario.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.scenarioCard, selected && styles.scenarioCardSelected, pressed && styles.pressed]}>
      <View style={styles.scenarioTop}>
        <Text selectable style={[styles.scenarioLabel, selected && styles.scenarioLabelSelected]}>Scenario</Text>
        <View style={[styles.diffBadge, { backgroundColor: diffColor + '22', borderColor: diffColor + '55' }]}>
          <Text style={[styles.diffText, { color: diffColor }]}>{diff}</Text>
        </View>
      </View>
      <Text selectable style={styles.scenarioTitle} numberOfLines={2}>{scenario.title}</Text>
      <Text selectable style={styles.scenarioGoal} numberOfLines={2}>{scenario.clientGoal}</Text>
    </Pressable>
  );
}

function MissionCard({ scenario }: { scenario: ScenarioRow }) {
  return (
    <View style={styles.missionCard}>
      <View style={styles.missionTop}>
        <View style={styles.missionIcon}><Text style={styles.missionIconText}>📞</Text></View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text selectable style={styles.cardLabel}>Mission</Text>
          <Text selectable style={styles.missionTitle}>{scenario.clientGoal}</Text>
        </View>
      </View>
      <Text selectable style={styles.personaText} numberOfLines={3}>{scenario.clientPersona}</Text>
      <View style={styles.criteriaWrap}>
        {scenario.successCriteria.map((criterion) => (
          <Text key={criterion} selectable style={styles.criteriaChip}>{criterion}</Text>
        ))}
      </View>
    </View>
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
  fixedHeader: {
    backgroundColor: C.bg,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 2,
  },
  scroll: { padding: 16, paddingBottom: 36, gap: 12 },
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
  hintChip: { backgroundColor: C.surface, borderRadius: 16, padding: 12, gap: 5 },
  hintChipPressed: { opacity: 0.82 },
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
