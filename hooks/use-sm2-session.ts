import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getDueCards,
  insertLearningSession,
  Sm2CardRow,
  updateCardAfterReview,
} from '@/database/italpro-local-db';

/** Quality ratings mapped to user-facing buttons */
export type Sm2Quality = 1 | 2 | 4 | 5;

export type Sm2Session = {
  /** All due cards loaded for this session */
  cards: Sm2CardRow[];
  /** The card currently shown */
  currentCard: Sm2CardRow | null;
  currentIndex: number;
  totalCards: number;
  reviewedCount: number;
  /** Whether the answer side is visible */
  isFlipped: boolean;
  isSessionDone: boolean;
  isLoading: boolean;
  /** Show the answer side */
  flip: () => void;
  /**
   * Rate the current card and advance.
   * 1 = Raté, 2 = Difficile, 4 = Bien, 5 = Facile
   */
  rate: (quality: Sm2Quality) => Promise<void>;
  /** Reload due cards and start a fresh session */
  restartSession: () => Promise<void>;
};

export function useSmTwoSession(): Sm2Session {
  const [cards, setCards] = useState<Sm2CardRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSessionDone, setIsSessionDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sessionStart = useRef(Date.now());
  const reviewedCount = useRef(0);

  const loadCards = useCallback(async () => {
    setIsLoading(true);
    setIsFlipped(false);
    setCurrentIndex(0);
    setIsSessionDone(false);
    reviewedCount.current = 0;
    sessionStart.current = Date.now();

    const due = await getDueCards(20);
    setCards(due);
    setIsLoading(false);
    if (due.length === 0) setIsSessionDone(true);
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const flip = useCallback(() => {
    setIsFlipped(true);
  }, []);

  const rate = useCallback(
    async (quality: Sm2Quality) => {
      const card = cards[currentIndex];
      if (!card) return;

      await updateCardAfterReview(card.id, quality);
      reviewedCount.current += 1;

      const next = currentIndex + 1;
      if (next >= cards.length) {
        const durationSeconds = Math.floor((Date.now() - sessionStart.current) / 1000);
        await insertLearningSession({
          sessionType: 'quiz',
          durationSeconds,
          cardsReviewed: reviewedCount.current,
        });
        setIsSessionDone(true);
      } else {
        setCurrentIndex(next);
        setIsFlipped(false);
      }
    },
    [cards, currentIndex],
  );

  return {
    cards,
    currentCard: cards[currentIndex] ?? null,
    currentIndex,
    totalCards: cards.length,
    reviewedCount: reviewedCount.current,
    isFlipped,
    isSessionDone,
    isLoading,
    flip,
    rate,
    restartSession: loadCards,
  };
}
