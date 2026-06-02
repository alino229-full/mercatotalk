import { getServerEnv } from '@/services/server-env';

type GroqMessage = { role: 'system' | 'user'; content: string };
type GroqChoice = { message?: { content?: string } };
type GroqResponse = { choices?: GroqChoice[] };

type RequestBody = {
  lesson?: unknown;
  count?: number;
  seed?: string;
};

type AiQuestion =
  | {
      type: 'ending-choice';
      title: string;
      prompt: string;
      before: string;
      after?: string;
      correct: string;
      choices: string[];
      translation?: string;
      explanation: string;
      speakText?: string;
    }
  | {
      type: 'cloze';
      title: string;
      prompt: string;
      before: string;
      after: string;
      correct: string;
      choices: string[];
      translation?: string;
      explanation: string;
      speakText?: string;
    }
  | {
      type: 'translate';
      prompt: string;
      correct: string;
      choices: string[];
      phonetic?: string;
      speakText?: string;
    }
  | {
      type: 'listen';
      audio: string;
      correct: string;
      choices: string[];
      speakText?: string;
    };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function cleanText(value: unknown, max = 160): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > max) return null;
  return cleaned;
}

function cleanChoices(value: unknown, correct: string): string[] | null {
  if (!Array.isArray(value)) return null;
  const choices = Array.from(
    new Set(
      value
        .map((choice) => cleanText(choice, 48))
        .filter((choice): choice is string => Boolean(choice)),
    ),
  ).slice(0, 4);

  if (!choices.includes(correct)) choices.unshift(correct);
  const unique = Array.from(new Set(choices)).slice(0, 4);
  return unique.length >= 2 ? unique : null;
}

function isShortMobileText(value: string, maxWords = 10): boolean {
  return value.trim().split(/\s+/).length <= maxWords;
}

function startsWithPunctuation(value: string): boolean {
  return /^[,.;:!?)]/.test(value.trimStart());
}

function isShortEnding(value: string): boolean {
  const clean = value.trim().replace(/^-/, '');
  return clean.length <= 2 && /^[\p{L}'’]+$/u.test(clean);
}

function needsWordGap(left: string, right?: string): boolean {
  if (!right) return false;
  if (!left || /\s$/.test(left) || /^\s/.test(right)) return false;
  if (startsWithPunctuation(right)) return false;
  return true;
}

function assembleCompletionText(
  before: string,
  answer: string,
  after: string | undefined,
  mode: 'ending' | 'cloze',
): string {
  const gapBeforeAnswer = mode === 'cloze' || !isShortEnding(answer) ? needsWordGap(before, answer) : false;
  const gapAfterAnswer = needsWordGap(answer, after);
  return `${before}${gapBeforeAnswer ? ' ' : ''}${answer}${after ? `${gapAfterAnswer ? ' ' : ''}${after}` : ''}`;
}

function normalizeLetters(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}'’]/gu, '');
}

function extractQuotedTarget(value: string): string | null {
  const match = value.match(/["“”'‘’]([^"“”'‘’]{2,40})["“”'‘’]/);
  return match?.[1]?.trim() ?? null;
}

function isPronunciationTask(title: string, prompt: string): boolean {
  return /\b(prononciation|prononce|prononcer|phoneme|phonème|son|sons|\[[^\]]+\])\b/i.test(`${title} ${prompt}`);
}

function hasCompatibleTarget({
  assembled,
  prompt,
  speakText,
}: {
  assembled: string;
  prompt: string;
  speakText?: string;
}): boolean {
  const assembledNorm = normalizeLetters(assembled);
  if (!assembledNorm) return false;

  const quotedTarget = extractQuotedTarget(prompt);
  if (quotedTarget) {
    return normalizeLetters(quotedTarget) === assembledNorm;
  }

  if (speakText) {
    const spokenNorm = normalizeLetters(speakText);
    if (spokenNorm.length > 0 && spokenNorm.length <= 24) return spokenNorm === assembledNorm;
  }

  return true;
}

