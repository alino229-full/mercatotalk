/**
 * POST /api/quiz-questions
 *
 * Calls Groq (Llama 3.3-70b) to generate contextual Italian B2B quiz items
 * tailored to the learner's weak categories and recent scores.
 *
 * Body: { weakCategories: string[], recentScore: number, count: number }
 * Returns: { items: QuizBankItem[] }
 */

type RequestBody = {
  weakCategories?: string[];
  recentScore?: number;
  count?: number;
};

type GroqMessage = { role: 'system' | 'user'; content: string };
type GroqChoice = { message: { content: string } };
type GroqResponse = { choices?: GroqChoice[] };

export async function POST(request: Request) {
  const groqKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_LLM_MODEL ?? 'llama-3.3-70b-versatile';

  if (!groqKey) {
    return Response.json({ error: 'GROQ_API_KEY manquant.' }, { status: 503 });
  }

  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    // ignore — use defaults
  }

  const count = Math.min(body.count ?? 30, 50);
  const weak = body.weakCategories ?? [];
  const score = body.recentScore ?? 70;

  const focusPart = weak.length > 0
    ? `L'apprenant a des difficultés dans ces catégories : ${weak.join(', ')}.`
    : 'Couvre un mélange équilibré de toutes les catégories.';

  const scorePart = score < 60
    ? 'Propose des questions simples et fondamentales (niveau débutant).'
    : score < 80
    ? 'Propose un mélange de questions de niveau intermédiaire.'
    : 'Propose des questions avancées avec des phrases B2B complètes.';

  const systemPrompt = `Tu es un expert en pédagogie de l'italien B2B pour des agents commerciaux francophones.
Tu génères des quiz de vocabulaire et de grammaire italienne avec contexte commercial (conteneurs habitables, vente B2B).`;

  const userPrompt = `Génère exactement ${count} items de quiz pour un agent commercial français apprenant l'italien B2B.

${focusPart}
${scorePart}

Retourne UNIQUEMENT un tableau JSON valide, sans texte ni code fence, au format suivant :
[
  { "it": "mot ou phrase en italien", "fr": "traduction en français", "phonetic": "[phonétique IPA optionnelle]", "category": "nom_catégorie", "explanation": "[Astuce grammaticale, explication de vocabulaire ou règle de politesse en français, optionnelle]" }
]

Catégories possibles : nombres, conjugaison, verbes, grammaire, phrases, objections, produit, qualification, politesse, délais, géographie.

Règles :
- Les items IT et FR doivent être des paires de traduction directe
- Inclure des phrases B2B complètes (ex: "Le invio il preventivo domani" / "Je vous envoie le devis demain")
- Couvrir au moins 5 catégories différentes
- phonetic est optionnel (inclure seulement pour les mots difficiles)
- explanation est optionnelle mais fortement recommandée pour les phrases B2B, expressions complexes et verbes (fournir une explication utile en français)
- Ne pas répéter les items
- Répondre UNIQUEMENT avec le JSON brut`;

  const messages: GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!groqRes.ok) {
      const detail = await groqRes.text();
      const isRateLimit = groqRes.status === 429;
      return Response.json(
        {
          error: isRateLimit ? 'Quota Groq quotidien atteint.' : 'Groq a refuse la requete.',
          rateLimited: isRateLimit,
          detail,
        },
        { status: groqRes.status },
      );
    }

    const data = (await groqRes.json()) as GroqResponse;
    const raw = data.choices?.[0]?.message?.content ?? '';

    // Groq with json_object mode returns an object, items may be nested
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ error: 'Réponse Groq non JSON.', raw }, { status: 502 });
    }

    // Normalise: Groq may return { items: [...] } or { questions: [...] } or [...]
    let items: unknown[] = [];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      items = (Array.isArray(obj['items']) ? obj['items'] :
               Array.isArray(obj['questions']) ? obj['questions'] :
               Array.isArray(obj['quiz']) ? obj['quiz'] : []) as unknown[];
    }

    // Validate & sanitise each item
    const valid = items
      .filter((item): item is { it: string; fr: string; category: string; phonetic?: string; explanation?: string } => {
        if (!item || typeof item !== 'object') return false;
        const o = item as Record<string, unknown>;
        return typeof o['it'] === 'string' && o['it'].length > 0 &&
               typeof o['fr'] === 'string' && o['fr'].length > 0 &&
               typeof o['category'] === 'string';
      })
      .map((item, idx) => ({
        id: `groq-${Date.now()}-${idx}`,
        it: item.it.trim(),
        fr: item.fr.trim(),
        phonetic: typeof item.phonetic === 'string' && item.phonetic.trim().length > 0
          ? item.phonetic.trim() : undefined,
        category: item.category.trim(),
        explanation: typeof item.explanation === 'string' && item.explanation.trim().length > 0
          ? item.explanation.trim() : undefined,
      }));

    if (valid.length < 4) {
      return Response.json({ error: `Groq a retourné ${valid.length} items valides, trop peu.` }, { status: 502 });
    }

    return Response.json({ items: valid, source: 'groq', count: valid.length });
  } catch (err) {
    return Response.json(
      { error: 'Erreur appel Groq.', detail: err instanceof Error ? err.message : 'Inconnue' },
      { status: 500 },
    );
  }
}
