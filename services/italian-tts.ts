/**
 * Italian TTS — neural voices via the Cloudflare Worker proxy.
 * ─────────────────────────────────────────────────────────────
 *
 * Two-tier caching:
 *   1. Local file cache (FileSystem) → same phrase replayed instantly, even offline.
 *   2. Worker edge cache (30 days)  → first user worldwide pays the synthesis cost,
 *      everyone else gets the MP3 instantly.
 *
 * Drop-in replacement for `Speech.speak` / `Speech.stop` from expo-speech.
 * Falls back to `expo-speech` automatically if the network or worker is unavailable.
 *
 *   import { speakIt, stopIt } from '@/services/italian-tts';
 *   speakIt('Buongiorno, sono Pierre.');
 *   speakIt(phrase, { voice: 'it-IT-DiegoNeural', rate: 0.9 });
 *   stopIt();
 */

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';

export const ITALIAN_TTS_WORKER_URL =
  process.env.EXPO_PUBLIC_ITALPRO_TTS_URL ?? 'https://italpro-tts.italpro-tts.workers.dev';
const CACHE_DIR_NAME = 'tts-cache';
const FETCH_TIMEOUT_MS = 12_000;

export type ItalianVoice =
  | 'it-IT-IsabellaNeural'  // F · cordiale (default)
  | 'it-IT-ElsaNeural'      // F · neutre pro
  | 'it-IT-DiegoNeural'     // M · grave commercial
  | 'it-IT-GiuseppeNeural'  // M · ferme
  | 'it-IT-PalmiraNeural';  // F · douce

export type SpeakOptions = {
  /** Italian neural voice. Default: it-IT-IsabellaNeural. */
  voice?: ItalianVoice;
  /** 1.0 = normal, 0.5 = slow, 1.5 = fast. Mapped to ±50% in the worker. */
  rate?: number;
  /** 1.0 = normal pitch. Same scale as rate. */
  pitch?: number;
  /** Skip the worker entirely (force device TTS). Useful for debug. */
  forceLocal?: boolean;
};

let currentPlayer: AudioPlayer | null = null;
let workerCooldownUntil = 0;
const inflight = new Map<string, Promise<string | null>>();

/**
 * Speak Italian text. Prefers neural voice via worker; falls back to expo-speech.
 * Always stops any currently-playing utterance first.
 */
export async function speakIt(rawText: string, opts: SpeakOptions = {}): Promise<void> {
  const text = rawText?.trim();
  if (!text) return;

  stopIt();

  if (opts.forceLocal || isCoolingDown()) {
    return playWithDeviceFallback(text, opts);
  }

  try {
    const uri = await getOrFetchAudio(text, opts);
    if (!uri) {
      return playWithDeviceFallback(text, opts);
    }
    const player = createAudioPlayer({ uri });
    currentPlayer = player;
    player.play();
  } catch (err) {
    triggerCooldown();
    console.warn('[italian-tts] neural playback failed → fallback to device TTS', err);
    playWithDeviceFallback(text, opts);
  }
}

/** Stop both the neural player and any device-TTS utterance. */
export function stopIt(): void {
  try {
    Speech.stop();
  } catch {}
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.remove();
    } catch {}
    currentPlayer = null;
  }
}

/** Pre-warm the cache with a list of phrases (e.g. on app launch). Non-blocking. */
export async function preloadPhrases(phrases: string[], voice?: ItalianVoice): Promise<void> {
  for (const phrase of phrases) {
    if (isCoolingDown()) return;
    try {
      await getOrFetchAudio(phrase, { voice });
    } catch {
      triggerCooldown();
      return;
    }
  }
}

// ─── Internals ──────────────────────────────────────────────────────────────

function playWithDeviceFallback(text: string, opts: SpeakOptions): void {
  Speech.speak(text, {
    language: 'it-IT',
    rate: opts.rate ?? 1,
    pitch: opts.pitch ?? 1,
  });
}

async function getOrFetchAudio(text: string, opts: SpeakOptions): Promise<string | null> {
  const voice: ItalianVoice = opts.voice ?? 'it-IT-IsabellaNeural';
  const ratePct = clampPct(rateToPct(opts.rate));
  const pitchPct = clampPct(rateToPct(opts.pitch));

  const key = cacheKey(voice, ratePct, pitchPct, text);

  // Already cached locally?
  const cached = readCachedFile(key);
  if (cached) return cached;

  // Coalesce concurrent requests for the same key.
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetchAndCache(text, voice, ratePct, pitchPct, key)
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

async function fetchAndCache(
  text: string,
  voice: ItalianVoice,
  rate: number,
  pitch: number,
  key: string,
): Promise<string | null> {
  const url =
    `${ITALIAN_TTS_WORKER_URL}/tts?text=${encodeURIComponent(text)}` +
    `&voice=${voice}` +
    `&rate=${rate}` +
    `&pitch=${pitch}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[italian-tts] worker ${res.status}`);
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0) return null;
    return writeCachedFile(key, buf);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.warn('[italian-tts] worker timeout');
    } else {
      console.warn('[italian-tts] worker error', err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cacheDir(): Directory {
  const dir = new Directory(Paths.cache, CACHE_DIR_NAME);
  if (!dir.exists) {
    try {
      dir.create({ intermediates: true, idempotent: true });
    } catch {
      // Ignore — readCachedFile/writeCachedFile will surface the issue.
    }
  }
  return dir;
}

function readCachedFile(key: string): string | null {
  try {
    const file = new File(cacheDir(), `${key}.mp3`);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

function writeCachedFile(key: string, bytes: Uint8Array): string | null {
  try {
    const file = new File(cacheDir(), `${key}.mp3`);
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);
    return file.uri;
  } catch (err) {
    console.warn('[italian-tts] could not write cache', err);
    return null;
  }
}

/** Maps 0.5 → -50, 1.0 → 0, 1.5 → +50. */
function rateToPct(rate: number | undefined): number {
  if (rate === undefined || Number.isNaN(rate)) return 0;
  return Math.round((rate - 1) * 100);
}

function clampPct(n: number): number {
  return Math.max(-50, Math.min(50, n));
}

/** Stable, dependency-free 32-bit hash (djb2). Collisions are harmless here. */
function cacheKey(voice: string, rate: number, pitch: number, text: string): string {
  const composite = `${voice}|${rate}|${pitch}|${text}`;
  let h = 5381;
  for (let i = 0; i < composite.length; i++) {
    h = ((h << 5) + h + composite.charCodeAt(i)) | 0;
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return `${voice.toLowerCase()}_r${rate}_p${pitch}_${hex}`;
}

function isCoolingDown(): boolean {
  return Date.now() < workerCooldownUntil;
}

function triggerCooldown(): void {
  // After a failure, give the worker 60 s of quiet before retrying.
  workerCooldownUntil = Date.now() + 60_000;
}
