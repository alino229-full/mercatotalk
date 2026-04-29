export type AchievementId =
  | 'first_quiz'
  | 'perfect_quiz'
  | 'first_call'
  | 'five_calls'
  | 'first_lesson'
  | 'ten_lessons'
  | 'level_3'
  | 'level_5'
  | 'hundred_words'
  | 'daily_streak_3'
  | 'daily_streak_7';

export type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
  accent: string;
};

export const achievements: Achievement[] = [
  {
    id: 'first_quiz',
    title: 'Premier quiz',
    description: 'Terminer une série de quiz.',
    icon: '🎯',
    accent: '#58CC02',
  },
  {
    id: 'perfect_quiz',
    title: 'Sans faute',
    description: 'Obtenir 100% sur une série.',
    icon: '🏆',
    accent: '#FF9600',
  },
  {
    id: 'first_call',
    title: 'Premier appel',
    description: 'Finir une simulation commerciale.',
    icon: '📞',
    accent: '#1CB0F6',
  },
  {
    id: 'five_calls',
    title: 'Commercial actif',
    description: 'Terminer 5 appels clients.',
    icon: '💼',
    accent: '#1CB0F6',
  },
  {
    id: 'first_lesson',
    title: 'Leçon validée',
    description: 'Débloquer la deuxième leçon.',
    icon: '🔓',
    accent: '#58CC02',
  },
  {
    id: 'ten_lessons',
    title: 'Programme sérieux',
    description: 'Valider 10 leçons.',
    icon: '📚',
    accent: '#8B5CF6',
  },
  {
    id: 'level_3',
    title: 'Niveau 3',
    description: 'Atteindre le niveau 3 XP.',
    icon: '⚡',
    accent: '#CE82FF',
  },
  {
    id: 'level_5',
    title: 'Niveau 5',
    description: 'Atteindre le niveau 5 XP.',
    icon: '🚀',
    accent: '#CE82FF',
  },
  {
    id: 'hundred_words',
    title: '100 mots',
    description: 'Avoir 100 cartes dans la mémoire active.',
    icon: '🧠',
    accent: '#FF4B4B',
  },
  {
    id: 'daily_streak_3',
    title: '3 jours',
    description: 'Apprendre 3 jours de suite.',
    icon: '🔥',
    accent: '#FF9600',
  },
  {
    id: 'daily_streak_7',
    title: '7 jours',
    description: 'Apprendre une semaine complète.',
    icon: '🔥',
    accent: '#FF9600',
  },
];

export function findAchievement(id: string): Achievement | undefined {
  return achievements.find((achievement) => achievement.id === id);
}
