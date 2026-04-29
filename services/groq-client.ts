import type { DialogueMessageRow, ScenarioRow } from '@/database/italpro-local-db';
import {
  type DialogueAiTurn,
  hasRemoteDialogueAi,
  requestDialogueAiTurn,
} from '@/services/dialogue-ai-client';

/**
 * Safe Groq access for the mobile app.
 *
 * Groq is called through the Expo API route so GROQ_API_KEY stays server-side.
 * This file keeps the explicit Groq naming without encouraging EXPO_PUBLIC keys.
 */
export function hasGroqProxyAccess(): boolean {
  return hasRemoteDialogueAi();
}

export async function requestGroqDialogueTurn(input: {
  scenario: ScenarioRow;
  learnerReply: string;
  history: DialogueMessageRow[];
}): Promise<DialogueAiTurn | null> {
  return requestDialogueAiTurn(input);
}
