# MercatoTalk

Application Expo mobile-first pour entrainer un commercial francophone a tenir des appels professionnels en italien.

La strategie technique est "offline-first + services gratuits": SQLite local pour que l'app reste interactive sans reseau, puis Groq, Kokoro et Supabase quand une connexion et des quotas sont disponibles.

## Stack services

| Besoin | Service | Cout vise |
| --- | --- | --- |
| Dialogue IA, correction, coaching | Groq LLM `llama-3.3-70b-versatile` | Free tier Groq |
| Speech-to-text | Groq Whisper `whisper-large-v3-turbo` | Free tier Groq |
| Text-to-speech naturel | HF Kokoro Space, puis HF Inference ou self-hosted | Gratuit selon quota |
| Auth, DB, metadonnees uniquement | Supabase | Free tier Supabase |
| Memoire mobile offline | Expo SQLite | Local gratuit |

## Architecture

```txt
app/
  api/
    dialogue-turn+api.ts   Proxy serveur vers Groq LLM
    transcribe+api.ts      Proxy serveur vers Groq Whisper
    tts+api.ts             Proxy serveur vers Kokoro TTS
database/
  italpro-local-db.ts      SQLite local: scenarios, messages, corrections
lib/
  supabase.ts              Client Supabase Expo avec stockage local SQLite
services/
  dialogue-ai-client.ts    App mobile -> proxy dialogue
  speech-ai-client.ts      App mobile -> proxy STT/TTS
supabase/
  schema.sql               Tables et RLS, sans stockage audio
```

Les cles secretes restent cote serveur. L'app Expo ne doit recevoir que des variables `EXPO_PUBLIC_*`.

## Politique audio

MercatoTalk ne stocke jamais les fichiers audio dans Supabase.

Flux autorise:

1. L'app enregistre un audio temporaire.
2. L'audio est envoye au proxy `/api/transcribe`.
3. Le proxy transmet immediatement le fichier a Groq Whisper.
4. Le fichier audio n'est pas ecrit en base, pas uploade dans Supabase Storage et pas conserve par l'app apres traitement.
5. Seules les metadonnees utiles peuvent etre sauvegardees: transcription, duree, langue, score, statut, timestamp.

Cette regle limite les couts de stockage, reduit le risque de donnees sensibles et simplifie la conformite.

## Installation

```bash
npm install
```

Copier le fichier d'exemple:

```bash
copy .env.example .env
```

Sur macOS/Linux:

```bash
cp .env.example .env
```

## Variables d'environnement

```env
EXPO_PUBLIC_ITALPRO_API_URL=

EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

GROQ_API_KEY=
GROQ_LLM_MODEL=llama-3.3-70b-versatile
GROQ_STT_MODEL=whisper-large-v3-turbo

EXPO_PUBLIC_KOKORO_PROVIDER=hf-space
EXPO_PUBLIC_HF_KOKORO_SPACE_URL=https://hexgrad-kokoro-tts.hf.space/api/predict
EXPO_PUBLIC_KOKORO_TTS_VOICE=if_sara
EXPO_PUBLIC_KOKORO_TTS_SPEED=1.0
EXPO_PUBLIC_HF_TOKEN=
EXPO_PUBLIC_HF_KOKORO_MODEL_URL=https://api-inference.huggingface.co/models/hexgrad/Kokoro-82M

KOKORO_TTS_PROVIDER=hf-space
HF_KOKORO_SPACE_URL=https://hexgrad-kokoro-tts.hf.space/api/predict
HF_TOKEN=
HF_KOKORO_MODEL_URL=https://api-inference.huggingface.co/models/hexgrad/Kokoro-82M
KOKORO_TTS_BASE_URL=
KOKORO_TTS_MODEL=kokoro
KOKORO_TTS_VOICE=if_sara
KOKORO_TTS_SPEED=1.0
KOKORO_TTS_RESPONSE_FORMAT=wav

SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
```

### Important mobile

Pour Expo Go sur un vrai telephone, `localhost` pointe vers le telephone, pas vers ton PC.

Utilise donc l'IP LAN de ton ordinateur:

```env
EXPO_PUBLIC_ITALPRO_API_URL=http://192.168.x.x:8081/api
```

Pour le web local:

```env
EXPO_PUBLIC_ITALPRO_API_URL=http://localhost:8081/api
```

En production:

```env
EXPO_PUBLIC_ITALPRO_API_URL=https://ton-domaine-eas.expo.app/api
```

## Groq LLM

1. Cree une cle sur GroqCloud.
2. Renseigne `GROQ_API_KEY` dans `.env`.
3. Garde `GROQ_LLM_MODEL=llama-3.3-70b-versatile`.

Le dialogue mobile appelle:

```txt
POST /api/dialogue-turn
```

La route serveur appelle Groq Chat Completions et renvoie:

```json
{
  "correction": {
    "score": 86,
    "correctedIt": "Certamente...",
    "feedbackFr": "Bonne reponse...",
    "nextFocus": ["Garder Lei", "Ajouter une question"]
  },
  "clientReply": {
    "contentIt": "Capisco, pero ho un dubbio...",
    "contentFr": "Je comprends, mais j'ai un doute...",
    "coachingNote": "Rassurer avec une preuve concrete."
  }
}
```

Sans `GROQ_API_KEY`, l'app continue avec le moteur local SQLite.

## Groq Whisper STT

La transcription audio passe par:

```txt
POST /api/transcribe
```

Payload attendu depuis l'app:

```ts
const formData = new FormData();
formData.append("file", audioFile);
formData.append("language", "it");
```

La route serveur appelle:

```txt
https://api.groq.com/openai/v1/audio/transcriptions
```

Modele par defaut:

```env
GROQ_STT_MODEL=whisper-large-v3-turbo
```

## Kokoro TTS via Hugging Face Space

Option la plus rapide pour tester, sans infrastructure et sans cle:

```env
EXPO_PUBLIC_KOKORO_PROVIDER=hf-space
EXPO_PUBLIC_HF_KOKORO_SPACE_URL=https://hexgrad-kokoro-tts.hf.space/api/predict
EXPO_PUBLIC_KOKORO_TTS_VOICE=if_sara
EXPO_PUBLIC_KOKORO_TTS_SPEED=1.0
```

Voix italiennes conseillees:

- `if_sara`: voix feminine italienne, meilleure qualite
- `if_nicola`: voix masculine italienne
- `im_nicola`: variante masculine

Le Space retourne une URL temporaire vers le fichier `.wav`. Le client peut l'utiliser directement, ou passer par `/api/tts` qui recupere le fichier et le renvoie a l'app sans stockage.

Appel direct de test:

```ts
const response = await fetch("https://hexgrad-kokoro-tts.hf.space/api/predict", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    data: ["Buongiorno, come posso aiutarla?", "if_sara", 1.0],
  }),
});

const json = await response.json();
const audioUrl = json.data[1];
```

Limite attendue: environ 100 requetes/jour sur le free tier HF Space.

## Kokoro TTS via HF Inference API

Plus stable que le Space, avec un token Hugging Face gratuit:

```env
EXPO_PUBLIC_KOKORO_PROVIDER=hf-inference
EXPO_PUBLIC_HF_TOKEN=
EXPO_PUBLIC_HF_KOKORO_MODEL_URL=https://api-inference.huggingface.co/models/hexgrad/Kokoro-82M
```

Pour une prod plus propre, ne mets pas le token dans `EXPO_PUBLIC_HF_TOKEN`; utilise plutot:

```env
KOKORO_TTS_PROVIDER=hf-inference
HF_TOKEN=
```

Le proxy `/api/tts` garde alors le token cote serveur.

## Kokoro TTS self-hosted

Si le quota HF devient trop limite, repasse en self-hosted:

```bash
docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
```

Puis configure:

```env
KOKORO_TTS_PROVIDER=self-hosted
KOKORO_TTS_BASE_URL=http://localhost:8880/v1
KOKORO_TTS_MODEL=kokoro
KOKORO_TTS_RESPONSE_FORMAT=mp3
```

## Supabase

1. Cree un projet Supabase gratuit.
2. Va dans Project Settings > API.
3. Copie l'URL dans `EXPO_PUBLIC_SUPABASE_URL`.
4. Copie la cle publique anon/publishable dans `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
5. Execute [supabase/schema.sql](./supabase/schema.sql) dans le SQL Editor.

Le schema cree:

- `profiles`
- `learning_cards`
- `dialogue_sessions`
- `dialogue_messages`
- `audio_events` pour les metadonnees audio seulement
- `corrections`
- `call_reports`
- policies RLS de base pour isoler les donnees par utilisateur

Le schema ne cree aucun bucket Supabase Storage. Les fichiers audio doivent rester temporaires.

Le client Expo est dans [lib/supabase.ts](./lib/supabase.ts). Il utilise `expo-sqlite/localStorage/install` pour persister la session sans AsyncStorage.

## Demarrer

```bash
npx expo start
```

API routes en local:

```bash
npx expo serve
```

Pour tester la sante du proxy:

```bash
curl http://localhost:8081/api/health
```

## Mode degrade intelligent

MercatoTalk doit rester utilisable si un service gratuit atteint ses limites:

- Groq indisponible: correction locale et scenario SQLite.
- Kokoro indisponible: fallback `expo-speech`.
- Supabase indisponible: donnees locales SQLite.
- Reseau coupe: historique et corrections locales restent disponibles.

## Docs officielles utiles

- Groq API: https://console.groq.com/docs/api-reference
- Groq models: https://console.groq.com/docs/models
- Expo env vars: https://docs.expo.dev/guides/environment-variables/
- Expo API routes: https://docs.expo.dev/router/reference/api-routes/
- Supabase Expo: https://supabase.com/docs/guides/with-expo
- Kokoro-FastAPI: https://github.com/remsky/Kokoro-FastAPI
