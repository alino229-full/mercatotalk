import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useCallback, useRef, useState } from 'react';

export type VoiceRecorderState = 'idle' | 'recording' | 'processing';

export type VoiceRecorderResult = {
  /** URI of the recorded audio file (m4a on iOS/Android) */
  uri: string;
  durationMs: number;
};

export type VoiceRecorder = {
  state: VoiceRecorderState;
  /** Start recording. Requests permission if needed. */
  startRecording: () => Promise<boolean>;
  /** Stop recording and return the file URI + duration. */
  stopRecording: () => Promise<VoiceRecorderResult | null>;
};

/**
 * Minimal voice recorder built on expo-audio.
 *
 * Usage:
 *   const recorder = useVoiceRecorder();
 *   await recorder.startRecording();
 *   const result = await recorder.stopRecording();
 *   // result.uri → send to Groq Whisper
 */
export function useVoiceRecorder(): VoiceRecorder {
  const [state, setState] = useState<VoiceRecorderState>('idle');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // expo-audio's getStatus().durationMillis returns 0 immediately after stop(),
  // so we track elapsed time ourselves for a reliable duration.
  const startedAtMs = useRef<number | null>(null);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return false;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAtMs.current = Date.now();
      setState('recording');
      return true;
    } catch {
      startedAtMs.current = null;
      setState('idle');
      return false;
    }
  }, [recorder]);

  const stopRecording = useCallback(async (): Promise<VoiceRecorderResult | null> => {
    if (state !== 'recording') return null;

    const durationMs = startedAtMs.current ? Date.now() - startedAtMs.current : 0;
    startedAtMs.current = null;
    setState('processing');

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = recorder.uri;
      if (!uri) return null;

      return { uri, durationMs };
    } catch {
      return null;
    } finally {
      setState('idle');
    }
  }, [recorder, state]);

  return { state, startRecording, stopRecording };
}
