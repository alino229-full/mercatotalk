import { useCallback, useMemo } from 'react';

import { speakIt, stopIt, type SpeakOptions } from '@/services/italian-tts';

export function useItalianTTS() {
  const speak = useCallback((text: string, options?: SpeakOptions) => {
    void speakIt(text, options);
  }, []);

  const stop = useCallback(() => {
    stopIt();
  }, []);

  return useMemo(() => ({ speak, stop }), [speak, stop]);
}
