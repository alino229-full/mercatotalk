/**
 * Italian TTS — neural voices with a 3-tier fallback chain.
 * ─────────────────────────────────────────────────────────────
 *
 *   Tier 1 · Deepgram Aura-2 (via the /api/tts server proxy, key stays server-side)
 *   Tier 2 · Cloudflare Worker → Microsoft Edge Neural TTS
 *   Tier 3 · expo-speech (device voice, fully offline)
 *
 * Two-tier caching per provider:
 *   1. Local file cache (FileSystem) → same phrase replayed instantly, even offline.
 *   2. Worker edge cache (30 days)  → shared synthesis cost for the Edge tier.
 *
 * Drop-in replacement for `Speech.speak` / `Speech.stop` from expo-speech.
 *
 *   import { speakIt, stopIt } from '@/services/italian-tts';
 *   speakIt('Buongiorno, sono Pierre.');
 *   speakIt(phrase, { voice: 'it-IT-DiegoNeural', rate: 0.9 });
 *   stopIt();
 */

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

import { getExpoApiBaseUrl } from '@/services/api-base-url';

export const ITALIAN_TTS_WORKER_URL =
  process.env.EXPO_PUBLIC_ITALPRO_TTS_URL ?? 'https://italpro-tts.italpro-tts.workers.dev';

const configuredApiUrl =
  process.env.EXPO_PUBLIC_ITALPRO_API_URL ?? process.env.EXPO_PUBLIC_ITALPRO_AI_URL;

const DEFAULT_DEEPGRAM_F = process.env.EXPO_PUBLIC_DEEPGRAM_TTS_MODEL ?? 'aura-2-cesare-it';
const DEFAULT_DEEPGRAM_M = process.env.EXPO_PUBLIC_DEEPGRAM_TTS_MODEL_M ?? 'aura-2-cesare-it';

const CACHE_DIR_NAME = 'tts-cache';
const FETCH_TIMEOUT_MS = 12_000;
const IS_WEB = process.env.EXPO_OS === 'web';

export type ItalianVoice =
  | 'it-IT-IsabellaNeural'  // F · cordiale (default)
  | 'it-IT-ElsaNeural'      // F · neutre pro
  | 'it-IT-DiegoNeural'     // M · grave commercial
  | 'it-IT-GiuseppeNeural'  // M · ferme
  | 'it-IT-PalmiraNeural';  // F · douce

/** Edge voices that map to the masculine Deepgram model. */
const MALE_VOICES = new Set<ItalianVoice>(['it-IT-DiegoNeural', 'it-IT-GiuseppeNeural']);

export type SpeakOptions = {
  /** Italian Edge neural voice (used by the Worker tier). Default: it-IT-IsabellaNeural. */
  voice?: ItalianVoice;
  /** Explicit Deepgram Aura-2 model (e.g. aura-2-livia-it). Overrides the voice→model mapping. */
  deepgramModel?: string;
  /** 1.0 = normal, 0.5 = slow, 1.5 = fast. Applies to the Worker tier. */
  rate?: number;
  /** 1.0 = normal pitch. Same scale as rate. Applies to the Worker tier. */
  pitch?: number;
  /** Skip the network entirely (force device TTS). Useful for debug. */
  forceLocal?: boolean;
};

type AudioExt = 'wav' | 'mp3';

let currentPlayer: AudioPlayer | null = null;
let workerCooldownUntil = 0;
const inflight = new Map<string, Promise<string | null>>();

/**
 * Speak Italian text. Tries Deepgram → Worker → device TTS.
 * Always stops any currently-playing utterance first.
 */
export async function speakIt(rawText: string, opts: SpeakOptions = {}): Promise<void> {
  const text = rawText?.trim();
  if (!text) return;

  stopIt();

  if (opts.forceLocal) {
    return playWithDeviceFallback(text, opts);
  }

  try {
    const uri = await getOrFetchAudio(text, opts);
    if (!uri) {
      return playWithDeviceFallback(text, opts);
    }
    const player = createAudioPlayer({ uri });
    currentPlayer = player;
    playWhenReady(player);
  } catch (err) {
    console.warn('[italian-tts] neural playback failed → fallback to device TTS', err);
    playWithDeviceFallback(text, opts);
  }
}

/**
 * Play only once the source is loaded. Calling play() immediately on a fresh
 * player races the decoder: short clips ("pane") play a tiny initial buffer then
 * stop ("pa"). Waiting for `isLoaded` guarantees the whole clip plays.
 */
function playWhenReady(player: AudioPlayer): void {
  if (player.isLoaded) {
    player.play();
    return;
  }
  const sub = player.addListener('playbackStatusUpdate', (status) => {
    if (status.isLoaded && currentPlayer === player) {
      player.play();
      sub.remove();
    }
  });
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
    try {
      await getOrFetchAudio(phrase, { voice });
    } catch {
      return;
    }
  }
}

// ─── Tier orchestration ───────────────────────────────────────────────────────

