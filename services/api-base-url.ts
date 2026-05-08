import Constants from 'expo-constants';

function resolveExpoHostApiUrl(pathname: string): string | null {
  const hostUri = Constants.expoConfig?.hostUri?.replace(/\/$/, '');
  if (!hostUri) return null;

  const cleanPath = pathname.replace(/\/$/, '') || '/api';
  return `http://${hostUri}${cleanPath}`;
}

export function getExpoApiBaseUrl(configuredApiUrl?: string | null): string | null {
  const trimmed = configuredApiUrl?.trim();

  if (process.env.EXPO_OS === 'web') {
    if (!trimmed) return '/api';

    try {
      const parsed = new URL(trimmed);
      const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      if (isLocalHost && typeof window !== 'undefined' && parsed.port !== window.location.port) {
        return '/api';
      }
    } catch {
      return trimmed.replace(/\/$/, '');
    }
  }

  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    if (isLocalHost) {
      return resolveExpoHostApiUrl(parsed.pathname) ?? trimmed.replace(/\/$/, '');
    }
  } catch {
    return trimmed.replace(/\/$/, '');
  }

  return trimmed.replace(/\/$/, '');
}
