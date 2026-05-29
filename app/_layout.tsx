import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Écran leçon (ta version existante) */}
        <Stack.Screen
          name="lesson/[lessonId]"
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        {/* Écran checkpoint (ajouté par le worktree) */}
        <Stack.Screen
          name="checkpoint/[id]"
          options={{ headerShown: false, animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
