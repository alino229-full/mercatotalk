import { useCallback, useMemo } from 'react';

import { speakIt, stopIt, type SpeakOptions } from '@/services/italian-tts';

export function useItalianTTS() {
  const speak = useCallback((text: string, options?: SpeakOptions) => {
    speakIt(text, options).catch((error) => {
      console.warn('[use-italian-tts] speak failed', error);
    });
  }, []);

  const stop = useCallback(() => {
    stopIt();
  }, []);

  return useMemo(() => ({ speak, stop }), [speak, stop]);
}
