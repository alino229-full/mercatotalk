# MercatoTalk — Application mobile d'apprentissage de l'italien B2B pour agents commerciaux francophones

## Contexte & objectif

Tu es un expert en développement mobile React Native et en ingénierie pédagogique.

Je veux construire une application mobile appelée **MercatoTalk** avec React Native + Expo (SDK 51+), destinée à un agent commercial francophone qui doit pouvoir conduire des appels téléphoniques professionnels en italien en 3 mois.

L'application n'est PAS un clone de Duolingo. Elle combine :
- Une base linguistique solide (grammaire, conjugaison, pronoms, nombres)
- Un parcours B2B spécialisé (vocabulaire commercial, négociation, objections)
- Une pédagogie active basée sur l'audio, l'IA conversationnelle et la répétition espacée
- Un système d'évaluation IA qui analyse la prononciation et la formulation

---

## Stack technique obligatoire

- **Framework** : React Native + Expo Go (compatible iOS & Android)
- **Navigation** : Expo Router v3 (file-based routing)
- **State management** : Zustand
- **Backend / BDD** : Supabase (auth, PostgreSQL, storage audio)
- **IA conversationnelle** : API Anthropic Claude (claude-sonnet-4-20250514)
- **Synthèse vocale** : expo-speech (TTS natif) + ElevenLabs API pour voix italienne naturelle
- **Reconnaissance vocale** : expo-audio + Groq Whisper pour transcription temporaire + évaluation
- **Répétition espacée** : Algorithme SM-2 (SuperMemo) implémenté côté client
- **Animations** : react-native-reanimated v3
- **Styling** : NativeWind (Tailwind pour React Native)
- **Typage** : TypeScript strict, JSDoc sur tous les hooks custom

---

## Architecture pédagogique — Parcours 3 mois

### Phase 1 — Fondations linguistiques (Semaines 1–4)
Objectif : maîtriser les bases sans lesquelles la conversation est impossible.

Modules à implémenter :
1. **Pronoms personnels** : io, tu, lui/lei, noi, voi, loro — avec exercices de substitution
2. **Conjugaison des auxiliaires** : essere / avere au présent, passé, futur
3. **Verbes réguliers** : -are / -ere / -ire — conjugaison interactive
4. **Nombres & prix** : 0–1 000 000, lecture de prix en euros, pourcentages
5. **Alphabet & phonétique** : sons spécifiques italiens (gli, gn, ci, ce, chi, che)
6. **Politesse formelle** : Lei (vouvoiement), formules d'ouverture/clôture d'appel
7. **Vocabulaire de base** : 300 mots haute fréquence B2B

### Phase 2 — Communication professionnelle (Semaines 5–8)
Objectif : construire des phrases complètes dans un contexte commercial.

Modules :
1. **Appel entrant / sortant** : scripts d'ouverture, identification, transfert
2. **Présentation entreprise** : secteur, produits, valeur ajoutée
3. **Qualification client** : questions ouvertes / fermées, reformulation
4. **Devis & prix** : formuler, envoyer, expliquer, négocier
5. **Objections courantes** : "è troppo caro", "devo pensarci", "ho già un fornitore"
6. **Gestion du temps** : délais, rendez-vous, relances
7. **Emails & confirmation** : dictée d'email pro en italien avec correction IA

### Phase 3 — Fluidité & appels simulés (Semaines 9–12)
Objectif : enchaîner un appel téléphonique complet sans blocage.

Modules :
1. **Simulations d'appel complètes** : scénarios A→Z joués par l'IA (rôle : client italien)
2. **Gestion des imprévus** : accent régional, question inattendue, malentendu
3. **Vitesse & rythme** : exercices de lecture à vitesse croissante, shadowing
4. **Révision ciblée** : points faibles détectés automatiquement par l'IA
5. **Certification interne** : test final simulé — 10 minutes d'appel évalué

---

## Modules IA & audio — Spécifications détaillées

### Module 1 — Lecteur audio avec évaluation de prononciation
```
Flux utilisateur :
1. L'app affiche un texte italien (phrase ou paragraphe B2B)
2. Un bouton "Écouter modèle" joue la version ElevenLabs (voix native italienne)
3. L'utilisateur appuie sur "Enregistrer ma voix" → expo-audio capture l'audio
4. L'audio est envoyé à Whisper API → transcription texte
5. Claude compare la transcription à l'original :
   - Score de précision phonétique (0–100)
   - Erreurs identifiées mot par mot
   - Suggestions de correction avec exemples audio
6. L'utilisateur peut rejouer, comparer, et tenter à nouveau
```

