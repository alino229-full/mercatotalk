import { getServerEnv } from '@/services/server-env';

export function GET() {
  return Response.json({
    ok: true,
    groq: Boolean(getServerEnv('GROQ_API_KEY')),
    deepgram: Boolean(getServerEnv('DEEPGRAM_API_KEY')),
    elevenLabs: Boolean(getServerEnv('ELEVENLABS_API_KEY', 'ELEVEN_LABS_API_KEY')),
    elevenLabsCallVoice: Boolean(
      getServerEnv(
        'ELEVENLABS_CALL_VOICE_ID',
        'ELEVENLABS_MACLY_VOICE_ID',
        'ELEVENLABS_VOICE_MACLY_ID',
        'MACLY_ELEVENLABS_VOICE_ID',
        'ELEVENLABS_VOICE_ID',
        'ELEVEN_LABS_VOICE_ID',
      ),
    ),
    ttsWorker: Boolean(getServerEnv('EXPO_PUBLIC_ITALPRO_TTS_URL')),
    supabase: Boolean(
      getServerEnv('EXPO_PUBLIC_SUPABASE_URL') && getServerEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
    ),
  });
}
