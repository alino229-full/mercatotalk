import { create } from 'zustand';

import type { B2BMood } from '@/data/b2b-operational';

type CallSessionState = {
  activeScenarioId: string;
  mood: B2BMood;
  isSending: boolean;
  setActiveScenarioId: (scenarioId: string) => void;
  setMood: (mood: B2BMood) => void;
  setIsSending: (isSending: boolean) => void;
};

export const useCallSessionStore = create<CallSessionState>((set) => ({
  activeScenarioId: 'container-20-habitable',
  mood: 'mefiant',
  isSending: false,
  setActiveScenarioId: (scenarioId) => set({ activeScenarioId: scenarioId }),
  setMood: (mood) => set({ mood }),
  setIsSending: (isSending) => set({ isSending }),
}));
