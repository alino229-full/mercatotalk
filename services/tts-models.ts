export const DEFAULT_ITALIAN_DEEPGRAM_MODEL = 'aura-2-cesare-it';

const ITALIAN_DEEPGRAM_MODEL_RE = /^aura-2-[a-z0-9-]+-it$/i;

export function normalizeItalianDeepgramModel(model: string): string {
  return ITALIAN_DEEPGRAM_MODEL_RE.test(model) ? model : DEFAULT_ITALIAN_DEEPGRAM_MODEL;
}
