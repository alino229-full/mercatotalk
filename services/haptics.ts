import * as Haptics from 'expo-haptics';

export async function tapFeedback(): Promise<void> {
  await Haptics.selectionAsync().catch(() => null);
}

export async function successFeedback(): Promise<void> {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
}

export async function warningFeedback(): Promise<void> {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => null);
}

export async function errorFeedback(): Promise<void> {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => null);
}
