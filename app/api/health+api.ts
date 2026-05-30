export function GET() {
  return Response.json({
    ok: true,
    groq: Boolean(process.env.GROQ_API_KEY),
    deepgram: Boolean(process.env.DEEPGRAM_API_KEY),
    ttsWorker: Boolean(process.env.EXPO_PUBLIC_ITALPRO_TTS_URL),
    supabase: Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  });
}
