import { useCallback, useEffect, useMemo, useState } from 'react';

import { achievements, type Achievement } from '@/data/achievements';
import {
  addXp,
  getSm2Stats,
  getStreak,
  getUnlockedAchievements,
  getXpProfile,
  unlockAchievement,
  type XpProfileRow,
} from '@/database/italpro-local-db';
import { successFeedback } from '@/services/haptics';

export type XpState = {
  profile: XpProfileRow | null;
  unlocked: Achievement[];
  unlockedIds: Set<string>;
  isLoading: boolean;
  reload: () => Promise<void>;
  awardXp: (amount: number, achievementIds?: string[]) => Promise<XpProfileRow | null>;
  checkPassiveAchievements: () => Promise<void>;
};

export function useXp(): XpState {
  const [profile, setProfile] = useState<XpProfileRow | null>(null);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    const [xpProfile, rows] = await Promise.all([getXpProfile(), getUnlockedAchievements()]);
    setProfile(xpProfile);
    setUnlockedIds(new Set(rows.map((row) => row.achievementId)));
    setIsLoading(false);
  }, []);

  const awardXp = useCallback(
    async (amount: number, achievementIds: string[] = []) => {
      const nextProfile = await addXp(amount).catch(() => null);
      if (!nextProfile) return null;

      for (const achievementId of achievementIds) {
        const isNew = await unlockAchievement(achievementId).catch(() => false);
        if (isNew) await successFeedback();
      }

      if (nextProfile.level >= 3) await unlockAchievement('level_3').catch(() => false);
      if (nextProfile.level >= 5) await unlockAchievement('level_5').catch(() => false);

      await reload();
      return nextProfile;
    },
    [reload],
  );

  const checkPassiveAchievements = useCallback(async () => {
    const [streak, stats] = await Promise.all([getStreak(), getSm2Stats()]);
    if (streak >= 3) await unlockAchievement('daily_streak_3').catch(() => false);
    if (streak >= 7) await unlockAchievement('daily_streak_7').catch(() => false);
    if (stats.totalCards >= 100) await unlockAchievement('hundred_words').catch(() => false);
    await reload();
  }, [reload]);

  useEffect(() => {
    reload().then(checkPassiveAchievements).catch(() => setIsLoading(false));
  }, [checkPassiveAchievements, reload]);

  const unlocked = useMemo(
    () => achievements.filter((achievement) => unlockedIds.has(achievement.id)),
    [unlockedIds],
  );

  return {
    profile,
    unlocked,
    unlockedIds,
    isLoading,
    reload,
    awardXp,
    checkPassiveAchievements,
  };
}