function normalizeQuestion(raw: unknown, index: number, lessonId: string): (AiQuestion & { id: string }) | null {
  if (!isRecord(raw)) return null;
  const type = raw.type;

  if (type === 'ending-choice') {
    const title = cleanText(raw.title, 70);
    const prompt = cleanText(raw.prompt, 140);
    const before = cleanText(raw.before, 80);
    const correct = cleanText(raw.correct, 24);
    const explanation = cleanText(raw.explanation, 220);
    if (!title || !prompt || !before || !correct || !explanation) return null;
    if (isPronunciationTask(title, prompt)) return null;
    const choices = cleanChoices(raw.choices, correct);
    if (!choices) return null;
    const after = cleanText(raw.after, 80) ?? undefined;
    const fallbackSpeakText = assembleCompletionText(before, correct, after, 'ending');
    const providedSpeakText = cleanText(raw.speakText, 120) ?? undefined;
    if (!hasCompatibleTarget({ assembled: fallbackSpeakText, prompt, speakText: providedSpeakText })) return null;
    return {
      id: `ai-${lessonId}-ending-${Date.now()}-${index}`,
      type: 'ending-choice',
      title,
      prompt,
      before,
      after,
      correct,
      choices,
      translation: cleanText(raw.translation, 120) ?? undefined,
      explanation,
      speakText: providedSpeakText ?? fallbackSpeakText,
    };
  }

  if (type === 'cloze') {
    const title = cleanText(raw.title, 70);
    const prompt = cleanText(raw.prompt, 140);
    const before = cleanText(raw.before, 100);
    const after = cleanText(raw.after, 100);
    const correct = cleanText(raw.correct, 40);
    const explanation = cleanText(raw.explanation, 220);
    if (!title || !prompt || !before || !after || !correct || !explanation) return null;
    const choices = cleanChoices(raw.choices, correct);
    if (!choices) return null;
    const fullSentence = assembleCompletionText(before, correct, after, 'cloze');
    if (!isShortMobileText(fullSentence, 12)) return null;
    return {
      id: `ai-${lessonId}-cloze-${Date.now()}-${index}`,
      type: 'cloze',
      title,
      prompt,
      before,
      after,
      correct,
      choices,
      translation: cleanText(raw.translation, 140) ?? undefined,
      explanation,
      speakText: cleanText(raw.speakText, 140) ?? fullSentence,
    };
  }

  if (type === 'translate') {
    const prompt = cleanText(raw.prompt, 90);
    const correct = cleanText(raw.correct, 90);
    if (!prompt || !correct || !isShortMobileText(prompt, 8)) return null;
    const choices = cleanChoices(raw.choices, correct);
    if (!choices) return null;
    return {
      id: `ai-${lessonId}-translate-${Date.now()}-${index}`,
      type: 'translate',
      prompt,
      correct,
      choices,
      phonetic: cleanText(raw.phonetic, 80) ?? undefined,
      speakText: cleanText(raw.speakText, 90) ?? prompt,
    };
  }

  if (type === 'listen') {
    const audio = cleanText(raw.audio, 90);
    const correct = cleanText(raw.correct, 90);
    if (!audio || !correct || !isShortMobileText(audio, 8)) return null;
    const choices = cleanChoices(raw.choices, correct);
    if (!choices) return null;
    return {
      id: `ai-${lessonId}-listen-${Date.now()}-${index}`,
      type: 'listen',
      audio,
      correct,
      choices,
      speakText: cleanText(raw.speakText, 90) ?? audio,
    };
  }

  return null;
}

function extractQuestionArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!isRecord(parsed)) return [];
  if (Array.isArray(parsed.questions)) return parsed.questions;
  if (Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed.quiz)) return parsed.quiz;
  return [];
}

