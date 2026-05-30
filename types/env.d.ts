declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_ITALPRO_API_URL?: string;
    EXPO_PUBLIC_ITALPRO_AI_URL?: string;
    EXPO_PUBLIC_ITALPRO_TTS_URL?: string;
    EXPO_PUBLIC_DEEPGRAM_TTS_MODEL?: string;
    EXPO_PUBLIC_DEEPGRAM_TTS_MODEL_M?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    GROQ_API_KEY?: string;
    GROQ_LLM_MODEL?: string;
    GROQ_STT_MODEL?: string;
    DEEPGRAM_API_KEY?: string;
    DEEPGRAM_TTS_MODEL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    SUPABASE_JWT_SECRET?: string;
  }
}

export {};
