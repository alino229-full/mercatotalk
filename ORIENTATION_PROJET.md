# MercatoTalk - Objectif du projet et orientation cout bas

## Objectif du projet

MercatoTalk est une application mobile Expo / React Native destinee a aider un agent commercial francophone a tenir des conversations professionnelles en italien dans un delai court, avec un objectif pratique: etre capable de rassurer un client, qualifier un besoin, expliquer une offre et simuler un appel commercial complet.

L'application n'est pas pensee comme un simple catalogue de lecons figees. Elle doit etre interactive, mobile-first et centree sur des situations concretes, par exemple un client italien qui demande des renseignements sur un conteneur habitable de 20 pieds, qui hesite sur le prix, qui veut comprendre les delais, ou qui a besoin d'etre rassure sur le service.

Les priorites produit sont:

- apprendre l'italien utile au contexte B2B;
- simuler des dialogues client realistes;
- corriger les formulations, le registre professionnel et l'usage du vouvoiement italien avec `Lei`;
- travailler l'oral avec transcription, reponse vocale et repetition;
- conserver une progression locale fiable, meme sans connexion permanente;
- eviter les couts recurrents inutiles pendant le MVP.

## Orientation technique: moindre cout d'utilisation

L'orientation retenue est une architecture **local-first avec IA optionnelle et peu couteuse**. L'objectif est de garder l'application exploitable sans multiplier les appels a des API payantes.

Au lieu de dependre uniquement de services premium comme Claude, Gemini, ElevenLabs ou OpenAI Whisper, le projet privilegie:

- une base de donnees locale SQLite pour les scenarios, messages, corrections et progres;
- Groq pour les appels IA texte et STT lorsque la qualite cloud est necessaire;
- Kokoro TTS pour tester une voix de synthese open source ou gratuite;
- Supabase uniquement pour l'authentification, la synchronisation et les metadonnees;
- aucun stockage de fichiers audio en base ou en storage cloud.

Cette approche permet de construire une experience puissante tout en gardant un cout proche de zero pendant les tests.

## Pourquoi Groq

Groq est retenu pour deux usages principaux:

- **LLM conversationnel** avec `llama-3.3-70b-versatile`, pour jouer le role du client italien, generer des reponses naturelles et corriger les phrases de l'utilisateur.
- **STT Whisper** avec `whisper-large-v3-turbo`, pour transcrire temporairement la voix de l'utilisateur lorsque le mode vocal est active.

La raison principale est economique: Groq propose un free tier interessant et des modeles rapides, ce qui est adapte a un MVP qui doit rester fluide sans payer immediatement des services plus chers.

Groq reste toutefois optionnel dans l'architecture. Si la cle API n'est pas configuree, l'application doit continuer a fonctionner avec le moteur local de dialogue et de correction.

## Pourquoi Kokoro

Kokoro est retenu comme piste TTS open source / gratuite pour reduire la dependance a ElevenLabs.

Deux modes sont envisages:

- **Hugging Face Space Kokoro**, rapide a tester sans infrastructure;
- **Kokoro self-hosted**, pour une version future controlee par nous, sans cout par requete.

Limite importante: le Space public teste peut ne pas exposer les voix italiennes annoncees ou peut changer ses endpoints. Pour cette raison, Kokoro est considere comme une option de test et non comme l'unique moteur vocal fiable.

Pour le MVP mobile Expo, la solution la plus stable reste:

- `expo-speech` pour la voix locale du telephone quand une voix italienne est disponible;
- Kokoro en option experimentale;
- Groq / STT uniquement pour les cas ou une transcription IA est necessaire.

## Pourquoi une base de donnees locale

La base locale SQLite est essentielle pour reduire les couts et rendre l'app plus robuste.

Elle stocke:

- les scenarios de simulation;
- les messages du dialogue;
- les corrections;
- les cartes d'apprentissage;
- les statistiques de progression;
- les rapports d'appel;
- les metadonnees audio, si necessaire.

Elle ne stocke pas les fichiers audio.

Cette decision permet:

- un usage offline partiel;
- moins d'appels reseau;
- une meilleure reactivite mobile;
- une reduction des couts Supabase;
- une experience plus proche d'une vraie application native.

## Role de Supabase

Supabase reste utile, mais son role est volontairement limite pour maitriser les couts.

Supabase sert a:

- gerer l'authentification;
- synchroniser les donnees importantes entre appareils;
- stocker les profils, sessions, scores et rapports;
- conserver les metadonnees utiles pour le suivi.

Supabase ne doit pas servir a stocker les fichiers audio.

Regle importante:

> Les fichiers audio sont envoyes a l'IA uniquement pour traitement temporaire, puis supprimes immediatement. Seules les metadonnees peuvent etre conservees.

## Position sur le 100% local avec ExecuTorch

`react-native-executorch` est interessant pour une future version offline avancee, mais il n'est pas retenu comme socle principal du MVP actuel.

Raisons:

- il ne fonctionne pas dans Expo Go simple et demande un development build natif;
- l'integration augmente la complexite de build et de test;
- le TTS Kokoro documente cote ExecuTorch est surtout oriente anglais;
- pour une app d'italien B2B, l'interet est limite si la voix italienne n'est pas fiable;
- les modeles locaux sont plus contraints en qualite, taille et performance selon le telephone.

Conclusion: la meilleure orientation actuelle est **Expo compatible, local-first, SQLite, expo-speech, Groq optionnel et Kokoro experimental**.

## Strategie finale retenue

La strategie du projet est donc:

1. Construire une experience mobile solide et interactive avec Expo.
2. Utiliser SQLite comme coeur local de l'application.
3. Utiliser un moteur local pour les dialogues et corrections de base.
4. Ajouter Groq uniquement pour ameliorer la qualite des dialogues, corrections et transcriptions.
5. Tester Kokoro pour reduire les couts TTS, sans bloquer l'app dessus.
6. Utiliser Supabase pour l'auth, la synchronisation et les metadonnees.
7. Ne jamais stocker les fichiers audio dans Supabase.

Cette orientation donne une app moins chere, plus rapide a tester, plus respectueuse des donnees utilisateur et plus proche d'un vrai usage mobile.
