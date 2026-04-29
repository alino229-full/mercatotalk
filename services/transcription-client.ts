import { File } from 'expo-file-system';

import { transcribeAudioWithGroq } from '@/services/speech-ai-client';

export type TranscriptionInput = {
  uri: string;
  /** Optional: hint to Whisper about the language ('it', 'fr', etc.) */
  language?: string;
  /** Optional: help Whisper with domain vocabulary */
  prompt?: string;
};

export type TranscriptionOutput = {
  text: string;
  language?: string;
  durationSeconds?: number;
};

/**
 * Transcribe a local audio URI with Groq Whisper via the proxy API route.
 *
 * On native, the URI points to a local m4a/wav file produced by expo-audio.
 * Returns null if transcription is unavailable (no proxy configured).
 */
export async function transcribeLocalAudio(
  input: TranscriptionInput,
): Promise<TranscriptionOutput | null> {
  try {
    const result = await transcribeAudioWithGroq({
      file: {
        uri: input.uri,
        name: 'voice-recording.m4a',
        mimeType: 'audio/m4a',
      },
      language: input.language ?? 'it',
      prompt: input.prompt ?? 'Conversation commerciale en italien formel avec vouvoiement Lei.',
    });

    return {
      text: result.text,
      language: result.language,
      durationSeconds: result.duration,
    };
  } catch {
    return null;
  } finally {
    try {
      const audioFile = new File(input.uri);
      if (audioFile.exists) {
        audioFile.delete();
      }
    } catch {
      // Best effort cleanup: transcription must not fail because cache deletion failed.
    }
  }
}
