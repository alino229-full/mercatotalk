import { createAudioPlayer, preload, type AudioPlayer, type AudioSource } from 'expo-audio';

export type QuizSound =
  | 'tap'
  | 'correct'
  | 'wrong'
  | 'complete'
  | 'bravo';

const SOUND_SOURCES: Record<QuizSound, AudioSource> = {
  tap: require('@/assets/sounds/quiz-tap.wav'),
  correct: require('@/assets/sounds/quiz-correct.wav'),
  wrong: require('@/assets/sounds/quiz-wrong.wav'),
  complete: require('@/assets/sounds/quiz-complete.wav'),
  bravo: require('@/assets/sounds/quiz-bravo.wav'),
};

const SOUND_VOLUMES: Record<QuizSound, number> = {
  tap: 0.25,
  correct: 0.32,
  wrong: 0.28,
  complete: 0.36,
  bravo: 0.42,
};

const activePlayers = new Set<AudioPlayer>();

function releasePlayer(player: AudioPlayer): void {
  if (!activePlayers.has(player)) return;
  activePlayers.delete(player);
  try {
    player.remove();
  } catch {}
}

function playWhenReady(player: AudioPlayer): void {
  const startedAt = Date.now();
  const intervalId = setInterval(() => {
    if (!activePlayers.has(player)) {
      clearInterval(intervalId);
      return;
    }
    if (player.isLoaded || Date.now() - startedAt > 1_000) {
      try {
        player.play();
      } catch {}
      clearInterval(intervalId);
    }
  }, 25);
}

export function playQuizSound(sound: QuizSound): void {
  try {
    const player = createAudioPlayer(SOUND_SOURCES[sound]);
    player.volume = SOUND_VOLUMES[sound];
    activePlayers.add(player);
    playWhenReady(player);
    setTimeout(() => releasePlayer(player), sound === 'bravo' ? 3_000 : 1_600);
  } catch {}
}

export function preloadQuizSounds(): void {
  for (const source of Object.values(SOUND_SOURCES)) {
    Promise.resolve(preload(source)).catch(() => null);
  }
}