export async function POST(request: Request) {
  const groqKey = getServerEnv('GROQ_API_KEY');
  const model = getServerEnv('GROQ_LLM_MODEL') ?? 'llama-3.3-70b-versatile';

  if (!groqKey) {
    return Response.json({ error: 'GROQ_API_KEY manquant cote serveur.' }, { status: 503, headers: CORS });
  }

  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: 'Corps JSON invalide.' }, { status: 400, headers: CORS });
  }

  const lesson = isRecord(body.lesson) ? body.lesson : null;
  const lessonId = cleanText(lesson?.id, 80) ?? 'lesson';
  const count = Math.max(2, Math.min(body.count ?? 5, 8));
  const seed = cleanText(body.seed, 120) ?? String(Date.now());

  const systemPrompt = `Tu es un concepteur de quiz d'italien pour francophones.
Tu respectes strictement la grammaire italienne. Tu varies les exemples sans inventer de fausse regle.
Tu reponds uniquement en JSON valide, sans markdown.`;

  const userPrompt = `Genere exactement ${count} variations de quiz pour cette lecon.

Lecon compacte:
${JSON.stringify(lesson)}

Seed de variation: ${seed}

Format attendu:
{
  "questions": [
    {
      "type": "ending-choice",
      "title": "titre court",
      "prompt": "consigne en francais",
      "before": "debut du mot ou groupe",
      "after": "suite optionnelle",
      "correct": "-o",
      "choices": ["-o", "-a", "-e"],
      "translation": "traduction optionnelle",
      "explanation": "explication breve en francais",
      "speakText": "mot ou phrase italienne complete"
    },
    {
      "type": "cloze",
      "title": "Ecoutez et completez",
      "prompt": "consigne en francais",
      "before": "Vorrei un'aranciata ",
      "after": ", per favore.",
      "correct": "amara",
      "choices": ["amara", "amaro", "amari"],
      "translation": "Je voudrais une orangeade amere, s'il vous plait.",
      "explanation": "Aranciata est feminin singulier, donc amara.",
      "speakText": "Vorrei un'aranciata amara, per favore."
    },
    {
      "type": "translate",
      "prompt": "phrase italienne courte",
      "correct": "traduction francaise",
      "choices": ["bonne traduction", "distracteur", "distracteur"],
      "speakText": "phrase italienne courte"
    },
    {
      "type": "listen",
      "audio": "phrase italienne courte",
      "correct": "traduction francaise",
      "choices": ["bonne traduction", "distracteur", "distracteur"]
    }
  ]
}

Regles strictes:
- Retourne seulement un objet JSON avec "questions".
- Varie les mots par rapport aux exemples de la lecon, mais reste dans la meme regle.
- Phrases italiennes tres courtes: maximum 8 mots pour translate/listen, maximum 12 mots pour cloze.
- Les choix doivent contenir la bonne reponse.
- Les distracteurs doivent etre plausibles mais pedagogiquement utiles.
- Ne JAMAIS utiliser "ending-choice" pour une question de prononciation, de phoneme ou de son.
- Respecte strictement l'orthographe italienne: pizza = deux z, gnocchi = gn, figlio = gli. Si un mot cible est cite, le mot assemble doit etre exactement ce mot.
- Donne une explication francaise pour ending-choice et cloze.
- Ne genere pas de contenu culturel hors sujet, pas de phrases longues.`;

  const messages: GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.92,
        max_tokens: 2600,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!groqResponse.ok) {
      const detail = await groqResponse.text();
      return Response.json({ error: 'Groq a refuse la requete.', detail }, { status: groqResponse.status, headers: CORS });
    }

    const data = (await groqResponse.json()) as GroqResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return Response.json({ error: 'Reponse Groq vide.' }, { status: 502, headers: CORS });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return Response.json({ error: 'Reponse Groq non JSON.' }, { status: 502, headers: CORS });
    }

    const questions = extractQuestionArray(parsed)
      .map((item, index) => normalizeQuestion(item, index, lessonId))
      .filter((question): question is AiQuestion & { id: string } => Boolean(question))
      .slice(0, count);

    if (questions.length < 2) {
      return Response.json({ error: 'Groq a retourne trop peu de questions valides.' }, { status: 502, headers: CORS });
    }

    return Response.json({ questions, source: 'groq' }, { headers: CORS });
  } catch (error) {
    return Response.json(
      { error: 'Erreur serveur lesson-quiz-variations.', detail: error instanceof Error ? error.message : 'Inconnue' },
      { status: 500, headers: CORS },
    );
  }
}