### Module 2 — Conversation IA téléphonique simulée
```
Flux utilisateur :
1. L'utilisateur choisit un scénario (ex: "Appel de prospection BtoB")
2. Claude joue le rôle du client italien avec personnalité définie (pressé, méfiant, intéressé)
3. L'interface simule un écran d'appel téléphonique (pas de texte visible)
4. L'utilisateur parle → Whisper transcrit → Claude répond en audio (ElevenLabs)
5. En fin d'appel, Claude génère un rapport :
   - Vocabulaire utilisé / manquant
   - Erreurs grammaticales fréquentes
   - Fluidité (débit, hésitations)
   - Score global /100
   - 3 points à travailler en priorité
```

### Module 3 — Quiz adaptatif avec répétition espacée (SM-2)
```
Types de questions :
- Traduction FR → IT (texte)
- Traduction IT → FR (texte)
- Complétion de phrase
- QCM grammatical
- Écoute + transcription (dictée)
- Conjugaison à trou

Logique SM-2 :
- Chaque carte a : intervalle, easeFactor, repetitions
- Réponse correcte facile → intervalle × easeFactor
- Réponse difficile → remise à intervalle 1 jour
- Notifications push programmées via expo-notifications
```

### Module 4 — Dictée & lecture évaluée par IA
```
Flux dictée :
1. ElevenLabs lit un texte B2B en italien à vitesse normale
2. L'utilisateur tape sa transcription
3. Claude compare mot à mot et génère :
   - % de réussite
   - Mots manqués surlignés
   - Explication grammaticale des erreurs

Flux lecture à voix haute :
1. Texte affiché (email pro, script d'appel, extrait de conversation)
2. Utilisateur lit → audio capturé
3. Whisper transcrit → Claude note sur :
   - Précision (mots corrects / total)
   - Forme grammaticale
   - Registre professionnel (tutoiement vs vouvoiement, Lei)
```

---

## Structure des écrans (Expo Router)

```
app/
├── (tabs)/
│   ├── index.tsx          — Dashboard : progression, objectif du jour, streak
│   ├── learn.tsx          — Modules pédagogiques (phases 1-2-3)
│   ├── practice.tsx       — Exercices audio, dictée, lecture
│   ├── call.tsx           — Simulateur d'appel IA temps réel
│   └── progress.tsx       — Statistiques, courbe SM-2, points faibles
├── lesson/[id].tsx        — Leçon individuelle
├── quiz/[moduleId].tsx    — Session de quiz adaptatif
├── call/[scenarioId].tsx  — Simulation d'appel complète
└── onboarding/            — Évaluation niveau initial + configuration objectif
```

---

## UX & design system

- **Langue de l'interface** : français (UI) + italien (contenu pédagogique)
- **Mode sombre** obligatoire (NativeWind dark mode)
- **Typographie** : Inter pour l'UI, taille minimum 14px pour les textes italiens
- **Feedback audio immédiat** : son de validation / erreur sur chaque réponse
- **Animations** : transition fluide entre écrans (react-native-reanimated), micro-animations sur score
- **Accessibilité** : labels aria, contraste AA minimum
- **Offline** : les leçons téléchargées fonctionnent sans connexion (Supabase local cache)

---

## Données & contenu initial à générer

Fournir au minimum :
- 200 cartes SM-2 couvrant la Phase 1 (pronoms, conjugaisons, nombres, phonétique)
- 10 scripts d'appel complets (ouverture → qualification → objection → closing)
- 5 scénarios de simulation IA avec personnalité client définie
- 30 phrases B2B pour exercices de lecture/dictée
- Tous les textes bilingues (FR + IT) avec translittération phonétique

---

## Contraintes & livrables attendus

1. Code TypeScript strict (aucun `any` implicite)
2. Hooks custom documentés avec JSDoc
3. Gestion des erreurs API (Whisper, ElevenLabs, Claude) avec fallback gracieux
4. Tests unitaires sur la logique SM-2 (Jest)
5. README avec instructions d'installation, variables d'environnement requises
6. Schéma Supabase complet (tables : users, cards, sessions, call_reports, progress)
7. Fichier `.env.example` avec toutes les clés nécessaires

---

## Priorité de développement (ordre MVP)

1. Auth Supabase + onboarding niveau
2. Module leçons Phase 1 (grammaire de base) avec TTS expo-speech
3. Quiz SM-2 fonctionnel
4. Intégration Whisper (enregistrement + transcription)
5. Évaluation Claude (prononciation + dictée)
6. Simulateur d'appel IA complet
7. Dashboard progression + notifications push
8. Intégration ElevenLabs (voix italienne naturelle)
