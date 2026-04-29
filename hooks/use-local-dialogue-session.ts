import { useCallback, useEffect, useState } from 'react';

import {
  type CorrectionRow,
  type DialogueMessageRow,
  addFocusCardsFromCorrection,
  ensureConversationStarted,
  getCorrectionsForScenario,
  getLatestCorrection,
  getMessages,
  getScenarioById,
  getScenarios,
  insertCorrection,
  insertMessage,
  resetConversation,
  type ScenarioRow,
} from '@/database/italpro-local-db';
import { requestDialogueAiTurn } from '@/services/dialogue-ai-client';
import { buildLocalClientReply, buildLocalCorrection } from '@/services/local-dialogue-engine';
import { useCallSessionStore } from '@/stores/call-session-store';

export type LocalDialogueSession = {
  scenarios: ScenarioRow[];
  activeScenario: ScenarioRow | null;
  messages: DialogueMessageRow[];
  latestCorrection: CorrectionRow | null;
  corrections: CorrectionRow[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  activeScenarioId: string;
  setActiveScenarioId: (scenarioId: string) => void;
  sendLearnerReply: (reply: string) => Promise<void>;
  resetActiveConversation: () => Promise<void>;
  refresh: () => Promise<void>;
};

/**
 * Loads and mutates the local SQLite dialogue session.
 *
 * The hook keeps the call simulator offline-first: every turn, correction and
 * generated client reply is stored on-device before the UI refreshes.
 */
export function useLocalDialogueSession(): LocalDialogueSession {
  const activeScenarioId = useCallSessionStore((state) => state.activeScenarioId);
  const mood = useCallSessionStore((state) => state.mood);
  const setActiveScenarioId = useCallSessionStore((state) => state.setActiveScenarioId);
  const isSending = useCallSessionStore((state) => state.isSending);
  const setIsSending = useCallSessionStore((state) => state.setIsSending);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [activeScenario, setActiveScenario] = useState<ScenarioRow | null>(null);
  const [messages, setMessages] = useState<DialogueMessageRow[]>([]);
  const [latestCorrection, setLatestCorrection] = useState<CorrectionRow | null>(null);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedScenarios = await getScenarios();
      const scenario = await getScenarioById(activeScenarioId);

      if (!scenario) {
        throw new Error('Scenario local introuvable.');
      }

      await ensureConversationStarted(scenario);
      setScenarios(loadedScenarios);
      setActiveScenario(scenario);
      setMessages(await getMessages(scenario.id));
      setLatestCorrection(await getLatestCorrection(scenario.id));
      setCorrections(await getCorrectionsForScenario(scenario.id));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Erreur locale inconnue.');
    } finally {
      setIsLoading(false);
    }
  }, [activeScenarioId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sendLearnerReply = useCallback(
    async (reply: string) => {
      const cleanReply = reply.trim();

      if (!activeScenario || cleanReply.length === 0 || isSending) {
        return;
      }

      setIsSending(true);
      setError(null);

      try {
        const currentMessages = await getMessages(activeScenario.id);
        const learnerMessage = await insertMessage({
          scenarioId: activeScenario.id,
          role: 'learner',
          contentIt: cleanReply,
          contentFr: 'Reponse apprenant a corriger.',
        });
        const remoteTurn = await requestDialogueAiTurn({
          scenario: activeScenario,
          learnerReply: cleanReply,
          history: currentMessages,
          mood,
        }).catch(() => null);
        const correction = remoteTurn?.correction ?? buildLocalCorrection(cleanReply);
        const correctionRow = await insertCorrection({
          messageId: learnerMessage.id,
          scenarioId: activeScenario.id,
          score: correction.score,
          correctedIt: correction.correctedIt,
          feedbackFr: correction.feedbackFr,
          nextFocus: correction.nextFocus,
        });
        await addFocusCardsFromCorrection(correctionRow).catch(() => null);
        const clientReply =
          remoteTurn?.clientReply ??
          buildLocalClientReply({
            scenario: activeScenario,
            learnerReply: cleanReply,
            history: currentMessages,
            mood,
          });
        await insertMessage({
          scenarioId: activeScenario.id,
          role: 'client',
          contentIt: clientReply.contentIt,
          contentFr: clientReply.contentFr,
          coachingNote: clientReply.coachingNote,
        });
        setMessages(await getMessages(activeScenario.id));
        setLatestCorrection(await getLatestCorrection(activeScenario.id));
        setCorrections(await getCorrectionsForScenario(activeScenario.id));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Impossible d enregistrer ce tour.');
      } finally {
        setIsSending(false);
      }
    },
    [activeScenario, isSending, mood, setIsSending],
  );

  const resetActiveConversation = useCallback(async () => {
    if (!activeScenario) {
      return;
    }

    await resetConversation(activeScenario.id);
    await refresh();
  }, [activeScenario, refresh]);

  return {
    scenarios,
    activeScenario,
    messages,
    latestCorrection,
    corrections,
    isLoading,
    isSending,
    error,
    activeScenarioId,
    setActiveScenarioId,
    sendLearnerReply,
    resetActiveConversation,
    refresh,
  };
}
