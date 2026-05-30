# MercatoTalk

Application Expo mobile-first pour entrainer un commercial francophone a tenir des appels professionnels en italien.

La strategie technique est "offline-first + services gratuits": SQLite local pour que l'app reste interactive sans reseau, puis Groq, Cloudflare Worker TTS et Supabase quand une connexion et des quotas sont disponibles.

## Stack services

| Besoin | Service | Cout vise |
| --- | --- | --- |
| Dialogue IA, correction, coaching | Groq LLM `llama-3.3-70b-versatile` | Free tier Groq |
| Speech-to-text | Groq Whisper `whisper-large-v3-turbo` | Free tier Groq |
| Text-to-speech naturel | Deepgram Aura-2 → Worker Edge → expo-speech | Free tier Deepgram |
| Auth, DB, metadonnees uniquement | Supabase | Free tier Supabase |
| Memoire mobile offline | Expo SQLite | Local gratuit |

## Architecture

```txt
app/
  api/
    dialogue-turn+api.ts   Proxy serveur vers Groq LLM
    transcribe+api.ts      Proxy serveur vers Groq Whisper
    tts+api.ts             Proxy serveur vers Deepgram Aura-2 (cle serveur)
database/
  italpro-local-db.ts      SQLite local: scenarios, messages, corrections
lib/
  supabase.ts              Client Supabase Expo avec stockage local SQLite
services/
  italian-tts.ts           TTS neuronal via Cloudflare Worker + cache local + fallback expo-speech
  speech-ai-client.ts      App mobile -> proxy STT (Groq Whisper)
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
EXPO_PUBLIC_ITALPRO_TTS_URL=https://italpro-tts.italpro-tts.workers.dev
EXPO_PUBLIC_DEEPGRAM_TTS_MODEL=aura-2-livia-it
EXPO_PUBLIC_DEEPGRAM_TTS_MODEL_M=aura-2-dionisio-it

EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

GROQ_API_KEY=
GROQ_LLM_MODEL=llama-3.3-70b-versatile
GROQ_STT_MODEL=whisper-large-v3-turbo

DEEPGRAM_API_KEY=

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

## TTS — chaine a 3 niveaux

Le TTS essaie les fournisseurs dans l'ordre, avec fallback automatique:

1. **Deepgram Aura-2** via le proxy serveur `POST /api/tts` (la cle reste cote serveur)
2. **Cloudflare Worker** → Microsoft Edge Neural TTS (`speech.platform.bing.com`)
3. **expo-speech** → voix native du telephone (totalement hors-ligne)

Chaque niveau a son propre cache fichier local (replay instantane, meme hors-ligne).
En cas d'echec, un niveau se met en cooldown 60 s avant nouvelle tentative.

### Niveau 1 — Deepgram Aura-2

```env
DEEPGRAM_API_KEY=
EXPO_PUBLIC_DEEPGRAM_TTS_MODEL=aura-2-livia-it
EXPO_PUBLIC_DEEPGRAM_TTS_MODEL_M=aura-2-dionisio-it
```

Voix italiennes Aura-2 disponibles:

| Modele | Genre |
| --- | --- |
| `aura-2-livia-it` | F (defaut) |
| `aura-2-dionisio-it` | M (defaut) |
| `aura-2-melia-it`, `aura-2-maia-it`, `aura-2-cinzia-it`, `aura-2-demetra-it` | F |
| `aura-2-elio-it`, `aura-2-flavio-it`, `aura-2-cesare-it`, `aura-2-perseo-it` | M |

L'endpoint serveur appelle `https://api.deepgram.com/v1/speak?model=...&encoding=mp3`
avec le header `Authorization: Token DEEPGRAM_API_KEY`. Limite Aura: 2000 caracteres/requete.

### Niveau 2 — Worker Edge

```env
EXPO_PUBLIC_ITALPRO_TTS_URL=https://italpro-tts.italpro-tts.workers.dev
```

Voix Edge italiennes: `it-IT-IsabellaNeural` (defaut), `it-IT-ElsaNeural`,
`it-IT-DiegoNeural`, `it-IT-GiuseppeNeural`, `it-IT-PalmiraNeural`.
Les voix masculines (Diego, Giuseppe) sont mappees vers `aura-2-dionisio-it` au niveau 1.

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
- Deepgram indisponible: fallback Worker Edge, puis `expo-speech` (voix native du telephone).
- Supabase indisponible: donnees locales SQLite.
- Reseau coupe: historique et corrections locales restent disponibles.

## Docs officielles utiles

- Groq API: https://console.groq.com/docs/api-reference
- Groq models: https://console.groq.com/docs/models
- Expo env vars: https://docs.expo.dev/guides/environment-variables/
- Expo API routes: https://docs.expo.dev/router/reference/api-routes/
- Supabase Expo: https://supabase.com/docs/guides/with-expo
