export function GET() {
  return Response.json({
    ok: true,
    groq: Boolean(process.env.GROQ_API_KEY),
    kokoroProvider: process.env.KOKORO_TTS_PROVIDER ?? 'hf-space',
    kokoro:
      (process.env.KOKORO_TTS_PROVIDER ?? 'hf-space') === 'hf-space' ||
      Boolean(process.env.KOKORO_TTS_BASE_URL ?? process.env.KOKORO_TTS_URL ?? process.env.HF_TOKEN),
    supabase: Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  });
}