async function getOrFetchAudio(text: string, opts: SpeakOptions): Promise<string | null> {
  // Tier 1 — Cloudflare Worker (Microsoft Edge Neural). Mis en priorite pendant
  // l'investigation de la troncature WAV cote Deepgram.
  if (!isCoolingDown(workerCooldownUntil)) {
    const voice: ItalianVoice = opts.voice ?? 'it-IT-IsabellaNeural';
    const ratePct = clampPct(rateToPct(opts.rate));
    const pitchPct = clampPct(rateToPct(opts.pitch));
    const key = workerCacheKey(voice, ratePct, pitchPct, text);
    const uri = await coalesce(key, () => fetchWorker(text, voice, ratePct, pitchPct, key));
    if (uri) return uri;
    triggerWorkerCooldown();
  }

  // Tier 2 — Deepgram (server proxy).
  const apiBase = getExpoApiBaseUrl(configuredApiUrl);
  if (apiBase) {
    const model = opts.deepgramModel ?? resolveDeepgramModel(opts.voice);
    const uri = await coalesce(`dg_${model}_${hash(text)}`, () =>
      fetchDeepgram(apiBase, text, model),
    );
    if (uri) return uri;
  }

  // Tier 3 handled by the caller (device TTS).
  return null;
}

/** Coalesce concurrent requests for the same cache key. */
function coalesce(key: string, factory: () => Promise<string | null>): Promise<string | null> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = factory().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

function resolveDeepgramModel(voice?: ItalianVoice): string {
  if (voice && MALE_VOICES.has(voice)) return DEFAULT_DEEPGRAM_M;
  return DEFAULT_DEEPGRAM_F;
}

// ─── Tier 1: Deepgram ─────────────────────────────────────────────────────────

async function fetchDeepgram(apiBase: string, text: string, model: string): Promise<string | null> {
  const key = `dg_${model}_${hash(text)}`;
  const cached = await readCachedFile(key, 'wav');
  if (cached) return cached;

  // Retry once: transient DNS/network hiccups (EAI_AGAIN) on the proxy host are
  // the usual cause of a failed call, and a second attempt almost always works.
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${apiBase}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model }),
        signal: controller.signal,
      });
      if (!res.ok) {
        console.warn(`[italian-tts] deepgram ${res.status} (try ${attempt + 1})`);
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length === 0) continue;
      return writeCachedFile(key, buf, 'wav');
    } catch (err) {
      logFetchError('deepgram', err);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// ─── Tier 2: Cloudflare Worker ──────────────────────────────────────────────

async function fetchWorker(
  text: string,
  voice: ItalianVoice,
  rate: number,
  pitch: number,
  key: string,
): Promise<string | null> {
  const cached = await readCachedFile(key, 'mp3');
  if (cached) return cached;

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
    return writeCachedFile(key, buf, 'mp3');
  } catch (err) {
    logFetchError('worker', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Device fallback ──────────────────────────────────────────────────────────

function playWithDeviceFallback(text: string, opts: SpeakOptions): void {
  Speech.speak(text, {
    language: 'it-IT',
    rate: opts.rate ?? 1,
    pitch: opts.pitch ?? 1,
  });
}

// ─── File cache ───────────────────────────────────────────────────────────────

async function getFileSystem() {
  if (IS_WEB) return null;
  return import('expo-file-system');
}

async function cacheDir() {
  const fs = await getFileSystem();
  if (!fs) return null;
  const dir = new fs.Directory(fs.Paths.cache, CACHE_DIR_NAME);
  if (!dir.exists) {
    try {
      dir.create({ intermediates: true, idempotent: true });
    } catch {
      // Ignore — readCachedFile/writeCachedFile will surface the issue.
    }
  }
  return dir;
}

async function readCachedFile(key: string, ext: AudioExt): Promise<string | null> {
  try {
    const fs = await getFileSystem();
    const dir = await cacheDir();
    if (!fs || !dir) return null;
    const file = new fs.File(dir, `${key}.${ext}`);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

async function writeCachedFile(key: string, bytes: Uint8Array, ext: AudioExt): Promise<string | null> {
  if (IS_WEB) {
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(arrayBuffer).set(bytes);
    const mime = ext === 'wav' ? 'audio/wav' : 'audio/mpeg';
    return URL.createObjectURL(new Blob([arrayBuffer], { type: mime }));
  }

  try {
    const fs = await getFileSystem();
    const dir = await cacheDir();
    if (!fs || !dir) return null;
    const file = new fs.File(dir, `${key}.${ext}`);
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);
    return file.uri;
  } catch (err) {
    console.warn('[italian-tts] could not write cache', err);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function logFetchError(tier: string, err: unknown): void {
  if ((err as Error)?.name === 'AbortError') {
    console.warn(`[italian-tts] ${tier} timeout`);
  } else {
    console.warn(`[italian-tts] ${tier} error`, err);
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
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function workerCacheKey(voice: string, rate: number, pitch: number, text: string): string {
  const composite = `${voice}|${rate}|${pitch}|${text}`;
  return `${voice.toLowerCase()}_r${rate}_p${pitch}_${hash(composite)}`;
}

function isCoolingDown(until: number): boolean {
  return Date.now() < until;
}

function triggerWorkerCooldown(): void {
  workerCooldownUntil = Date.now() + 60_000;
}
