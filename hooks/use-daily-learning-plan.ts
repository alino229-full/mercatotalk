import { useCallback, useEffect, useRef, useState } from 'react';

import { getSm2Stats, getStreak, getTodayStats } from '@/database/italpro-local-db';

export type DailyStats = {
  streak: number;
  minutesToday: number;
  dueCards: number;
  totalCards: number;
  masteredCards: number;
  isLoading: boolean;
  reload: () => void;
};

/**
 * Reads real learning stats from the local SQLite database.
 * SQLite reads complete in milliseconds, so we render with default values (0)
 * immediately and update in the background. No spinner needed for the happy path.
 * `isLoading` stays true only until the very first read resolves, so consumers
 * that absolutely need the loaded flag can still react to it.
 */
export function useDailyStats(): DailyStats {
  const mountedRef = useRef(false);
  const [streak, setStreak] = useState(0);
  const [minutesToday, setMinutesToday] = useState(0);
  const [dueCards, setDueCards] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [masteredCards, setMasteredCards] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const [streakVal, todayStats, sm2Stats] = await Promise.all([
      getStreak(),
      getTodayStats(),
      getSm2Stats(),
    ]);
    if (!mountedRef.current) return;
    setStreak(streakVal);
    setMinutesToday(todayStats.minutesToday);
    setDueCards(sm2Stats.dueCount);
    setTotalCards(sm2Stats.totalCards);
    setMasteredCards(sm2Stats.masteredCount);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  return { streak, minutesToday, dueCards, totalCards, masteredCards, isLoading, reload: load };
}

export const useDailyLearningPlan = useDailyStats;
