declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_ITALPRO_API_URL?: string;
    EXPO_PUBLIC_ITALPRO_AI_URL?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    EXPO_PUBLIC_KOKORO_PROVIDER?: string;
    EXPO_PUBLIC_HF_KOKORO_SPACE_URL?: string;
    EXPO_PUBLIC_HF_KOKORO_MODEL_URL?: string;
    EXPO_PUBLIC_HF_KOKORO_VOICE?: string;
    EXPO_PUBLIC_KOKORO_TTS_VOICE?: string;
    EXPO_PUBLIC_KOKORO_TTS_SPEED?: string;
    EXPO_PUBLIC_HF_TOKEN?: string;
    GROQ_API_KEY?: string;
    GROQ_LLM_MODEL?: string;
    GROQ_STT_MODEL?: string;
    KOKORO_TTS_PROVIDER?: string;
    HF_KOKORO_SPACE_URL?: string;
    HF_KOKORO_MODEL_URL?: string;
    HF_TOKEN?: string;
    KOKORO_TTS_BASE_URL?: string;
    KOKORO_TTS_URL?: string;
    KOKORO_TTS_MODEL?: string;
    KOKORO_TTS_VOICE?: string;
    KOKORO_TTS_RESPONSE_FORMAT?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    SUPABASE_JWT_SECRET?: string;
  }
}

export {};
