import * as SQLite from 'expo-sqlite';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageRole = 'client' | 'learner' | 'coach';

export type ScenarioRow = {
  id: string;
  title: string;
  marketContext: string;
  clientGoal: string;
  clientPersona: string;
  productContext: string;
  successCriteria: string[];
  starterIt: string;
  starterFr: string;
  createdAt: string;
};

export type DialogueMessageRow = {
  id: string;
  scenarioId: string;
  role: MessageRole;
  contentIt: string;
  contentFr: string;
  coachingNote: string | null;
  turnIndex: number;
  createdAt: string;
};

export type CorrectionRow = {
  id: string;
  messageId: string;
  scenarioId: string;
  score: number;
  correctedIt: string;
  feedbackFr: string;
  nextFocus: string[];
  createdAt: string;
};

export type Sm2CardRow = {
  id: string;
  frontIt: string;
  frontFr: string;
  phonetic: string | null;
  exampleIt: string | null;
  category: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  nextReview: number;
  createdAt: string;
};

export type LearningSessionType = 'quiz' | 'lesson' | 'call';

export type LearningSessionRow = {
  id: string;
  sessionType: LearningSessionType;
  durationSeconds: number;
  cardsReviewed: number;
  scoreAvg: number | null;
  createdAt: string;
};

export type XpProfileRow = {
  id: string;
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  updatedAt: string;
};

export type AchievementUnlockRow = {
  achievementId: string;
  unlockedAt: string;
};

export type LessonStatus = 'available' | 'locked' | 'completed';

export type DailyPhrase = {
  date: string;
  it: string;
  fr: string;
  phonetic: string;
  context: string;
  contextEmoji: string;
};

export type LessonProgressRow = {
  lessonId: string;
  status: LessonStatus;
  quizScore: number | null;
  completedAt: string | null;
  updatedAt: string;
};

export type FocusStatRow = {
  focus: string;
  count: number;
  lastSeenAt: string;
};

export type NumberLookupRow = {
  id: string;
  inputValue: string;
  spokenIt: string;
  mode: string;
  createdAt: string;
};

export type CallReplayRow = {
  id: string;
  scenarioId: string;
  title: string;
  audioUri: string;
  durationSeconds: number;
  score: number | null;
  createdAt: string;
};

export type PhonemeStatRow = {
  phoneme: string;
  misses: number;
  attempts: number;
  updatedAt: string;
};

// ─── Internal DB row types (snake_case) ───────────────────────────────────────

type ScenarioDbRow = {
  id: string;
  title: string;
  market_context: string;
  client_goal: string;
  client_persona: string;
  product_context: string;
  success_criteria_json: string;
  starter_it: string;
  starter_fr: string;
  created_at: string;
};

type MessageDbRow = {
  id: string;
  scenario_id: string;
  role: MessageRole;
  content_it: string;
  content_fr: string;
  coaching_note: string | null;
  turn_index: number;
  created_at: string;
};

type CorrectionDbRow = {
  id: string;
  message_id: string;
  scenario_id: string;
  score: number;
  corrected_it: string;
  feedback_fr: string;
  next_focus_json: string;
  created_at: string;
};

type Sm2CardDbRow = {
  id: string;
  front_it: string;
  front_fr: string;
  phonetic: string | null;
  example_it: string | null;
  category: string;
  interval: number;
  ease_factor: number;
  repetitions: number;
  next_review: number;
  created_at: string;
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

function parseJsonArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((i): i is string => typeof i === 'string') : [];
  } catch {
    return [];
  }
}

function mapScenario(row: ScenarioDbRow): ScenarioRow {
  return {
    id: row.id,
    title: row.title,
    marketContext: row.market_context,
    clientGoal: row.client_goal,
    clientPersona: row.client_persona,
    productContext: row.product_context,
    successCriteria: parseJsonArray(row.success_criteria_json),
    starterIt: row.starter_it,
    starterFr: row.starter_fr,
    createdAt: row.created_at,
  };
}

function mapMessage(row: MessageDbRow): DialogueMessageRow {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    role: row.role,
    contentIt: row.content_it,
    contentFr: row.content_fr,
    coachingNote: row.coaching_note,
    turnIndex: row.turn_index,
    createdAt: row.created_at,
  };
}

function mapCorrection(row: CorrectionDbRow): CorrectionRow {
  return {
    id: row.id,
    messageId: row.message_id,
    scenarioId: row.scenario_id,
    score: row.score,
    correctedIt: row.corrected_it,
    feedbackFr: row.feedback_fr,
    nextFocus: parseJsonArray(row.next_focus_json),
    createdAt: row.created_at,
  };
}

function mapSm2Card(row: Sm2CardDbRow): Sm2CardRow {
  return {
    id: row.id,
    frontIt: row.front_it,
    frontFr: row.front_fr,
    phonetic: row.phonetic,
    exampleIt: row.example_it,
    category: row.category,
    interval: row.interval,
    easeFactor: row.ease_factor,
    repetitions: row.repetitions,
    nextReview: row.next_review,
    createdAt: row.created_at,
  };
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Database singleton ───────────────────────────────────────────────────────

const DATABASE_NAME = 'italpro-local.db';
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getItalproDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME)
      .then(async (db) => {
        await migrateDatabase(db);
        await seedScenarios(db);
        await seedSm2Cards(db);
        return db;
      })
      .catch((error) => {
        dbPromise = null;
        throw error;
      });
  }
  return dbPromise;
}

// ─── Schema migrations ────────────────────────────────────────────────────────

async function migrateDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      market_context TEXT NOT NULL,
      client_goal TEXT NOT NULL,
      client_persona TEXT NOT NULL,
      product_context TEXT NOT NULL,
      success_criteria_json TEXT NOT NULL,
      starter_it TEXT NOT NULL,
      starter_fr TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dialogue_messages (
      id TEXT PRIMARY KEY NOT NULL,
      scenario_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('client', 'learner', 'coach')),
      content_it TEXT NOT NULL,
      content_fr TEXT NOT NULL,
      coaching_note TEXT,
      turn_index INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY NOT NULL,
      message_id TEXT NOT NULL,
      scenario_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      corrected_it TEXT NOT NULL,
      feedback_fr TEXT NOT NULL,
      next_focus_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES dialogue_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sm2_cards (
      id TEXT PRIMARY KEY NOT NULL,
      front_it TEXT NOT NULL,
      front_fr TEXT NOT NULL,
      phonetic TEXT,
      example_it TEXT,
      category TEXT NOT NULL,
      interval INTEGER NOT NULL DEFAULT 1,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      repetitions INTEGER NOT NULL DEFAULT 0,
      next_review INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learning_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      session_type TEXT NOT NULL CHECK(session_type IN ('quiz', 'lesson', 'call')),
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      cards_reviewed INTEGER NOT NULL DEFAULT 0,
      score_avg INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS xp_profile (
      id TEXT PRIMARY KEY NOT NULL DEFAULT 'local',
      total_xp INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS achievement_unlocks (
      achievement_id TEXT PRIMARY KEY NOT NULL,
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      lesson_id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('available', 'locked', 'completed')),
      quiz_score INTEGER,
      completed_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS xp_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount INTEGER NOT NULL,
      earned_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS b2b_number_lookups (
      id TEXT PRIMARY KEY NOT NULL,
      input_value TEXT NOT NULL,
      spoken_it TEXT NOT NULL,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_replays (
      id TEXT PRIMARY KEY NOT NULL,
      scenario_id TEXT NOT NULL,
      title TEXT NOT NULL,
      audio_uri TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      score INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS phoneme_stats (
      phoneme TEXT PRIMARY KEY NOT NULL,
      misses INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cached_quiz_items (
      id TEXT PRIMARY KEY NOT NULL,
      it TEXT NOT NULL,
      fr TEXT NOT NULL,
      phonetic TEXT,
      category TEXT NOT NULL,
      explanation TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cached_client_replies (
      id TEXT PRIMARY KEY NOT NULL,
      scenario_id TEXT NOT NULL,
      mood TEXT NOT NULL,
      topic TEXT NOT NULL,
      content_it TEXT NOT NULL,
      content_fr TEXT NOT NULL,
      coaching_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cached_guided_choices (
      id TEXT PRIMARY KEY NOT NULL,
      scenario_id TEXT NOT NULL,
      mood TEXT NOT NULL,
      topic TEXT NOT NULL,
      choices_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_scenario_turn ON dialogue_messages(scenario_id, turn_index);
    CREATE INDEX IF NOT EXISTS idx_corrections_scenario_created ON corrections(scenario_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sm2_next_review ON sm2_cards(next_review);
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON learning_sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_lesson_progress_status ON lesson_progress(status);
    CREATE INDEX IF NOT EXISTS idx_xp_log_earned_at ON xp_log(earned_at);
    CREATE INDEX IF NOT EXISTS idx_number_lookups_created ON b2b_number_lookups(created_at);
    CREATE INDEX IF NOT EXISTS idx_call_replays_created ON call_replays(created_at);
    CREATE INDEX IF NOT EXISTS idx_cached_quiz_category ON cached_quiz_items(category);
    CREATE INDEX IF NOT EXISTS idx_cached_client_replies ON cached_client_replies(scenario_id, mood, topic);
    CREATE INDEX IF NOT EXISTS idx_cached_guided_choices ON cached_guided_choices(scenario_id, mood, topic);
  `);
}

// ─── Seed: scenarios ──────────────────────────────────────────────────────────

async function seedScenarios(db: SQLite.SQLiteDatabase): Promise<void> {
  const seedDate = '2026-04-25T00:00:00.000Z';

  const scenarios = [
    {
      id: 'container-20-habitable',
      title: 'Container 20 pieds habitable',
      market_context: 'Vente B2B/B2C de modules habitables fabriques a partir de containers maritimes 20 pieds.',
      client_goal: 'Obtenir des informations concretes sur prix, isolation, livraison, garanties avant de demander un devis.',
      client_persona: 'Mario Conti, 48 ans, directeur travaux PME italienne. Pragmatique, un peu meprisant, tres sensible au prix. Pose des questions techniques precises.',
      product_context: 'Container 20 pieds: 6,06 m x 2,44 m, amenage en bureau ou logement temporaire. Options: isolation, electricite, fenetre baie vitree, cuisine compacte, salle d eau.',
      success_criteria: ['Utiliser Lei correctement', 'Rassurer sur le confort', 'Donner une fourchette de prix', 'Proposer un devis ou une visite'],
      starter_it: 'Buongiorno, ho visto i vostri container abitabili da 20 piedi. Vorrei capire se possono essere davvero comodi e affidabili.',
      starter_fr: 'Bonjour, j\'ai vu vos containers habitables. Je voudrais comprendre s\'ils peuvent vraiment etre confortables et fiables.',
    },
    {
      id: 'relance-devis-b2b',
      title: 'Relance devis B2B - flotte',
      market_context: 'Prospection B2B apres envoi d\'une proposition commerciale il y a 10 jours, sans reponse.',
      client_goal: 'Verifier l\'interet du prospect, lever les objections prix et obtenir une date de decision.',
      client_persona: 'Giulia Ferretti, responsable achats, 38 ans. Pressée, directe, compare plusieurs fournisseurs. Objecte systematiquement sur le prix.',
      product_context: 'Devis pour 3 containers amenages pour un site de construction. Contrat annuel, support dedie, delais courts.',
      success_criteria: ['Reformuler l\'objection', 'Rester poli avec Lei', 'Demander une date de decision', 'Proposer un geste commercial'],
      starter_it: 'Buongiorno, ho ricevuto il vostro preventivo, ma sto valutando anche altri fornitori. Onestamente, mi sembra un po\' caro.',
      starter_fr: 'Bonjour, j\'ai recu votre devis, mais j\'evalue aussi d\'autres fournisseurs. Franchement, c\'est un peu cher.',
    },
    {
      id: 'prospection-froide',
      title: 'Prospection froide - premiere prise de contact',
      market_context: 'Premier appel sortant vers un prospect qui ne connait pas l\'entreprise. Secteur BTP italien.',
      client_goal: 'Qualifier le besoin, susciter l\'interet et obtenir un rendez-vous ou l\'accord pour envoyer une documentation.',
      client_persona: 'Luca Bianchi, chef de chantier, 52 ans. Occupe, un peu mefiant envers les commerciaux inconnus. Repond brievement.',
      product_context: 'Solutions modulaires (containers, prefabriques) pour installations de chantier: bureaux, vestiaires, sanitaires.',
      success_criteria: ['Se presenter clairement avec Lei', 'Qualifier le besoin en posant une question', 'Ne pas promettre sans savoir', 'Obtenir un accord pour la suite'],
      starter_it: 'Pronto? Chi parla? Non la conosco. Cosa vuole?',
      starter_fr: 'Allo ? Qui est-ce ? Je ne vous connais pas. Que voulez-vous ?',
    },
    {
      id: 'objection-budget',
      title: 'Objection budget - negociation seree',
      market_context: 'Le client a deja manifeste son interet mais bloque sur le prix. Negociation en cours.',
      client_goal: 'Obtenir une remise significative ou des conditions de paiement avantageuses. Tenter un 20% de remise.',
      client_persona: 'Francesco Russo, gerant de PME, 44 ans. Fin negociateur, connait bien le marche. Utilise le silence comme technique.',
      product_context: 'Container 40 pieds amenage en showroom mobile pour le client. Budget client annonce: 8.000 euros, prix devis: 11.500 euros.',
      success_criteria: ['Valoriser l\'offre avant de ceder', 'Proposer une contrepartie a la remise', 'Ne pas brader sous 10.000', 'Maintenir la relation avec Lei'],
      starter_it: 'Guardi, il Suo preventivo e\' troppo alto. Ho un budget di ottomila euro, non di piu\'. Se non riesce ad avvicinarsi, vado da un concorrente.',
      starter_fr: 'Ecoutez, votre devis est trop eleve. J\'ai un budget de 8.000 euros, pas plus. Si vous ne pouvez pas vous rapprocher, je vais chez un concurrent.',
    },
    {
      id: 'confirmation-commande',
      title: 'Confirmation de commande et logistique',
      market_context: 'La vente est conclue. Appel pour confirmer les details de la commande et organiser la livraison.',
      client_goal: 'Confirmer les specifications techniques, la date de livraison et les modalites de paiement.',
      client_persona: 'Elena Marino, assistante de direction, 35 ans. Organisee, precise, veut tout par ecrit. Pas de mauvaise surprise.',
      product_context: 'Commande validee: 2 containers 20 pieds bureaux. Livraison site Bologna. Paiement 30% avance, 70% a la livraison.',
      success_criteria: ['Confirmer les specs sans ambiguite', 'Annoncer la date de livraison avec Lei', 'Expliquer les etapes de paiement', 'Proposer un email recapitulatif'],
      starter_it: 'Buongiorno, La chiamo per confermare i dettagli del nostro ordine. Voglio essere sicura che tutto sia chiaro prima della consegna.',
      starter_fr: 'Bonjour, je vous appelle pour confirmer les details de notre commande. Je veux etre sure que tout est clair avant la livraison.',
    },
    {
      id: 'relance-email-cold',
      title: 'Suivi email sans reponse',
      market_context: 'Appel de suivi apres un email commercial envoye il y a 7 jours sans reponse du prospect.',
      client_goal: 'Verifier si l\'email a ete lu, comprendre le blocage et relancer l\'interet du prospect.',
      client_persona: 'Stefano Caruso, responsable logistique, 41 ans. Tres occupe, oublie souvent de repondre. Peut devenir interesse si on sait capter son attention rapidement.',
      product_context: 'Email envoye presentant des containers refrigeres pour stockage pharmaceutique. Sans reponse depuis 7 jours.',
      success_criteria: ['Se rappeler au bon souvenir poliment', 'Qualifier si l\'email a ete lu', 'Relancer avec un argument nouveau', 'Obtenir un engagement concret'],
      starter_it: 'Pronto, mi dica. Ah, MercatoTalk... aspetti, non ricordo bene questa email. Di cosa si tratta esattamente?',
      starter_fr: 'Allo, j\'ecoute. Ah, MercatoTalk... attendez, je ne me souviens pas bien de cet email. De quoi s\'agit-il exactement ?',
    },
    {
      id: 'salon-btp',
      title: 'Rencontre salon BTP Milano',
      market_context: 'Rencontre sur un salon professionnel. Le contact est present mais presse — il passe devant le stand.',
      client_goal: 'Capter l\'attention en 2 minutes, qualifier le besoin et obtenir un rendez-vous commercial.',
      client_persona: 'Antonio Mancini, directeur general BTP, 55 ans. Tres sollicite sur le salon. Veut des chiffres concrets tres rapidement.',
      product_context: 'Stand MercatoTalk a Expo Edilizia Milano. Containers 20 et 40 pieds amenages pour le BTP. Promo salon: -10% si commande sous 30 jours.',
      success_criteria: ['Pitcher en moins de 3 echanges', 'Mentionner la promo salon', 'Poser une question qualifiante', 'Obtenir un RDV ou une carte'],
      starter_it: 'Ho visto il vostro stand. Avete qualcosa di interessante? Ho solo due minuti, pero\'.',
      starter_fr: 'J\'ai vu votre stand. Vous avez quelque chose d\'interessant ? J\'ai seulement deux minutes.',
    },
    {
      id: 'client-mecontent',
      title: 'Client mecontent - retard livraison',
      market_context: 'Le client appelle car sa livraison a 5 jours de retard. Il est en colere et menace de rompre le contrat.',
      client_goal: 'Calmer le client, expliquer la situation sans fausses excuses et proposer une solution concrete.',
      client_persona: 'Roberto Vitale, chef de projet, 46 ans. Tres stresse, ton eleve. A des penalites de retard avec son propre client. Veut des actions immediates.',
      product_context: 'Livraison de 3 containers bureau a Naples. Retard de 5 jours cause par une greve portuaire. Alternative: livraison par route depuis depot Paris.',
      success_criteria: ['Ne pas s\'excuser sans proposer de solution', 'Expliquer la cause du retard clairement', 'Proposer une alternative concrete', 'Garder le Lei et la politesse sous pression'],
      starter_it: 'Mi dica una cosa! Dove sono i miei container? Avrei dovuto averli gia\' lunedi\'. Questo ritardo mi sta costando soldi!',
      starter_fr: 'Dites-moi une chose ! Ou sont mes containers ? J\'aurais du les avoir lundi. Ce retard me coute de l\'argent !',
    },
    {
      id: 'renouvellement-contrat',
      title: 'Renouvellement contrat annuel',
      market_context: 'Appel proactif pour renouveler un contrat de location arrivant a echeance dans 3 semaines.',
      client_goal: 'Confirmer le renouvellement, proposer une evolution de l\'offre et fideliser le client long terme.',
      client_persona: 'Claudia Ricci, directrice administrative, 39 ans. Satisfaite du service, cherche a optimiser les couts. Apprecie la relation etablie.',
      product_context: 'Client fidele depuis 2 ans. Location de 2 containers 20 pieds. Contrat actuel: 480 euros/mois. Possible upgrade vers container 40 pieds.',
      success_criteria: ['Valoriser la relation existante', 'Proposer une evolution de l\'offre', 'Obtenir confirmation de renouvellement', 'Mentionner la fidelite comme avantage'],
      starter_it: 'Buongiorno Pierre, prevedevo la Sua chiamata. Il contratto scade tra poco. Cosa mi propone per il rinnovo?',
      starter_fr: 'Bonjour Pierre, je m\'attendais a votre appel. Le contrat expire bientot. Que me proposez-vous pour le renouvellement ?',
    },
    {
      id: 'secteur-pharma',
      title: 'Stockage pharma - containers refrigeres',
      market_context: 'Prospect dans le secteur pharmaceutique cherchant des solutions de stockage temporaire refrigere.',
      client_goal: 'Comprendre les exigences techniques, rassurer sur la conformite et proposer des containers frigorifiques adaptes.',
      client_persona: 'Dott.ssa Serena Fontana, directrice qualite laboratoire, 43 ans. Tres exigeante sur les normes. Questions techniques tres precises sur les certifications.',
      product_context: 'Containers refrigeres 20 pieds: temperature +2 a +25C, certification ATP, monitoring IoT. Conformes GMP et GDP. Location ou vente.',
      success_criteria: ['Utiliser le titre Dottoressa correctement', 'Mentionner les certifications ATP et GDP', 'Proposer une visite technique', 'Ne pas improviser sur les specs'],
      starter_it: 'Buongiorno, sono la responsabile qualita. Ci servono soluzioni di stoccaggio per prodotti farmaceutici. Quali certificazioni avete esattamente?',
      starter_fr: 'Bonjour, je suis la responsable qualite. Nous avons besoin de stockage pour produits pharmaceutiques. Quelles certifications avez-vous exactement ?',
    },
    {
      id: 'distributeur-italie',
      title: 'Proposition partenariat distributeur',
      market_context: 'Appel pour proposer un accord de distribution exclusive en Sicile et Sardaigne a un entrepreneur local.',
      client_goal: 'Presenter le programme partenaire, qualifier l\'interet et obtenir un rendez-vous direction.',
      client_persona: 'Salvatore Greco, entrepreneur 50 ans, Palermo. Gere une activite de location materiel BTP. Interesse par la diversification mais prudent et negocie tout.',
      product_context: 'Programme partenaire MercatoTalk: marge 18%, support marketing, formation commerciale, exclusivite regionale 3 ans. Minimum 5 unites vendues/an.',
      success_criteria: ['Pitcher le partenariat sans survendre', 'Mentionner l\'exclusivite regionale', 'Qualifier le volume potentiel', 'Proposer un RDV avec la direction'],
      starter_it: 'Buongiorno. Mi ha contattato per una proposta di partnership, ho capito bene? Di che si tratta esattamente?',
      starter_fr: 'Bonjour. Vous m\'avez contacte pour une proposition de partenariat, c\'est bien ca ? De quoi s\'agit-il ?',
    },
    {
      id: 'client-arnaque',
      title: 'Client mefiant — peur d\'arnaque',
      market_context: 'Le marche des containers d\'occasion est infeste d\'arnaques en ligne. Le client a vu des temoignages negatifs sur des forums et est tres mefiant.',
      client_goal: 'Rassurer completement un client mefiant sur la legitimite de l\'entreprise, le processus d\'achat et les garanties avant tout engagement.',
      client_persona: 'Marco Pellegrini, 51 ans, artisan independant. A failli se faire arnaquer sur un site marketplace. Pose des questions pieges, demande des preuves a chaque affirmation.',
      product_context: 'MercatoTalk: societe francaise fondee en 2009, SIRET et TVA intracommunautaire visibles, photos reelles des unites disponibles avant achat, inspection physique possible, garantie contractuelle 12 mois, paiement par virement avec confirmation ecrite et bon de commande. References de 200+ clients en Italie disponibles sur demande.',
      success_criteria: ['Citer des preuves concretes (SIRET, anciennete, references)', 'Proposer une inspection avant tout paiement', 'Expliquer le processus de paiement securise', 'Garder le calme et le Lei face aux accusations'],
      starter_it: 'Senta, ho visto molte truffe online con i container usati. Come faccio a sapere che non siete anche voi dei truffatori? Ho bisogno di garanzie serie prima di parlare di soldi.',
      starter_fr: 'Ecoutez, j\'ai vu beaucoup d\'arnaques en ligne avec les containers d\'occasion. Comment puis-je savoir que vous n\'etes pas des arnaqueurs ? J\'ai besoin de garanties serieuses avant de parler d\'argent.',
    },
    {
      id: 'piscine-container',
      title: 'Container piscine — toutes les questions techniques',
      market_context: 'Marche en croissance des piscines fabriquees a partir de containers maritimes. Le client a vu des realisations sur les reseaux sociaux et veut tous les details.',
      client_goal: 'Obtenir des informations completes sur la piscine container: nage a contre-courant, filtration, pompe, installation, isolation, entretien et prix tout compris.',
      client_persona: 'Gianni Esposito, 44 ans, proprietaire d\'une villa en Toscane. Passionné de natation competive, veut un lap pool de qualite. Pose des questions tres precises et techniques.',
      product_context: 'Container 40 pieds piscine: plan d\'eau 11m x 2,35m x 1,35m. Options: systeme nage a contre-courant (1,5 a 3 kW reglable vitesse), pompe filtration cartouche 8m3/h, pompe a chaleur air/eau (economique), traitement automatique sel ou chlore liquide, liner arme 75/100 (choix couleurs), eclairage LED RGB subaquatique, isolation XPS 120mm exterieur + mousse PU interieur, echelle inox, bache securite. Installation: plots beton reglables ou dalle. Raccordement eau et electrique triphasé. Livraison cles en main 4 a 6 semaines. Prix: 18.000 a 32.000 euros selon options.',
      success_criteria: ['Expliquer le systeme de nage a contre-courant et sa puissance', 'Preciser la consommation electrique mensuelle estimee', 'Decrire etapes d\'installation (dalle, raccordements)', 'Donner une fourchette de prix complete'],
      starter_it: 'Buongiorno, ho visto delle piscine fatte con container marittimi e mi sembra un\'idea fantastica. Ma ho molte domande tecniche: si puo\' nuotare controcorrente? Come funziona il filtraggio? Cosa devo sapere sull\'installazione?',
      starter_fr: 'Bonjour, j\'ai vu des piscines faites avec des containers maritimes et ca me semble une idee fantastique. Mais j\'ai beaucoup de questions techniques : peut-on nager a contre-courant ? Comment fonctionne la filtration ? Que dois-je savoir sur l\'installation ?',
    },
    {
      id: 'habitable-autorisation',
      title: 'Container habitable — autorisations et installation',
      market_context: 'Le client veut installer un container habitable comme bureau de jardin ou logement. Il est bloque par les questions reglementaires italiennes et les details d\'installation.',
      client_goal: 'Obtenir des reponses claires sur les autorisations necessaires (CILA, permesso), fondations, raccordements eau/electrique/assainissement et conformite.',
      client_persona: 'Isabella Ricci, 37 ans, architecte paysagiste. Tres documentee, connait les termes reglementaires italiens. Veut tout savoir avant d\'engager des frais. Cherche la certitude juridique.',
      product_context: 'Container habitable 20 pieds (36 m2) amenage bureau professionnel. Reglementation italienne: installation temporaire inferieure a 90 jours sans titre, de 90j a 3 ans avec CILA asseverata; au-dela: permesso di costruire obligatoire. Fondations: plots reglables acier galvanise (pas de dalle si terrain stable) ou dalle beton 15cm. Raccordements: electrique (quadro certificato IMQ), eau potable (attacco 3/4 pouce), evacuations (fosse biologica prefabbricata ou raccordement reseau). Isolation conforme NTC: plancher laine de roche 100mm, parois 80mm, plafond 120mm. Livraison et pose par equipe certifiee. Delai 3 a 5 semaines.',
      success_criteria: ['Clarifier CILA vs permesso selon la duree d\'installation', 'Expliquer options fondations (plots vs dalle)', 'Detailler chaque raccordement necessaire', 'Confirmer conformite reglementaire italienne'],
      starter_it: 'Buongiorno, vorrei installare un container abitabile come studio professionale nel mio giardino. Ma ho paura della burocrazia: ci vuole il permesso di costruire? Cosa serve per i fondamenti e per i collegamenti con acqua e luce?',
      starter_fr: 'Bonjour, je voudrais installer un container habitable comme studio professionnel dans mon jardin. Mais j\'ai peur de la bureaucratie : faut-il un permis de construire ? Que faut-il pour les fondations et les raccordements eau et electricite ?',
    },
    {
      id: 'container-stockage-standard',
      title: 'Container stockage — achat ou location',
      market_context: 'PME cherchant une solution de stockage supplementaire. Hesite entre achat et location, container neuf et d\'occasion.',
      client_goal: 'Comparer les options 20 et 40 pieds, neuf vs occasion, achat vs location, et obtenir un devis rapidement.',
      client_persona: 'Piero Gallo, responsable logistique PME, 48 ans. Direct et pragmatique, sait ce qu\'il veut. Compare plusieurs fournisseurs en parallele. Focalise sur le rapport qualite/prix et les delais.',
      product_context: 'Containers standard: 20 pieds (volume 33 m3, charge utile 28t, dimensions int. 5,90 x 2,35 x 2,39m) et 40 pieds (67 m3, charge utile 26,5t, 12m x 2,35 x 2,39m). Grades: One-Way (neuf, 1 seul voyage), Grade A (< 5 ans, quelques traces superficielles), Grade B (fonctionnel, rouille superficielle traitee). Certification IICL, rapport inspection photos fourni. Achat: 2.100 eur (20\' gr.A) a 6.200 eur (40\' One-Way). Location: 85 a 190 eur/mois selon taille et duree. Livraison 48h si stock dispo, sinon 2 semaines.',
      success_criteria: ['Expliquer clairement les grades A/B/One-Way', 'Comparer achat vs location avec chiffres', 'Donner des prix precis par categorie', 'Confirmer disponibilite et delai 48h'],
      starter_it: 'Buongiorno. Ho bisogno di un container per stoccaggio, probabilmente un 20 piedi ma forse anche un 40. Usato va bene purche\' sia in buone condizioni. Conviene comprare o affittare? Quanto costa?',
      starter_fr: 'Bonjour. J\'ai besoin d\'un container pour du stockage, probablement un 20 pieds mais peut-etre aussi un 40. D\'occasion ca m\'ira tant qu\'il est en bon etat. Vaut-il mieux acheter ou louer ? Combien ca coute ?',
    },
    {
      id: 'frigo-restauration',
      title: 'Container frigo — chambre froide restauration',
      market_context: 'Restaurateur cherchant une extension frigorifique temporaire pour la saison estivale ou un evenement gastronomique.',
      client_goal: 'Obtenir une chambre froide provisoire operationnelle rapidement, aux bonnes temperatures, conforme aux normes alimentaires HACCP.',
      client_persona: 'Chef Maurizio Bianchi, 42 ans, proprietaire d\'un restaurant gastronomique a Verone. Tres exigeant sur la conservation des aliments. Presse car saison haute approche dans 3 semaines.',
      product_context: 'Container frigorifique 20 pieds restauration: groupe froid Carrier ou Thermo King (plage -25C a +10C), certification ATP categorie A, revetement interieur inox 304 alimentaire conforme HACCP, eclairage LED, sonde de temperature avec alarme, acces internet monitoring via app mobile. Options: groupe electrogene 15 kVA integre (autonomie 72h), rayonnages inox. Branchement monophase 32A ou triphase. Mise en service en 24h apres livraison. Location saison 3-6 mois: 480 a 650 eur/mois. Vente: 12.000 a 16.000 eur.',
      success_criteria: ['Confirmer conformite HACCP et ATP pour la restauration', 'Clarifier la plage de temperature recommandee (+2 a +4C pour frais)', 'Donner le delai de mise en service 24h', 'Proposer la location courte duree adaptee a la saison'],
      starter_it: 'Buongiorno, sono un ristoratore. Ho bisogno urgente di una cella frigorifera supplementare per questa estate. Ho sentito che si possono usare container refrigerati. E\' adatto per la ristorazione? Rispetta le norme igieniche?',
      starter_fr: 'Bonjour, je suis restaurateur. J\'ai besoin d\'urgence d\'une chambre froide supplementaire pour cet ete. J\'ai entendu que l\'on peut utiliser des containers refrigeres. Est-ce adapte pour la restauration ? Ca respecte les normes hygieniques ?',
    },
    {
      id: 'remorque-mobile',
      title: 'Container sur remorque — solution evenementielle mobile',
      market_context: 'Client organisateur d\'evenements cherchant une solution entierement mobile et deployable rapidement sur differents sites italiens.',
      client_goal: 'Comprendre les options containers sur remorque: permis necessaire, homologation route, temps de deploiement, amenagements possibles et prix.',
      client_persona: 'Diego Ferri, 38 ans, entrepreneur evenementiel. Organise des festivals et marches artisanaux en Italie. Veut un bar ou une boutique itinerante autonome. Tres sensible a la logistique et a la rapidite.',
      product_context: 'Solutions mobiles MercatoTalk: container 20 piedi sur chassis remorque homologue (PTAC 2,8t, patente B suffit). Container 40 piedi sur semi-remorque (patente CE, transport par notre prestataire a 350 eur). Amenagement evenementiel: comptoir rabattable, vitrine eclairee, prises 220V CEE, eclairage LED interieur/exterieur, store banne lateral 3m, habillage personnalise. Deploiement en 25 a 45 minutes. Homologation routiere europeenne (COC fourni). Location evenement (weekend a 3 mois): 380 a 680 eur/semaine. Achat: 15.000 a 22.000 eur equipé.',
      success_criteria: ['Clarifier le permis selon le PTAC (B vs CE)', 'Decrire le temps de deploiement et processus', 'Presenter au moins 2 exemples d\'amenagement evenementiel', 'Donner prix location vs achat'],
      starter_it: 'Buongiorno, organizzo eventi e festival in tutta Italia. Mi serve qualcosa di completamente mobile: un bar o un negozio su ruote, per spostarmi da una citta all\'altra. Ho sentito parlare di container su rimorchio. E\' fattibile? Che patente ci vuole?',
      starter_fr: 'Bonjour, j\'organise des evenements et festivals dans toute l\'Italie. J\'ai besoin de quelque chose de completement mobile : un bar ou une boutique sur roues, pour me deplacer de ville en ville. J\'ai entendu parler de containers sur remorque. C\'est faisable ? Quel permis faut-il ?',
    },
  ];

  for (const s of scenarios) {
    await db.runAsync(
      `INSERT OR IGNORE INTO scenarios
        (id, title, market_context, client_goal, client_persona, product_context, success_criteria_json, starter_it, starter_fr, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.title, s.market_context, s.client_goal, s.client_persona, s.product_context, JSON.stringify(s.success_criteria), s.starter_it, s.starter_fr, seedDate],
    );
  }
}

// ─── Seed: SM-2 cards ─────────────────────────────────────────────────────────

async function seedSm2Cards(db: SQLite.SQLiteDatabase): Promise<void> {
  // No early-return: INSERT OR IGNORE so new cards are added without losing SM-2 progress
  type SC = { id: string; frontIt: string; frontFr: string; phonetic?: string; exampleIt?: string; category: string };

  const cards: SC[] = [
    // Pronoms
    { id: 'pron-01', frontIt: 'io', frontFr: 'je / moi', phonetic: '[io]', exampleIt: 'Io sono Pierre.', category: 'pronoms' },
    { id: 'pron-02', frontIt: 'tu', frontFr: 'tu (familier)', phonetic: '[tu]', exampleIt: 'Tu parli italiano?', category: 'pronoms' },
    { id: 'pron-03', frontIt: 'lei / lui', frontFr: 'elle / il', phonetic: '[lɛi] / [lui]', category: 'pronoms' },
    { id: 'pron-04', frontIt: 'Lei (formel)', frontFr: 'vous (vouvoiement)', phonetic: '[lɛi]', exampleIt: 'Come sta, Lei?', category: 'pronoms' },
    { id: 'pron-05', frontIt: 'noi', frontFr: 'nous', phonetic: '[nɔi]', exampleIt: 'Noi siamo una societa francese.', category: 'pronoms' },
    { id: 'pron-06', frontIt: 'voi', frontFr: 'vous (pluriel)', phonetic: '[vɔi]', category: 'pronoms' },
    { id: 'pron-07', frontIt: 'loro', frontFr: 'ils / elles', phonetic: '[lɔːro]', exampleIt: 'Loro sono i nostri clienti.', category: 'pronoms' },

    // Salutations
    { id: 'greet-01', frontIt: 'Buongiorno', frontFr: 'Bonjour (le matin)', phonetic: '[bwɔnˈdʒorno]', exampleIt: 'Buongiorno, sono Pierre di MercatoTalk.', category: 'salutations' },
    { id: 'greet-02', frontIt: 'Buonasera', frontFr: 'Bonsoir', phonetic: '[bwɔnaˈsɛːra]', exampleIt: 'Buonasera, come sta?', category: 'salutations' },
    { id: 'greet-03', frontIt: 'Arrivederci', frontFr: 'Au revoir (formel)', phonetic: '[arriːveˈdɛrtʃi]', exampleIt: 'Arrivederci, a presto!', category: 'salutations' },
    { id: 'greet-04', frontIt: 'Grazie', frontFr: 'Merci', phonetic: '[ˈgraːttsje]', exampleIt: 'Grazie per il Suo tempo.', category: 'salutations' },
    { id: 'greet-05', frontIt: 'Prego', frontFr: 'De rien / Je vous en prie', phonetic: '[ˈprɛːɡo]', exampleIt: 'Prego, non c\'e problema.', category: 'salutations' },
    { id: 'greet-06', frontIt: 'Come sta?', frontFr: 'Comment allez-vous ? (formel)', phonetic: '[ˈkoːme ˈstaː]', exampleIt: 'Buongiorno, come sta?', category: 'salutations' },

    // Verbes
    { id: 'verb-01', frontIt: 'sono', frontFr: 'je suis (essere)', phonetic: '[ˈsoːno]', exampleIt: 'Sono Pierre, di MercatoTalk.', category: 'verbes' },
    { id: 'verb-02', frontIt: 'e\'', frontFr: 'il/elle est / vous etes (Lei)', phonetic: '[ɛ]', exampleIt: 'Il prezzo e\' competitivo.', category: 'verbes' },
    { id: 'verb-03', frontIt: 'siamo', frontFr: 'nous sommes', phonetic: '[ˈsjaːmo]', exampleIt: 'Siamo specialisti del settore.', category: 'verbes' },
    { id: 'verb-04', frontIt: 'ho', frontFr: 'j\'ai (avere)', phonetic: '[ɔ]', exampleIt: 'Ho ricevuto la Sua email.', category: 'verbes' },
    { id: 'verb-05', frontIt: 'ha', frontFr: 'il/elle a / vous avez (Lei)', phonetic: '[a]', exampleIt: 'Ha gia\' visto il nostro catalogo?', category: 'verbes' },
    { id: 'verb-06', frontIt: 'vorrei', frontFr: 'je voudrais', phonetic: '[vorˈrɛi]', exampleIt: 'Vorrei parlarLe della nostra offerta.', category: 'verbes' },
    { id: 'verb-07', frontIt: 'posso', frontFr: 'je peux', phonetic: '[ˈpɔsso]', exampleIt: 'Posso inviarLe il preventivo oggi.', category: 'verbes' },
    { id: 'verb-08', frontIt: 'devo', frontFr: 'je dois', phonetic: '[ˈdɛːvo]', exampleIt: 'Devo verificare con il mio team.', category: 'verbes' },

    // B2B essentiel
    { id: 'b2b-01', frontIt: 'il preventivo', frontFr: 'le devis', phonetic: '[il preˈvɛːntivo]', exampleIt: 'Posso inviarLe il preventivo?', category: 'b2b' },
    { id: 'b2b-02', frontIt: 'il prezzo', frontFr: 'le prix', phonetic: '[il ˈprɛttso]', exampleIt: 'Il prezzo include l\'installazione.', category: 'b2b' },
    { id: 'b2b-03', frontIt: 'il contenitore', frontFr: 'le conteneur', phonetic: '[il konteˈniːtore]', exampleIt: 'Il contenitore e\' disponibile.', category: 'b2b' },
    { id: 'b2b-04', frontIt: 'la consegna', frontFr: 'la livraison', phonetic: '[la konˈseɲɲa]', exampleIt: 'La consegna e\' prevista per marzo.', category: 'b2b' },
    { id: 'b2b-05', frontIt: 'il contratto', frontFr: 'le contrat', phonetic: '[il konˈtratto]', exampleIt: 'Possiamo firmare il contratto.', category: 'b2b' },
    { id: 'b2b-06', frontIt: 'l\'offerta', frontFr: 'l\'offre', phonetic: '[lofˈfɛrta]', exampleIt: 'La nostra offerta e\' vantaggiosa.', category: 'b2b' },
    { id: 'b2b-07', frontIt: 'le garanzie', frontFr: 'les garanties', phonetic: '[le ɡaranˈtsiːe]', exampleIt: 'Le garanzie coprono due anni.', category: 'b2b' },
    { id: 'b2b-08', frontIt: 'il pagamento', frontFr: 'le paiement', phonetic: '[il paɡaˈmɛnto]', exampleIt: 'Il pagamento e\' a 30 giorni.', category: 'b2b' },
    { id: 'b2b-09', frontIt: 'lo sconto', frontFr: 'la remise / le rabais', phonetic: '[lo ˈskonto]', exampleIt: 'Possiamo offrire uno sconto del 5%.', category: 'b2b' },
    { id: 'b2b-10', frontIt: 'la scadenza', frontFr: 'le delai / l\'echeance', phonetic: '[la skaˈdɛntsa]', exampleIt: 'Qual e\' la scadenza del progetto?', category: 'b2b' },
    { id: 'b2b-11', frontIt: 'il fornitore', frontFr: 'le fournisseur', phonetic: '[il forniˈtoːre]', exampleIt: 'Siamo un fornitore affidabile da 15 anni.', category: 'b2b' },
    { id: 'b2b-12', frontIt: 'l\'ordine', frontFr: 'la commande', phonetic: '[lˈɔrdine]', exampleIt: 'L\'ordine e\' stato confermato.', category: 'b2b' },
    { id: 'b2b-13', frontIt: 'la fattura', frontFr: 'la facture', phonetic: '[la ˈfattuːra]', exampleIt: 'Le invio la fattura pro forma.', category: 'b2b' },
    { id: 'b2b-14', frontIt: 'il budget', frontFr: 'le budget', exampleIt: 'Qual e\' il Suo budget indicativo?', category: 'b2b' },
    { id: 'b2b-15', frontIt: 'la trattativa', frontFr: 'la negociation', phonetic: '[la tratˈtaːtiva]', exampleIt: 'Siamo aperti alla trattativa.', category: 'b2b' },
    { id: 'b2b-16', frontIt: 'la proposta', frontFr: 'la proposition commerciale', phonetic: '[la proˈpɔsta]', exampleIt: 'Le mando la nostra proposta domani.', category: 'b2b' },

    // B2B technique container / logistique / legal / finance
    { id: 'tech-20', frontIt: 'container da 20 piedi', frontFr: 'container 20 pieds', exampleIt: 'Un container da 20 piedi misura circa 6 metri.', category: 'tech_container' },
    { id: 'tech-40', frontIt: 'container da 40 piedi', frontFr: 'container 40 pieds', exampleIt: 'Il container da 40 piedi offre piu spazio utile.', category: 'tech_container' },
    { id: 'tech-hc', frontIt: 'High Cube', frontFr: 'container plus haut', exampleIt: 'Il modello High Cube e piu alto dello standard.', category: 'tech_container' },
    { id: 'tech-os', frontIt: 'Open Side', frontFr: 'ouverture laterale', exampleIt: 'L Open Side facilita il carico laterale.', category: 'tech_container' },
    { id: 'tech-rf', frontIt: 'container frigorifero', frontFr: 'container refrigere', exampleIt: 'Il container frigorifero mantiene la temperatura controllata.', category: 'tech_container' },
    { id: 'log-01', frontIt: 'lo scarico', frontFr: 'le dechargement', exampleIt: 'Lo scarico con gru non e sempre incluso.', category: 'logistique' },
    { id: 'log-02', frontIt: 'la gru', frontFr: 'la grue', exampleIt: 'Serve una gru per posizionare il modulo.', category: 'logistique' },
    { id: 'log-03', frontIt: 'il transpallet', frontFr: 'le transpalette', exampleIt: 'Il transpallet aiuta nello scarico del materiale.', category: 'logistique' },
    { id: 'leg-01', frontIt: 'la CILA asseverata', frontFr: 'declaration travaux assermentee', exampleIt: 'Per usi temporanei puo servire la CILA asseverata.', category: 'legal' },
    { id: 'leg-02', frontIt: 'il permesso di costruire', frontFr: 'le permis de construire', exampleIt: 'Per installazioni permanenti puo servire il permesso di costruire.', category: 'legal' },
    { id: 'fin-01', frontIt: 'la partita IVA', frontFr: 'le numero TVA italien', exampleIt: 'Mi puo indicare la Sua partita IVA?', category: 'finance' },
    { id: 'fin-02', frontIt: 'l acconto', frontFr: 'l acompte', exampleIt: 'Richiediamo un acconto del trenta per cento.', category: 'finance' },

    // ── Verbes courants ─────────────────────────────────────────────────────
    { id: 'verb-09', frontIt: 'parlare / parlo', frontFr: 'parler / je parle', phonetic: '[parˈlaːre]', exampleIt: 'Parlo italiano con i clienti.', category: 'verbes' },
    { id: 'verb-10', frontIt: 'capire / capisco', frontFr: 'comprendre / je comprends', phonetic: '[kaˈpiːre]', exampleIt: 'Capisco la Sua preoccupazione.', category: 'verbes' },
    { id: 'verb-11', frontIt: 'vedere / vedo', frontFr: 'voir / je vois', phonetic: '[ˈveːdere]', exampleIt: 'Vedo che ha gia\' visitato il sito.', category: 'verbes' },
    { id: 'verb-12', frontIt: 'sapere / so', frontFr: 'savoir / je sais', phonetic: '[saˈpeːre]', exampleIt: 'So che il prezzo e\' importante per Lei.', category: 'verbes' },
    { id: 'verb-13', frontIt: 'fare / faccio', frontFr: 'faire / je fais', phonetic: '[ˈfaːre]', exampleIt: 'Faccio il commerciale da 10 anni.', category: 'verbes' },
    { id: 'verb-14', frontIt: 'mandare / mando', frontFr: 'envoyer / j\'envoie', phonetic: '[manˈdaːre]', exampleIt: 'Le mando il preventivo entro oggi.', category: 'verbes' },
    { id: 'verb-15', frontIt: 'ricevere / ricevo', frontFr: 'recevoir / je recois', phonetic: '[riˈtʃeːvere]', exampleIt: 'Ha ricevuto la nostra offerta?', category: 'verbes' },
    { id: 'verb-16', frontIt: 'chiamare / chiamo', frontFr: 'appeler / j\'appelle', phonetic: '[kjaˈmaːre]', exampleIt: 'La chiamo per seguire il preventivo.', category: 'verbes' },
    { id: 'verb-17', frontIt: 'aspettare / aspetto', frontFr: 'attendre / j\'attends', phonetic: '[asˈpɛttaːre]', exampleIt: 'Aspetto la Sua risposta entro giovedi\'.', category: 'verbes' },
    { id: 'verb-18', frontIt: 'spiegare / spiego', frontFr: 'expliquer / j\'explique', phonetic: '[spjeˈɡaːre]', exampleIt: 'Le spiego il funzionamento del sistema.', category: 'verbes' },
    { id: 'verb-19', frontIt: 'trovare / trovo', frontFr: 'trouver / je trouve', phonetic: '[troˈvaːre]', exampleIt: 'Possiamo trovare un accordo.', category: 'verbes' },
    { id: 'verb-20', frontIt: 'proporre / propongo', frontFr: 'proposer / je propose', phonetic: '[proˈpɔrre]', exampleIt: 'Le propongo una soluzione alternativa.', category: 'verbes' },
    { id: 'verb-21', frontIt: 'avere bisogno di', frontFr: 'avoir besoin de', phonetic: '[biˈzoɲɲo]', exampleIt: 'Di cosa ha bisogno esattamente?', category: 'verbes' },

    // ── Temps ───────────────────────────────────────────────────────────────
    { id: 'time-01', frontIt: 'oggi', frontFr: 'aujourd\'hui', phonetic: '[ˈɔdʒi]', exampleIt: 'Posso inviarLe il preventivo oggi.', category: 'temps' },
    { id: 'time-02', frontIt: 'domani', frontFr: 'demain', phonetic: '[doˈmaːni]', exampleIt: 'La richiamo domani mattina.', category: 'temps' },
    { id: 'time-03', frontIt: 'ieri', frontFr: 'hier', phonetic: '[ˈjɛri]', exampleIt: 'Le ho mandato il preventivo ieri.', category: 'temps' },
    { id: 'time-04', frontIt: 'la settimana prossima', frontFr: 'la semaine prochaine', exampleIt: 'La consegna e\' prevista la settimana prossima.', category: 'temps' },
    { id: 'time-05', frontIt: 'il mese prossimo', frontFr: 'le mois prochain', exampleIt: 'Il contratto inizia il mese prossimo.', category: 'temps' },
    { id: 'time-06', frontIt: 'adesso / ora', frontFr: 'maintenant', phonetic: '[aˈdɛsso]', exampleIt: 'Non posso parlare adesso, La richiamo.', category: 'temps' },
    { id: 'time-07', frontIt: 'piu\' tardi', frontFr: 'plus tard', exampleIt: 'Possiamo parlarne piu\' tardi?', category: 'temps' },
    { id: 'time-08', frontIt: 'entro (+ duree)', frontFr: 'd\'ici / sous (+ duree)', phonetic: '[ˈɛntro]', exampleIt: 'Rispondo entro 24 ore.', category: 'temps' },
    { id: 'time-09', frontIt: 'al piu\' presto', frontFr: 'des que possible / ASAP', exampleIt: 'Abbiamo bisogno di una risposta al piu\' presto.', category: 'temps' },
    { id: 'time-10', frontIt: 'in anticipo', frontFr: 'en avance', exampleIt: 'Preferisco ricevere i documenti in anticipo.', category: 'temps' },
    { id: 'time-11', frontIt: 'entro fine mese', frontFr: 'avant fin du mois', exampleIt: 'Dobbiamo chiudere entro fine mese.', category: 'temps' },
    { id: 'days-01', frontIt: 'lunedi\' / martedi\' / mercoledi\'', frontFr: 'lundi / mardi / mercredi', category: 'temps' },
    { id: 'days-02', frontIt: 'giovedi\' / venerdi\' / sabato / domenica', frontFr: 'jeudi / vendredi / samedi / dimanche', category: 'temps' },
    { id: 'month-01', frontIt: 'gennaio / febbraio / marzo', frontFr: 'janvier / fevrier / mars', category: 'temps' },
    { id: 'month-02', frontIt: 'aprile / maggio / giugno', frontFr: 'avril / mai / juin', category: 'temps' },
    { id: 'month-03', frontIt: 'luglio / agosto / settembre', frontFr: 'juillet / aout / septembre', category: 'temps' },
    { id: 'month-04', frontIt: 'ottobre / novembre / dicembre', frontFr: 'octobre / novembre / decembre', category: 'temps' },

    // ── Adjectifs ──────────────────────────────────────────────────────────
    { id: 'adj-01', frontIt: 'grande / piccolo', frontFr: 'grand / petit', phonetic: '[ˈɡrande] / [ˈpikkolo]', exampleIt: 'E\' un grande container da 40 piedi.', category: 'adjectifs' },
    { id: 'adj-02', frontIt: 'buono / cattivo', frontFr: 'bon / mauvais', phonetic: '[ˈbwɔːno]', exampleIt: 'E\' una buona soluzione.', category: 'adjectifs' },
    { id: 'adj-03', frontIt: 'nuovo / vecchio', frontFr: 'nouveau / vieux', exampleIt: 'E\' un container nuovo, non rigenerato.', category: 'adjectifs' },
    { id: 'adj-04', frontIt: 'disponibile', frontFr: 'disponible', phonetic: '[disponiˈbiːle]', exampleIt: 'Il modello e\' disponibile subito.', category: 'adjectifs' },
    { id: 'adj-05', frontIt: 'urgente', frontFr: 'urgent', phonetic: '[urˈdʒɛnte]', exampleIt: 'E\' una richiesta urgente?', category: 'adjectifs' },
    { id: 'adj-06', frontIt: 'importante', frontFr: 'important', exampleIt: 'E\' un cliente molto importante.', category: 'adjectifs' },
    { id: 'adj-07', frontIt: 'professionale', frontFr: 'professionnel', exampleIt: 'Il nostro servizio e\' molto professionale.', category: 'adjectifs' },
    { id: 'adj-08', frontIt: 'affidabile', frontFr: 'fiable / dependable', phonetic: '[affiˈdaːbile]', exampleIt: 'La nostra azienda e\' affidabile da 20 anni.', category: 'adjectifs' },
    { id: 'adj-09', frontIt: 'competitivo', frontFr: 'competitif', exampleIt: 'Il nostro prezzo e\' molto competitivo.', category: 'adjectifs' },
    { id: 'adj-10', frontIt: 'vantaggioso', frontFr: 'avantageux', exampleIt: 'E\' un\'offerta vantaggiosa per Lei.', category: 'adjectifs' },
    { id: 'adj-11', frontIt: 'completo', frontFr: 'complet', exampleIt: 'Le invio un preventivo completo.', category: 'adjectifs' },
    { id: 'adj-12', frontIt: 'incluso', frontFr: 'inclus', exampleIt: 'Il trasporto e\' incluso nel prezzo.', category: 'adjectifs' },
    { id: 'adj-13', frontIt: 'rapido / veloce', frontFr: 'rapide', exampleIt: 'La consegna e\' rapida, entro 2 settimane.', category: 'adjectifs' },
    { id: 'adj-14', frontIt: 'conveniente', frontFr: 'pratique / interessant (prix)', exampleIt: 'E\' molto conveniente per il Suo budget.', category: 'adjectifs' },

    // ── Questions ──────────────────────────────────────────────────────────
    { id: 'quest-01', frontIt: 'Come?', frontFr: 'Comment ?', phonetic: '[ˈkoːme]', exampleIt: 'Come posso aiutarLa?', category: 'questions' },
    { id: 'quest-02', frontIt: 'Quando?', frontFr: 'Quand ?', phonetic: '[ˈkwando]', exampleIt: 'Quando ne ha bisogno?', category: 'questions' },
    { id: 'quest-03', frontIt: 'Dove?', frontFr: 'Ou ?', phonetic: '[ˈdoːve]', exampleIt: 'Dove si trova il cantiere?', category: 'questions' },
    { id: 'quest-04', frontIt: 'Perche\'?', frontFr: 'Pourquoi ?', phonetic: '[perˈkɛ]', exampleIt: 'Perche\' ha scelto questa soluzione?', category: 'questions' },
    { id: 'quest-05', frontIt: 'Quanto? / Quanti?', frontFr: 'Combien ?', phonetic: '[ˈkwanto]', exampleIt: 'Quanto vuole spendere?', category: 'questions' },
    { id: 'quest-06', frontIt: 'Quale? / Quali?', frontFr: 'Lequel ? / Lesquels ?', exampleIt: 'Quale modello preferisce?', category: 'questions' },
    { id: 'quest-07', frontIt: 'Chi?', frontFr: 'Qui ?', phonetic: '[ki]', exampleIt: 'Chi e\' il responsabile degli acquisti?', category: 'questions' },
    { id: 'quest-08', frontIt: 'Cosa? / Che cosa?', frontFr: 'Quoi ? / Qu\'est-ce que ?', exampleIt: 'Cosa cerca esattamente?', category: 'questions' },

    // ── Telephone ──────────────────────────────────────────────────────────
    { id: 'phone-01', frontIt: 'Le disturbo?', frontFr: 'Je vous derange ?', phonetic: '[le disˈturbo]', exampleIt: 'Buongiorno, Le disturbo un momento?', category: 'telephone' },
    { id: 'phone-02', frontIt: 'Ha un momento?', frontFr: 'Vous avez un moment ?', exampleIt: 'Ha un momento per parlare?', category: 'telephone' },
    { id: 'phone-03', frontIt: 'La linea e\' disturbata', frontFr: 'La ligne est mauvaise', exampleIt: 'Scusi, la linea e\' un po\' disturbata.', category: 'telephone' },
    { id: 'phone-04', frontIt: 'Puo\' ripetere per favore?', frontFr: 'Pouvez-vous repeter ?', exampleIt: 'Non ho sentito bene, puo\' ripetere?', category: 'telephone' },
    { id: 'phone-05', frontIt: 'Parli piu\' lentamente', frontFr: 'Parlez plus lentement', exampleIt: 'Mi scusi, puo\' parlare piu\' lentamente?', category: 'telephone' },
    { id: 'phone-06', frontIt: 'Non ho capito bene', frontFr: 'Je n\'ai pas bien compris', exampleIt: 'Mi scusi, non ho capito bene l\'ultima parte.', category: 'telephone' },
    { id: 'phone-07', frontIt: 'Restiamo in contatto', frontFr: 'Restons en contact', exampleIt: 'Restiamo in contatto, Le scrivo domani.', category: 'telephone' },
    { id: 'phone-08', frontIt: 'Vuole lasciare un messaggio?', frontFr: 'Voulez-vous laisser un message ?', category: 'telephone' },

    // ── Email ──────────────────────────────────────────────────────────────
    { id: 'email-01', frontIt: 'Gentile Signor / Signora', frontFr: 'Cher Monsieur / Chere Madame', exampleIt: 'Gentile Signor Russo, ...', category: 'email' },
    { id: 'email-02', frontIt: 'In allegato', frontFr: 'En piece jointe', phonetic: '[in alˈleːɡato]', exampleIt: 'In allegato trovi il preventivo richiesto.', category: 'email' },
    { id: 'email-03', frontIt: 'Come da accordi', frontFr: 'Comme convenu', exampleIt: 'Come da accordi, invio la documentazione.', category: 'email' },
    { id: 'email-04', frontIt: 'In attesa di una Sua risposta', frontFr: 'Dans l\'attente de votre reponse', exampleIt: 'Resto in attesa di una Sua risposta.', category: 'email' },
    { id: 'email-05', frontIt: 'Cordiali saluti', frontFr: 'Cordialement', exampleIt: 'Cordiali saluti, Pierre Dupont', category: 'email' },
    { id: 'email-06', frontIt: 'Restiamo a Sua disposizione', frontFr: 'Nous restons a votre disposition', exampleIt: 'Restiamo a Sua disposizione per qualsiasi informazione.', category: 'email' },
    { id: 'email-07', frontIt: 'A seguito della nostra telefonata', frontFr: 'Suite a notre appel', exampleIt: 'A seguito della nostra telefonata di oggi...', category: 'email' },

    // ── Negociation ────────────────────────────────────────────────────────
    { id: 'nego-01', frontIt: 'Questa e\' la nostra migliore offerta', frontFr: 'C\'est notre meilleure offre', exampleIt: 'Le assicuro che questa e\' la nostra migliore offerta.', category: 'negociation' },
    { id: 'nego-02', frontIt: 'Possiamo offrire uno sconto del X%', frontFr: 'Nous pouvons offrir une remise de X%', exampleIt: 'Possiamo offrire uno sconto del 5% per il pagamento anticipato.', category: 'negociation' },
    { id: 'nego-03', frontIt: 'Siamo disposti a trovare un accordo', frontFr: 'Nous sommes prets a trouver un accord', exampleIt: 'Siamo disposti a trovare un accordo vantaggioso.', category: 'negociation' },
    { id: 'nego-04', frontIt: 'Possiamo scaglionare i pagamenti', frontFr: 'Nous pouvons echelonner les paiements', exampleIt: 'Possiamo scaglionare i pagamenti in tre rate.', category: 'negociation' },
    { id: 'nego-05', frontIt: 'Le propongo un\'alternativa', frontFr: 'Je vous propose une alternative', exampleIt: 'Se il prezzo e\' un problema, Le propongo un\'alternativa.', category: 'negociation' },
    { id: 'nego-06', frontIt: 'Il prezzo e\' gia\' al minimo', frontFr: 'Le prix est deja au minimum', exampleIt: 'Per la qualita\' offerta, il prezzo e\' gia\' al minimo.', category: 'negociation' },

    // ── Connecteurs ────────────────────────────────────────────────────────
    { id: 'conn-01', frontIt: 'quindi', frontFr: 'donc / alors', phonetic: '[ˈkwindi]', exampleIt: 'Quindi, posso inviarLe il preventivo?', category: 'connecteurs' },
    { id: 'conn-02', frontIt: 'pero\' / ma', frontFr: 'mais / cependant', exampleIt: 'E\' un bel prodotto, pero\' il prezzo e\' alto.', category: 'connecteurs' },
    { id: 'conn-03', frontIt: 'nonostante', frontFr: 'malgre / bien que', phonetic: '[nonoˈstante]', exampleIt: 'Nonostante il prezzo, la qualita\' e\' eccellente.', category: 'connecteurs' },
    { id: 'conn-04', frontIt: 'tuttavia', frontFr: 'cependant / toutefois', phonetic: '[tutˈtaːvja]', exampleIt: 'Tuttavia, possiamo trovare una soluzione.', category: 'connecteurs' },
    { id: 'conn-05', frontIt: 'anche', frontFr: 'aussi / egalement / meme', phonetic: '[ˈanke]', exampleIt: 'Abbiamo anche modelli da 40 piedi.', category: 'connecteurs' },
    { id: 'conn-06', frontIt: 'gia\'', frontFr: 'deja', phonetic: '[ˈdʒaː]', exampleIt: 'Ho gia\' inviato la documentazione.', category: 'connecteurs' },
    { id: 'conn-07', frontIt: 'ancora', frontFr: 'encore / toujours', phonetic: '[anˈkoːra]', exampleIt: 'Non ha ancora risposto al preventivo?', category: 'connecteurs' },
    { id: 'conn-08', frontIt: 'in piu\'', frontFr: 'de plus / en plus', exampleIt: 'In piu\', offriamo un anno di garanzia gratuita.', category: 'connecteurs' },

    // ── Phrases avancees ───────────────────────────────────────────────────
    { id: 'adv-01', frontIt: 'Come Le dicevo...', frontFr: 'Comme je vous le disais...', exampleIt: 'Come Le dicevo, la consegna e\' rapida.', category: 'avance' },
    { id: 'adv-02', frontIt: 'Come avevamo concordato...', frontFr: 'Comme nous en avions convenu...', exampleIt: 'Come avevamo concordato, invio il preventivo oggi.', category: 'avance' },
    { id: 'adv-03', frontIt: 'Mi permetta di spiegare...', frontFr: 'Permettez-moi d\'expliquer...', exampleIt: 'Mi permetta di spiegare il processo di installazione.', category: 'avance' },
    { id: 'adv-04', frontIt: 'Sono sicuro che...', frontFr: 'Je suis certain(e) que...', exampleIt: 'Sono sicuro che troviamo un accordo.', category: 'avance' },
    { id: 'adv-05', frontIt: 'In tutta franchezza...', frontFr: 'En toute franchise...', exampleIt: 'In tutta franchezza, e\' la migliore opzione.', category: 'avance' },
    { id: 'adv-06', frontIt: 'Le garantisco che...', frontFr: 'Je vous garantis que...', exampleIt: 'Le garantisco che rispettiamo i tempi di consegna.', category: 'avance' },
    { id: 'adv-07', frontIt: 'Ha la mia parola', frontFr: 'Vous avez ma parole', exampleIt: 'Rispetteremo i tempi. Ha la mia parola.', category: 'avance' },
    { id: 'adv-08', frontIt: 'Nel caso in cui...', frontFr: 'Dans le cas ou...', exampleIt: 'Nel caso in cui ci siano problemi, La contatto subito.', category: 'avance' },

    // ── Couleurs ───────────────────────────────────────────────────────────
    { id: 'col-01', frontIt: 'rosso / rossa', frontFr: 'rouge', phonetic: '[ˈrosso]', exampleIt: 'Una macchina rossa.', category: 'couleurs' },
    { id: 'col-02', frontIt: 'blu', frontFr: 'bleu (invariable)', phonetic: '[bluː]', exampleIt: 'Un cielo blu.', category: 'couleurs' },
    { id: 'col-03', frontIt: 'verde', frontFr: 'vert', phonetic: '[ˈvɛrde]', exampleIt: 'L\'erba e\' verde.', category: 'couleurs' },
    { id: 'col-04', frontIt: 'giallo / gialla', frontFr: 'jaune', phonetic: '[ˈdʒallo]', exampleIt: 'Un limone giallo.', category: 'couleurs' },
    { id: 'col-05', frontIt: 'bianco / bianca', frontFr: 'blanc', phonetic: '[ˈbjaŋko]', exampleIt: 'La neve e\' bianca.', category: 'couleurs' },
    { id: 'col-06', frontIt: 'nero / nera', frontFr: 'noir', phonetic: '[ˈneːro]', exampleIt: 'Un gatto nero.', category: 'couleurs' },
    { id: 'col-07', frontIt: 'arancione', frontFr: 'orange (invariable)', phonetic: '[aranˈtʃoːne]', exampleIt: 'Una maglietta arancione.', category: 'couleurs' },
    { id: 'col-08', frontIt: 'viola', frontFr: 'violet / mauve (invariable)', phonetic: '[ˈvjoːla]', exampleIt: 'Una giacca viola.', category: 'couleurs' },
    { id: 'col-09', frontIt: 'rosa', frontFr: 'rose (invariable)', phonetic: '[ˈroːza]', exampleIt: 'Un fiore rosa.', category: 'couleurs' },
    { id: 'col-10', frontIt: 'marrone', frontFr: 'marron (invariable)', phonetic: '[marˈroːne]', exampleIt: 'Occhi marroni.', category: 'couleurs' },
    { id: 'col-11', frontIt: 'grigio / grigia', frontFr: 'gris', phonetic: '[ˈɡriːdʒo]', exampleIt: 'Un cielo grigio.', category: 'couleurs' },

    // ── Famille ────────────────────────────────────────────────────────────
    { id: 'fam-01', frontIt: 'il padre', frontFr: 'le pere', phonetic: '[ˈpaːdre]', exampleIt: 'Mio padre e\' medico.', category: 'famille' },
    { id: 'fam-02', frontIt: 'la madre / la mamma', frontFr: 'la mere', phonetic: '[ˈmaːdre]', exampleIt: 'La mia mamma cucina benissimo.', category: 'famille' },
    { id: 'fam-03', frontIt: 'il fratello', frontFr: 'le frere', phonetic: '[fraˈtɛllo]', exampleIt: 'Ho due fratelli.', category: 'famille' },
    { id: 'fam-04', frontIt: 'la sorella', frontFr: 'la soeur', phonetic: '[soˈrɛlla]', exampleIt: 'Mia sorella abita a Roma.', category: 'famille' },
    { id: 'fam-05', frontIt: 'il figlio / la figlia', frontFr: 'le fils / la fille', phonetic: '[ˈfiʎʎo]', exampleIt: 'Ho una figlia di 5 anni.', category: 'famille' },
    { id: 'fam-06', frontIt: 'il nonno / la nonna', frontFr: 'le grand-pere / la grand-mere', phonetic: '[ˈnɔnno]', exampleIt: 'La nonna fa la pasta.', category: 'famille' },
    { id: 'fam-07', frontIt: 'lo zio / la zia', frontFr: 'l\'oncle / la tante', phonetic: '[ˈdziːo]', exampleIt: 'Mio zio abita a Milano.', category: 'famille' },
    { id: 'fam-08', frontIt: 'il cugino / la cugina', frontFr: 'le cousin / la cousine', phonetic: '[kuˈdʒiːno]', exampleIt: 'Ho molti cugini italiani.', category: 'famille' },
    { id: 'fam-09', frontIt: 'il marito / la moglie', frontFr: 'le mari / la femme', phonetic: '[maˈriːto]', exampleIt: 'Mio marito e\' italiano.', category: 'famille' },
    { id: 'fam-10', frontIt: 'i genitori', frontFr: 'les parents', phonetic: '[dʒeniˈtoːri]', exampleIt: 'I miei genitori abitano a Parigi.', category: 'famille' },

    // ── Sentiments ─────────────────────────────────────────────────────────
    { id: 'sent-01', frontIt: 'felice / contento', frontFr: 'heureux / content', phonetic: '[feˈliːtʃe]', exampleIt: 'Sono molto felice oggi.', category: 'sentiments' },
    { id: 'sent-02', frontIt: 'triste', frontFr: 'triste', phonetic: '[ˈtriste]', exampleIt: 'Mi sento un po\' triste.', category: 'sentiments' },
    { id: 'sent-03', frontIt: 'arrabbiato / arrabbiata', frontFr: 'en colere / fache', phonetic: '[arraˈbjaːto]', exampleIt: 'Sono arrabbiato con lui.', category: 'sentiments' },
    { id: 'sent-04', frontIt: 'stanco / stanca', frontFr: 'fatigue(e)', phonetic: '[ˈstaŋko]', exampleIt: 'Sono molto stanca oggi.', category: 'sentiments' },
    { id: 'sent-05', frontIt: 'preoccupato', frontFr: 'inquiet / preoccupe', phonetic: '[preokuˈpaːto]', exampleIt: 'Sono un po\' preoccupato.', category: 'sentiments' },
    { id: 'sent-06', frontIt: 'sorpreso', frontFr: 'surpris', phonetic: '[sorˈpreːzo]', exampleIt: 'Sono sorpreso da questa notizia.', category: 'sentiments' },
    { id: 'sent-07', frontIt: 'Ho fame / Ho sete', frontFr: 'J\'ai faim / J\'ai soif', exampleIt: 'Ho molta fame, mangiamo?', category: 'sentiments' },
    { id: 'sent-08', frontIt: 'Ho freddo / Ho caldo', frontFr: 'J\'ai froid / J\'ai chaud', exampleIt: 'Hai freddo? Metto il riscaldamento.', category: 'sentiments' },
    { id: 'sent-09', frontIt: 'Mi sento bene / male', frontFr: 'Je me sens bien / mal', exampleIt: 'Non mi sento bene, ho mal di testa.', category: 'sentiments' },
    { id: 'sent-10', frontIt: 'entusiasta', frontFr: 'enthousiaste', phonetic: '[entuzˈjasta]', exampleIt: 'Sono entusiasta di questo progetto.', category: 'sentiments' },

    // ── Articles ───────────────────────────────────────────────────────────
    { id: 'art-01', frontIt: 'il (masc. sg. — consonnes)', frontFr: 'le', phonetic: '[il]', exampleIt: 'Il libro, il cane, il treno.', category: 'articles' },
    { id: 'art-02', frontIt: 'la (fem. sg.)', frontFr: 'la', phonetic: '[la]', exampleIt: 'La porta, la casa, la mamma.', category: 'articles' },
    { id: 'art-03', frontIt: 'lo (masc. sg.: s+cons., z, gn, x, ps)', frontFr: 'le (cas special)', phonetic: '[lo]', exampleIt: 'Lo studente, lo zaino, lo sport.', category: 'articles' },
    { id: 'art-04', frontIt: 'l\' (devant voyelle — masc. et fem.)', frontFr: 'l\'', phonetic: '[l]', exampleIt: 'L\'amico, l\'idea, l\'uomo.', category: 'articles' },
    { id: 'art-05', frontIt: 'i (masc. pl.)', frontFr: 'les (masc.)', phonetic: '[i]', exampleIt: 'I libri, i ragazzi, i treni.', category: 'articles' },
    { id: 'art-06', frontIt: 'le (fem. pl.)', frontFr: 'les (fem.)', phonetic: '[le]', exampleIt: 'Le case, le ragazze, le porte.', category: 'articles' },
    { id: 'art-07', frontIt: 'gli (masc. pl. avec lo)', frontFr: 'les (cas special masc.)', phonetic: '[ʎi]', exampleIt: 'Gli studenti, gli zaini, gli uomini.', category: 'articles' },
    { id: 'art-08', frontIt: 'un / una / un\' / uno', frontFr: 'un / une (indefinis)', exampleIt: 'Un libro, una casa, un\'idea, uno zaino.', category: 'articles' },

    // ── Indications ────────────────────────────────────────────────────────
    { id: 'ind-01', frontIt: 'Dove si trova...?', frontFr: 'Ou se trouve...?', exampleIt: 'Dove si trova la stazione?', category: 'indications' },
    { id: 'ind-02', frontIt: 'a destra', frontFr: 'a droite', phonetic: '[ˈdɛstra]', exampleIt: 'Gira a destra alla piazza.', category: 'indications' },
    { id: 'ind-03', frontIt: 'a sinistra', frontFr: 'a gauche', phonetic: '[siˈnistra]', exampleIt: 'Prendi la seconda a sinistra.', category: 'indications' },
    { id: 'ind-04', frontIt: 'sempre dritto', frontFr: 'tout droit', phonetic: '[ˈdritto]', exampleIt: 'Vai sempre dritto per 500 metri.', category: 'indications' },
    { id: 'ind-05', frontIt: 'vicino a / lontano da', frontFr: 'pres de / loin de', phonetic: '[viˈtʃiːno]', exampleIt: 'La fermata e\' vicino al museo.', category: 'indications' },
    { id: 'ind-06', frontIt: 'davanti a / dietro a', frontFr: 'devant / derriere', exampleIt: 'La banca e\' davanti alla chiesa.', category: 'indications' },
    { id: 'ind-07', frontIt: 'di fronte a', frontFr: 'en face de', exampleIt: 'Il ristorante e\' di fronte al teatro.', category: 'indications' },
    { id: 'ind-08', frontIt: 'all\'angolo / al primo piano', frontFr: 'au coin / au premier etage', exampleIt: 'C\'e\' una farmacia all\'angolo.', category: 'indications' },

    // ── Maison ─────────────────────────────────────────────────────────────
    { id: 'mais-01', frontIt: 'il divano', frontFr: 'le canape', phonetic: '[diˈvaːno]', exampleIt: 'Mi siedo sul divano.', category: 'maison' },
    { id: 'mais-02', frontIt: 'il tavolo', frontFr: 'la table', phonetic: '[ˈtaːvolo]', exampleIt: 'Il tavolo e\' in cucina.', category: 'maison' },
    { id: 'mais-03', frontIt: 'il letto', frontFr: 'le lit', phonetic: '[ˈlɛtto]', exampleIt: 'Il letto e\' molto comodo.', category: 'maison' },
    { id: 'mais-04', frontIt: 'l\'armadio', frontFr: 'l\'armoire', phonetic: '[arˈmaːdjo]', exampleIt: 'I vestiti sono nell\'armadio.', category: 'maison' },
    { id: 'mais-05', frontIt: 'la finestra', frontFr: 'la fenetre', phonetic: '[fiˈnɛstra]', exampleIt: 'Apri la finestra, per favore.', category: 'maison' },
    { id: 'mais-06', frontIt: 'la porta', frontFr: 'la porte', phonetic: '[ˈpɔrta]', exampleIt: 'Chiudi la porta.', category: 'maison' },
    { id: 'mais-07', frontIt: 'la lampada', frontFr: 'la lampe', phonetic: '[ˈlampada]', exampleIt: 'Accendi la lampada.', category: 'maison' },
    { id: 'mais-08', frontIt: 'lo scaffale', frontFr: 'l\'etagere', phonetic: '[skafˈfaːle]', exampleIt: 'I libri sono sullo scaffale.', category: 'maison' },
    { id: 'mais-09', frontIt: 'il tappeto', frontFr: 'le tapis', phonetic: '[tapˈpeːto]', exampleIt: 'Un bel tappeto in salotto.', category: 'maison' },
    { id: 'mais-10', frontIt: 'il quadro', frontFr: 'le tableau', phonetic: '[ˈkwadro]', exampleIt: 'Un quadro sulla parete.', category: 'maison' },
    { id: 'mais-11', frontIt: 'il soggiorno / il salotto', frontFr: 'le sejour / le salon', phonetic: '[sodˈdʒorno]', exampleIt: 'Il soggiorno e\' grande.', category: 'maison' },
    { id: 'mais-12', frontIt: 'la camera da letto', frontFr: 'la chambre a coucher', exampleIt: 'La camera e\' al primo piano.', category: 'maison' },

    // ── Cuisine ────────────────────────────────────────────────────────────
    { id: 'cuis-01', frontIt: 'il frigorifero', frontFr: 'le refrigerateur', phonetic: '[frigo]', exampleIt: 'Il latte e\' nel frigorifero.', category: 'cuisine_obj' },
    { id: 'cuis-02', frontIt: 'il forno', frontFr: 'le four', phonetic: '[ˈforno]', exampleIt: 'Metto la pizza in forno.', category: 'cuisine_obj' },
    { id: 'cuis-03', frontIt: 'i fornelli', frontFr: 'les fourneaux', phonetic: '[forˈnɛlli]', exampleIt: 'Metti l\'acqua sui fornelli.', category: 'cuisine_obj' },
    { id: 'cuis-04', frontIt: 'la pentola / la padella', frontFr: 'la casserole / la poele', phonetic: '[ˈpɛntola]', exampleIt: 'La pasta bolle nella pentola.', category: 'cuisine_obj' },
    { id: 'cuis-05', frontIt: 'il coltello / la forchetta', frontFr: 'le couteau / la fourchette', phonetic: '[kolˈtɛllo]', exampleIt: 'Dove sono le forchette?', category: 'cuisine_obj' },
    { id: 'cuis-06', frontIt: 'il piatto', frontFr: 'l\'assiette', phonetic: '[ˈpjatto]', exampleIt: 'Porta i piatti in tavola.', category: 'cuisine_obj' },
    { id: 'cuis-07', frontIt: 'il bicchiere', frontFr: 'le verre', phonetic: '[bikˈkjɛːre]', exampleIt: 'Un bicchiere d\'acqua.', category: 'cuisine_obj' },
    { id: 'cuis-08', frontIt: 'la tazza', frontFr: 'la tasse', phonetic: '[ˈtattsa]', exampleIt: 'Una tazza di caffe\'.', category: 'cuisine_obj' },
    { id: 'cuis-09', frontIt: 'il lavello', frontFr: 'l\'evier', phonetic: '[laˈvɛllo]', exampleIt: 'Lava i piatti nel lavello.', category: 'cuisine_obj' },
    { id: 'cuis-10', frontIt: 'il microonde', frontFr: 'le micro-ondes', exampleIt: 'Scaldo il pasto nel microonde.', category: 'cuisine_obj' },

    // ── Salle de bain ──────────────────────────────────────────────────────
    { id: 'sdb-01', frontIt: 'la doccia', frontFr: 'la douche', phonetic: '[ˈdɔttʃa]', exampleIt: 'Faccio la doccia ogni mattina.', category: 'sdb' },
    { id: 'sdb-02', frontIt: 'la vasca da bagno', frontFr: 'la baignoire', phonetic: '[ˈvaska]', exampleIt: 'Mi faccio un bagno caldo.', category: 'sdb' },
    { id: 'sdb-03', frontIt: 'il lavandino', frontFr: 'le lavabo', phonetic: '[lavanˈdiːno]', exampleIt: 'Mi lavo le mani al lavandino.', category: 'sdb' },
    { id: 'sdb-04', frontIt: 'il sapone', frontFr: 'le savon', phonetic: '[saˈpoːne]', exampleIt: 'Metti il sapone vicino al lavandino.', category: 'sdb' },
    { id: 'sdb-05', frontIt: 'l\'asciugamano', frontFr: 'la serviette de bain', phonetic: '[aʃʃuɡaˈmaːno]', exampleIt: 'L\'asciugamano e\' pulito.', category: 'sdb' },
    { id: 'sdb-06', frontIt: 'lo specchio', frontFr: 'le miroir', phonetic: '[ˈspɛkkjo]', exampleIt: 'Mi guardo nello specchio.', category: 'sdb' },
    { id: 'sdb-07', frontIt: 'il dentifricio / lo spazzolino', frontFr: 'le dentifrice / la brosse a dents', exampleIt: 'Ho dimenticato il dentifricio.', category: 'sdb' },
    { id: 'sdb-08', frontIt: 'lo shampoo', frontFr: 'le shampoing', exampleIt: 'Devo comprare lo shampoo.', category: 'sdb' },

    // ── Transport ──────────────────────────────────────────────────────────
    { id: 'tra-01', frontIt: 'la macchina / l\'auto', frontFr: 'la voiture', phonetic: '[ˈmakkina]', exampleIt: 'Vado al lavoro in macchina.', category: 'transport_v' },
    { id: 'tra-02', frontIt: 'il treno', frontFr: 'le train', phonetic: '[ˈtrɛːno]', exampleIt: 'Prendo il treno per Roma.', category: 'transport_v' },
    { id: 'tra-03', frontIt: 'l\'aereo', frontFr: 'l\'avion', phonetic: '[aˈɛːreo]', exampleIt: 'Il volo dura 2 ore.', category: 'transport_v' },
    { id: 'tra-04', frontIt: 'il pullman / l\'autobus', frontFr: 'le car / le bus', exampleIt: 'Prendo il pullman per Milano.', category: 'transport_v' },
    { id: 'tra-05', frontIt: 'la metropolitana', frontFr: 'le metro', exampleIt: 'Prendo la metro ogni giorno.', category: 'transport_v' },
    { id: 'tra-06', frontIt: 'la bicicletta', frontFr: 'le velo', phonetic: '[bitʃiˈklɛtta]', exampleIt: 'Vado in bicicletta al parco.', category: 'transport_v' },
    { id: 'tra-07', frontIt: 'il taxi', frontFr: 'le taxi', exampleIt: 'Prendo un taxi dall\'aeroporto.', category: 'transport_v' },
    { id: 'tra-08', frontIt: 'il traghetto', frontFr: 'le ferry', phonetic: '[traˈɡɛtto]', exampleIt: 'Il traghetto per la Sicilia.', category: 'transport_v' },
    { id: 'tra-09', frontIt: 'la stazione', frontFr: 'la gare', exampleIt: 'Dove e\' la stazione?', category: 'transport_v' },
    { id: 'tra-10', frontIt: 'il biglietto / la prenotazione', frontFr: 'le billet / la reservation', exampleIt: 'Ho gia\' il biglietto.', category: 'transport_v' },

    // ── Maritime ───────────────────────────────────────────────────────────
    { id: 'mar-01', frontIt: 'il mare', frontFr: 'la mer', phonetic: '[ˈmaːre]', exampleIt: 'L\'Italia e\' circondata dal mare.', category: 'maritime' },
    { id: 'mar-02', frontIt: 'la nave / il cargo', frontFr: 'le navire / le cargo', phonetic: '[ˈnaːve]', exampleIt: 'La nave parte domani.', category: 'maritime' },
    { id: 'mar-03', frontIt: 'il porto', frontFr: 'le port', phonetic: '[ˈpɔrto]', exampleIt: 'Il porto di Genova.', category: 'maritime' },
    { id: 'mar-04', frontIt: 'la barca / la barca a vela', frontFr: 'le bateau / le voilier', phonetic: '[ˈbarka]', exampleIt: 'Una barca a vela nel porto.', category: 'maritime' },
    { id: 'mar-05', frontIt: 'l\'imbarco / lo sbarco', frontFr: 'l\'embarquement / le debarquement', exampleIt: 'Imbarco alle ore 18.', category: 'maritime' },
    { id: 'mar-06', frontIt: 'le rotte commerciali', frontFr: 'les routes commerciales', exampleIt: 'Le rotte del Mediterraneo.', category: 'maritime' },

    // ── Loisirs ────────────────────────────────────────────────────────────
    { id: 'loi-01', frontIt: 'il calcio', frontFr: 'le football', phonetic: '[ˈkaltʃo]', exampleIt: 'Gli italiani amano il calcio.', category: 'loisirs_v' },
    { id: 'loi-02', frontIt: 'il nuoto / la piscina', frontFr: 'la natation / la piscine', phonetic: '[ˈnwɔːto]', exampleIt: 'Faccio nuoto due volte a settimana.', category: 'loisirs_v' },
    { id: 'loi-03', frontIt: 'la palestra', frontFr: 'la salle de sport / gym', exampleIt: 'Vado in palestra ogni lunedi\'.', category: 'loisirs_v' },
    { id: 'loi-04', frontIt: 'il viaggio / viaggiare', frontFr: 'le voyage / voyager', phonetic: '[ˈvjaddʒo]', exampleIt: 'Mi piace viaggiare.', category: 'loisirs_v' },
    { id: 'loi-05', frontIt: 'la musica / suonare', frontFr: 'la musique / jouer d\'un instrument', exampleIt: 'Suono la chitarra.', category: 'loisirs_v' },
    { id: 'loi-06', frontIt: 'cucinare', frontFr: 'cuisiner', phonetic: '[kutʃiˈnaːre]', exampleIt: 'Mi piace cucinare la pasta.', category: 'loisirs_v' },
    { id: 'loi-07', frontIt: 'la fotografia', frontFr: 'la photographie', exampleIt: 'Ho una bella macchina fotografica.', category: 'loisirs_v' },
    { id: 'loi-08', frontIt: 'passeggiare / la passeggiata', frontFr: 'se promener / la promenade', exampleIt: 'Facciamo una passeggiata?', category: 'loisirs_v' },
    { id: 'loi-09', frontIt: 'il cinema / guardare un film', frontFr: 'le cinema / regarder un film', exampleIt: 'Andiamo al cinema stasera?', category: 'loisirs_v' },
    { id: 'loi-10', frontIt: 'leggere / la lettura', frontFr: 'lire / la lecture', exampleIt: 'Leggo ogni sera prima di dormire.', category: 'loisirs_v' },

    // ── Accessoires ────────────────────────────────────────────────────────
    { id: 'acc-01', frontIt: 'la borsa / la borsetta', frontFr: 'le sac / le sac a main', phonetic: '[ˈbɔrsa]', exampleIt: 'Una bella borsa di pelle.', category: 'accessoires' },
    { id: 'acc-02', frontIt: 'la cintura', frontFr: 'la ceinture', phonetic: '[tʃinˈtuːra]', exampleIt: 'Una cintura in pelle marrone.', category: 'accessoires' },
    { id: 'acc-03', frontIt: 'gli occhiali (da sole)', frontFr: 'les lunettes (de soleil)', phonetic: '[okˈkjaːli]', exampleIt: 'Ho dimenticato gli occhiali.', category: 'accessoires' },
    { id: 'acc-04', frontIt: 'il cappello', frontFr: 'le chapeau', phonetic: '[kapˈpɛllo]', exampleIt: 'Un cappello di paglia.', category: 'accessoires' },
    { id: 'acc-05', frontIt: 'la sciarpa', frontFr: 'l\'echarpe', phonetic: '[ˈʃarpa]', exampleIt: 'Ho freddo, prendo la sciarpa.', category: 'accessoires' },
    { id: 'acc-06', frontIt: 'i guanti', frontFr: 'les gants', phonetic: '[ˈgwanti]', exampleIt: 'Dove ho messo i guanti?', category: 'accessoires' },
    { id: 'acc-07', frontIt: 'l\'orologio', frontFr: 'la montre', phonetic: '[oroˈlɔdʒo]', exampleIt: 'Il mio orologio e\' svizzero.', category: 'accessoires' },
    { id: 'acc-08', frontIt: 'i gioielli / l\'anello', frontFr: 'les bijoux / la bague', phonetic: '[dʒoˈjɛlli]', exampleIt: 'Porta sempre i suoi gioielli.', category: 'accessoires' },

    // ── Adverbes de lieu ───────────────────────────────────────────────────
    { id: 'lieu-01', frontIt: 'qui / qua', frontFr: 'ici', phonetic: '[kwi]', exampleIt: 'Vieni qui un attimo.', category: 'adv_lieu' },
    { id: 'lieu-02', frontIt: 'la\' / li\'', frontFr: 'la / la-bas', phonetic: '[la]', exampleIt: 'Il libro e\' la\' sul tavolo.', category: 'adv_lieu' },
    { id: 'lieu-03', frontIt: 'sopra / sotto', frontFr: 'au-dessus / en dessous', phonetic: '[ˈsopra] / [ˈsotto]', exampleIt: 'Le chiavi sono sopra il frigo.', category: 'adv_lieu' },
    { id: 'lieu-04', frontIt: 'dentro / fuori', frontFr: 'a l\'interieur / a l\'exterieur', phonetic: '[ˈdɛntro] / [ˈfwɔːri]', exampleIt: 'Il gatto e\' fuori.', category: 'adv_lieu' },
    { id: 'lieu-05', frontIt: 'davanti / dietro', frontFr: 'devant / derriere', exampleIt: 'La macchina e\' parcheggiata davanti.', category: 'adv_lieu' },
    { id: 'lieu-06', frontIt: 'in cima / in fondo', frontFr: 'en haut / au fond', exampleIt: 'In fondo alla pagina.', category: 'adv_lieu' },
    { id: 'lieu-07', frontIt: 'ovunque', frontFr: 'partout', phonetic: '[oˈvuŋkwe]', exampleIt: 'Ho cercato le chiavi ovunque.', category: 'adv_lieu' },
    { id: 'lieu-08', frontIt: 'da nessuna parte', frontFr: 'nulle part', exampleIt: 'Non vado da nessuna parte stasera.', category: 'adv_lieu' },

    // ── Comparaisons (grammaire) ────────────────────────────────────────────
    { id: 'comp-01', frontIt: 'piu\'... di', frontFr: 'plus... que (avec nom/pronom)', phonetic: '[ˈpjuː di]', exampleIt: 'Roma e\' piu\' grande di Milano.', category: 'comparaisons_g' },
    { id: 'comp-02', frontIt: 'meno... di', frontFr: 'moins... que', exampleIt: 'Questo e\' meno caro di quello.', category: 'comparaisons_g' },
    { id: 'comp-03', frontIt: 'cosi\'... come', frontFr: 'aussi... que', phonetic: '[koˈzi koːme]', exampleIt: 'Sono cosi\' stanco come te.', category: 'comparaisons_g' },
    { id: 'comp-04', frontIt: 'tanto... quanto', frontFr: 'autant... que', exampleIt: 'Guadagno tanto quanto lui.', category: 'comparaisons_g' },
    { id: 'comp-05', frontIt: 'il migliore / la migliore', frontFr: 'le/la meilleur(e)', phonetic: '[miˈʎoːre]', exampleIt: 'E\' il migliore ristorante di Roma.', category: 'comparaisons_g' },
    { id: 'comp-06', frontIt: 'bellissimo / -issimo', frontFr: 'tres beau / superlatif absolu -issimo', exampleIt: 'Che panorama bellissimo!', category: 'comparaisons_g' },
    { id: 'comp-07', frontIt: 'ottimo / pessimo', frontFr: 'excellent / tres mauvais', exampleIt: 'Un\'ottima idea!', category: 'comparaisons_g' },
    { id: 'comp-08', frontIt: 'il piu\' + adjectif', frontFr: 'le plus + adjectif (superlatif relatif)', exampleIt: 'E\' il piu\' bravo studente della classe.', category: 'comparaisons_g' },

    // ── Futur (grammaire) ──────────────────────────────────────────────────
    { id: 'fut-01', frontIt: 'parlerò / parlerai / parlerà', frontFr: 'je parlerai / tu parleras / il parlera', exampleIt: 'Parlerai con lui domani.', category: 'futur_g' },
    { id: 'fut-02', frontIt: 'sarò / sarai / sarà', frontFr: 'je serai / tu seras / il sera (essere)', exampleIt: 'Sara\' una bella giornata.', category: 'futur_g' },
    { id: 'fut-03', frontIt: 'avrò / avrai / avrà', frontFr: 'j\'aurai / tu auras / il aura (avere)', exampleIt: 'Avro\' piu\' tempo la settimana prossima.', category: 'futur_g' },
    { id: 'fut-04', frontIt: 'andrò / andrai / andrà', frontFr: 'j\'irai / tu iras / il ira (andare)', exampleIt: 'Andro\' in Italia quest\'estate.', category: 'futur_g' },
    { id: 'fut-05', frontIt: 'verrò / verrai / verrà', frontFr: 'je viendrai / tu viendras / il viendra (venire)', exampleIt: 'Verra\' anche lui alla festa.', category: 'futur_g' },
    { id: 'fut-06', frontIt: 'farò / farai / farà', frontFr: 'je ferai / tu feras / il fera (fare)', exampleIt: 'Cosa farai domani?', category: 'futur_g' },
    { id: 'fut-07', frontIt: 'fra / tra + duree', frontFr: 'dans + duree', phonetic: '[fra] / [tra]', exampleIt: 'Fra due giorni arriva.', category: 'futur_g' },

    // ── Possessifs (grammaire) ─────────────────────────────────────────────
    { id: 'pos-01', frontIt: 'mio / mia / miei / mie', frontFr: 'mon / ma / mes', phonetic: '[ˈmiːo]', exampleIt: 'Il mio libro, la mia casa.', category: 'possessifs_g' },
    { id: 'pos-02', frontIt: 'tuo / tua / tuoi / tue', frontFr: 'ton / ta / tes', exampleIt: 'Tuo fratello e\' simpatico.', category: 'possessifs_g' },
    { id: 'pos-03', frontIt: 'suo / sua / suoi / sue', frontFr: 'son / sa / ses (ou votre/vos)', exampleIt: 'La sua macchina e\' nuova.', category: 'possessifs_g' },
    { id: 'pos-04', frontIt: 'nostro / nostra / nostri / nostre', frontFr: 'notre / nos', exampleIt: 'Il nostro ufficio e\' in centro.', category: 'possessifs_g' },
    { id: 'pos-05', frontIt: 'vostro / vostra / vostri / vostre', frontFr: 'votre / vos', exampleIt: 'Vostro figlio e\' bravo.', category: 'possessifs_g' },
    { id: 'pos-06', frontIt: 'loro (invariable)', frontFr: 'leur / leurs', exampleIt: 'La loro proposta e\' interessante.', category: 'possessifs_g' },
    { id: 'pos-07', frontIt: 'mio padre (sans article!)', frontFr: 'mon pere (pas d\'article avec famille sing.)', exampleIt: 'Mio padre, tua sorella, sua madre.', category: 'possessifs_g' },

    // ── Demonstratifs (grammaire) ──────────────────────────────────────────
    { id: 'dem-01', frontIt: 'questo / questa', frontFr: 'ce / cette (pres du locuteur)', phonetic: '[ˈkwesto]', exampleIt: 'Questo libro e\' mio.', category: 'demonstratifs_g' },
    { id: 'dem-02', frontIt: 'questi / queste', frontFr: 'ces (pres du locuteur)', exampleIt: 'Questi sono i miei colleghi.', category: 'demonstratifs_g' },
    { id: 'dem-03', frontIt: 'quello / quella', frontFr: 'ce / cette (loin du locuteur)', phonetic: '[ˈkwɛllo]', exampleIt: 'Quello studente e\' bravo.', category: 'demonstratifs_g' },
    { id: 'dem-04', frontIt: 'quelli / quelle', frontFr: 'ces (loin du locuteur)', exampleIt: 'Quelli sono i tuoi amici?', category: 'demonstratifs_g' },
    { id: 'dem-05', frontIt: 'questo qui / quello la\'', frontFr: 'celui-ci / celui-la', exampleIt: 'Preferisco questo qui.', category: 'demonstratifs_g' },
    { id: 'dem-06', frontIt: 'cio\' / cio\' che', frontFr: 'cela / ce que', phonetic: '[tʃɔ]', exampleIt: 'Cio\' che dici e\' importante.', category: 'demonstratifs_g' },

    // ── Gouts (grammaire) ──────────────────────────────────────────────────
    { id: 'gou-01', frontIt: 'Mi piace + sing./infinitif', frontFr: 'J\'aime + singulier / verbe', phonetic: '[mi ˈpjaːtʃe]', exampleIt: 'Mi piace la pizza. Mi piace nuotare.', category: 'gouts_g' },
    { id: 'gou-02', frontIt: 'Mi piacciono + pluriel', frontFr: 'J\'aime + pluriel', phonetic: '[mi pjaˈtʃoːno]', exampleIt: 'Mi piacciono i film italiani.', category: 'gouts_g' },
    { id: 'gou-03', frontIt: 'Non mi piace / Non mi piacciono', frontFr: 'Je n\'aime pas', exampleIt: 'Non mi piacciono le verdure.', category: 'gouts_g' },
    { id: 'gou-04', frontIt: 'Adoro', frontFr: 'J\'adore', phonetic: '[aˈdɔːro]', exampleIt: 'Adoro la cucina italiana.', category: 'gouts_g' },
    { id: 'gou-05', frontIt: 'Odio', frontFr: 'Je deteste', phonetic: '[ˈɔːdjo]', exampleIt: 'Odio aspettare.', category: 'gouts_g' },
    { id: 'gou-06', frontIt: 'Preferisco + A a B', frontFr: 'Je prefere A a B', exampleIt: 'Preferisco il caffe\' al te\'.', category: 'gouts_g' },
    { id: 'gou-07', frontIt: 'Non sopporto', frontFr: 'Je ne supporte pas', exampleIt: 'Non sopporto il traffico.', category: 'gouts_g' },
    { id: 'gou-08', frontIt: 'Mi fa impazzire', frontFr: 'Ca me rend fou / J\'en suis fou', exampleIt: 'La pasta mi fa impazzire!', category: 'gouts_g' },

    // ── Heure ──────────────────────────────────────────────────────────────
    { id: 'eur-01', frontIt: 'Che ore sono?', frontFr: 'Quelle heure est-il?', exampleIt: 'Scusi, che ore sono?', category: 'heure' },
    { id: 'eur-02', frontIt: 'E\' l\'una', frontFr: 'Il est une heure', phonetic: '[ɛ lˈuːna]', exampleIt: 'E\' l\'una di notte.', category: 'heure' },
    { id: 'eur-03', frontIt: 'Sono le tre e mezza', frontFr: 'Il est trois heures et demie', exampleIt: 'Sono le tre e mezza del pomeriggio.', category: 'heure' },
    { id: 'eur-04', frontIt: 'e un quarto / meno un quarto', frontFr: 'et quart / moins le quart', exampleIt: 'Sono le dieci e un quarto.', category: 'heure' },
    { id: 'eur-05', frontIt: 'A che ora...?', frontFr: 'A quelle heure...?', exampleIt: 'A che ora apre il negozio?', category: 'heure' },
    { id: 'eur-06', frontIt: 'alle + ora / verso le + ora', frontFr: 'a (heure) / vers (heure)', exampleIt: 'Ci vediamo alle cinque.', category: 'heure' },
    { id: 'eur-07', frontIt: 'di mattina / di sera / di notte', frontFr: 'le matin / le soir / la nuit', exampleIt: 'Mi sveglio alle 7 di mattina.', category: 'heure' },

    // ── Phrases generales ──────────────────────────────────────────────────
    { id: 'phr-01', frontIt: 'Non lo so', frontFr: 'Je ne sais pas', exampleIt: 'Non lo so esattamente.', category: 'phrases_gen' },
    { id: 'phr-02', frontIt: 'Dipende', frontFr: 'Ca depend', phonetic: '[diˈpɛnde]', exampleIt: 'Dipende dalla situazione.', category: 'phrases_gen' },
    { id: 'phr-03', frontIt: 'Hai ragione / Ha ragione', frontFr: 'Tu as raison / Vous avez raison', exampleIt: 'Hai ragione, e\' una buona idea.', category: 'phrases_gen' },
    { id: 'phr-04', frontIt: 'Magari!', frontFr: 'Si seulement! / Ce serait super!', exampleIt: 'Andiamo in Italia? — Magari!', category: 'phrases_gen' },
    { id: 'phr-05', frontIt: 'Meno male!', frontFr: 'Heureusement! / Ouf!', exampleIt: 'Hai trovato le chiavi. Meno male!', category: 'phrases_gen' },
    { id: 'phr-06', frontIt: 'In bocca al lupo!', frontFr: 'Bonne chance!', exampleIt: 'Hai un esame domani? In bocca al lupo!', category: 'phrases_gen' },
    { id: 'phr-07', frontIt: 'Piano piano', frontFr: 'Doucement / Petit a petit', exampleIt: 'Piano piano, imparerai l\'italiano.', category: 'phrases_gen' },
    { id: 'phr-08', frontIt: 'Tutto sommato', frontFr: 'Tout compte fait', exampleIt: 'Tutto sommato, e\' stata una bella giornata.', category: 'phrases_gen' },
  ];

  for (const c of cards) {
    await db.runAsync(
      `INSERT OR IGNORE INTO sm2_cards (id, front_it, front_fr, phonetic, example_it, category, interval, ease_factor, repetitions, next_review)
       VALUES (?, ?, ?, ?, ?, ?, 1, 2.5, 0, 0)`,
      [c.id, c.frontIt, c.frontFr, c.phonetic ?? null, c.exampleIt ?? null, c.category],
    );
  }
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

export async function getScenarios(): Promise<ScenarioRow[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<ScenarioDbRow>('SELECT * FROM scenarios ORDER BY created_at ASC');
  return rows.map(mapScenario);
}

export async function getScenarioById(scenarioId: string): Promise<ScenarioRow | null> {
  const db = await getItalproDb();
  const row = await db.getFirstAsync<ScenarioDbRow>('SELECT * FROM scenarios WHERE id = ?', scenarioId);
  return row ? mapScenario(row) : null;
}

// ─── Dialogue messages ────────────────────────────────────────────────────────

export async function getMessages(scenarioId: string): Promise<DialogueMessageRow[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<MessageDbRow>(
    'SELECT * FROM dialogue_messages WHERE scenario_id = ? ORDER BY turn_index ASC, created_at ASC',
    scenarioId,
  );
  return rows.map(mapMessage);
}

export async function ensureConversationStarted(scenario: ScenarioRow): Promise<void> {
  const db = await getItalproDb();
  const countRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM dialogue_messages WHERE scenario_id = ?',
    scenario.id,
  );
  if ((countRow?.count ?? 0) > 0) return;

  await insertMessage({
    scenarioId: scenario.id,
    role: 'client',
    contentIt: scenario.starterIt,
    contentFr: scenario.starterFr,
    coachingNote: 'Objectif: rassurer, poser une question utile et garder le vouvoiement Lei.',
  });
}

export async function insertMessage(input: {
  scenarioId: string;
  role: MessageRole;
  contentIt: string;
  contentFr: string;
  coachingNote?: string | null;
}): Promise<DialogueMessageRow> {
  const db = await getItalproDb();
  const turnRow = await db.getFirstAsync<{ nextTurn: number }>(
    'SELECT COALESCE(MAX(turn_index), -1) + 1 as nextTurn FROM dialogue_messages WHERE scenario_id = ?',
    input.scenarioId,
  );
  const now = new Date().toISOString();
  const message: DialogueMessageRow = {
    id: makeId(input.role),
    scenarioId: input.scenarioId,
    role: input.role,
    contentIt: input.contentIt.trim(),
    contentFr: input.contentFr.trim(),
    coachingNote: input.coachingNote ?? null,
    turnIndex: turnRow?.nextTurn ?? 0,
    createdAt: now,
  };

  await db.runAsync(
    `INSERT INTO dialogue_messages (id, scenario_id, role, content_it, content_fr, coaching_note, turn_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [message.id, message.scenarioId, message.role, message.contentIt, message.contentFr, message.coachingNote, message.turnIndex, message.createdAt],
  );

  return message;
}

// ─── Corrections ──────────────────────────────────────────────────────────────

export async function getLatestCorrection(scenarioId: string): Promise<CorrectionRow | null> {
  const db = await getItalproDb();
  const row = await db.getFirstAsync<CorrectionDbRow>(
    'SELECT * FROM corrections WHERE scenario_id = ? ORDER BY created_at DESC LIMIT 1',
    scenarioId,
  );
  return row ? mapCorrection(row) : null;
}

export async function getRecentCorrections(limit = 5): Promise<CorrectionRow[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<CorrectionDbRow>(
    'SELECT * FROM corrections ORDER BY created_at DESC LIMIT ?',
    limit,
  );
  return rows.map(mapCorrection);
}

export async function getCorrectionsForScenario(scenarioId: string): Promise<CorrectionRow[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<CorrectionDbRow>(
    'SELECT * FROM corrections WHERE scenario_id = ? ORDER BY created_at ASC',
    [scenarioId],
  );
  return rows.map(mapCorrection);
}

export async function insertCorrection(input: {
  messageId: string;
  scenarioId: string;
  score: number;
  correctedIt: string;
  feedbackFr: string;
  nextFocus: string[];
}): Promise<CorrectionRow> {
  const db = await getItalproDb();
  const correction: CorrectionRow = {
    id: makeId('correction'),
    messageId: input.messageId,
    scenarioId: input.scenarioId,
    score: input.score,
    correctedIt: input.correctedIt,
    feedbackFr: input.feedbackFr,
    nextFocus: input.nextFocus,
    createdAt: new Date().toISOString(),
  };

  await db.runAsync(
    `INSERT INTO corrections (id, message_id, scenario_id, score, corrected_it, feedback_fr, next_focus_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [correction.id, correction.messageId, correction.scenarioId, correction.score, correction.correctedIt, correction.feedbackFr, JSON.stringify(correction.nextFocus), correction.createdAt],
  );

  return correction;
}

export async function insertSm2Card(input: {
  id?: string;
  frontIt: string;
  frontFr: string;
  phonetic?: string | null;
  exampleIt?: string | null;
  category: string;
}): Promise<void> {
  const db = await getItalproDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO sm2_cards (id, front_it, front_fr, phonetic, example_it, category, interval, ease_factor, repetitions, next_review)
     VALUES (?, ?, ?, ?, ?, ?, 1, 2.5, 0, 0)`,
    [
      input.id ?? makeId('sm2'),
      input.frontIt.trim(),
      input.frontFr.trim(),
      input.phonetic ?? null,
      input.exampleIt ?? null,
      input.category,
    ],
  );
}

export async function addFocusCardsFromCorrection(correction: CorrectionRow): Promise<void> {
  const cleanFocus = correction.nextFocus
    .map((focus) => focus.trim())
    .filter((focus) => focus.length > 0)
    .slice(0, 4);

  for (const focus of cleanFocus) {
    const id = `focus-${focus.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`;
    await insertSm2Card({
      id,
      frontIt: correction.correctedIt,
      frontFr: focus,
      exampleIt: correction.feedbackFr,
      category: 'erreurs_recurrentes',
    });
  }
}

export async function getRecurringFocusStats(limit = 5): Promise<FocusStatRow[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<CorrectionDbRow>('SELECT * FROM corrections ORDER BY created_at DESC LIMIT 80');
  const stats = new Map<string, { count: number; lastSeenAt: string }>();

  for (const row of rows) {
    for (const focus of parseJsonArray(row.next_focus_json)) {
      const current = stats.get(focus);
      stats.set(focus, {
        count: (current?.count ?? 0) + 1,
        lastSeenAt: current?.lastSeenAt ?? row.created_at,
      });
    }
  }

  return [...stats.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([focus, value]) => ({ focus, count: value.count, lastSeenAt: value.lastSeenAt }));
}

export async function resetConversation(scenarioId: string): Promise<void> {
  const db = await getItalproDb();
  await db.runAsync('DELETE FROM corrections WHERE scenario_id = ?', scenarioId);
  await db.runAsync('DELETE FROM dialogue_messages WHERE scenario_id = ?', scenarioId);
  const scenario = await getScenarioById(scenarioId);
  if (scenario) await ensureConversationStarted(scenario);
}

// ─── SM-2 Cards ───────────────────────────────────────────────────────────────

export async function getDueCards(limit = 20): Promise<Sm2CardRow[]> {
  const db = await getItalproDb();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const rows = await db.getAllAsync<Sm2CardDbRow>(
    'SELECT * FROM sm2_cards WHERE next_review <= ? ORDER BY next_review ASC LIMIT ?',
    [nowSeconds, limit],
  );
  return rows.map(mapSm2Card);
}

export async function getAllCards(): Promise<Sm2CardRow[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<Sm2CardDbRow>(
    'SELECT * FROM sm2_cards ORDER BY RANDOM()',
  );
  return rows.map(mapSm2Card);
}


export async function getSm2Stats(): Promise<{ dueCount: number; totalCards: number; masteredCount: number }> {
  const db = await getItalproDb();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const [dueRow, totalRow, masteredRow] = await Promise.all([
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sm2_cards WHERE next_review <= ?', [nowSeconds]),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sm2_cards'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sm2_cards WHERE repetitions >= 3'),
  ]);
  return {
    dueCount: dueRow?.count ?? 0,
    totalCards: totalRow?.count ?? 0,
    masteredCount: masteredRow?.count ?? 0,
  };
}

export async function updateCardAfterReview(id: string, quality: 0 | 1 | 2 | 3 | 4 | 5): Promise<void> {
  const db = await getItalproDb();
  const row = await db.getFirstAsync<Sm2CardDbRow>('SELECT * FROM sm2_cards WHERE id = ?', [id]);
  if (!row) return;

  let { interval, ease_factor, repetitions } = row;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ease_factor);
    repetitions += 1;
  }

  ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease_factor < 1.3) ease_factor = 1.3;

  const nextReviewSeconds = Math.floor(Date.now() / 1000) + interval * 24 * 60 * 60;

  await db.runAsync(
    'UPDATE sm2_cards SET interval = ?, ease_factor = ?, repetitions = ?, next_review = ? WHERE id = ?',
    [interval, ease_factor, repetitions, nextReviewSeconds, id],
  );
}

// ─── Learning Sessions ────────────────────────────────────────────────────────

export async function insertLearningSession(params: {
  sessionType: LearningSessionType;
  durationSeconds: number;
  cardsReviewed: number;
  scoreAvg?: number | null;
}): Promise<void> {
  const db = await getItalproDb();
  const id = makeId('session');
  await db.runAsync(
    `INSERT INTO learning_sessions (id, session_type, duration_seconds, cards_reviewed, score_avg)
     VALUES (?, ?, ?, ?, ?)`,
    [id, params.sessionType, params.durationSeconds, params.cardsReviewed, params.scoreAvg ?? null],
  );
}

export async function getTodayStats(): Promise<{ minutesToday: number; sessionsToday: number }> {
  const db = await getItalproDb();
  const row = await db.getFirstAsync<{ total_seconds: number | null; session_count: number }>(
    `SELECT SUM(duration_seconds) as total_seconds, COUNT(*) as session_count
     FROM learning_sessions
     WHERE date(created_at, 'unixepoch') = date('now')`,
  );
  return {
    minutesToday: Math.floor((row?.total_seconds ?? 0) / 60),
    sessionsToday: row?.session_count ?? 0,
  };
}

export async function getStreak(): Promise<number> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<{ day: string }>(
    `SELECT DISTINCT date(created_at, 'unixepoch') as day
     FROM learning_sessions
     ORDER BY day DESC
     LIMIT 60`,
  );

  if (rows.length === 0) return 0;

  const toDateStr = (d: Date) => d.toISOString().split('T')[0] ?? '';

  const today = new Date();
  const todayStr = toDateStr(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = toDateStr(yesterday);

  const lastDay = rows[0]?.day ?? '';
  if (lastDay !== todayStr && lastDay !== yesterdayStr) return 0;

  let streak = 0;
  let checkDate = new Date(lastDay + 'T12:00:00Z');

  for (const row of rows) {
    if (row.day === toDateStr(checkDate)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export async function getRecentSessions(limit = 8): Promise<LearningSessionRow[]> {
  const db = await getItalproDb();
  type SessionDbRow = {
    id: string;
    session_type: LearningSessionType;
    duration_seconds: number;
    cards_reviewed: number;
    score_avg: number | null;
    created_at: number;
  };
  const rows = await db.getAllAsync<SessionDbRow>(
    'SELECT * FROM learning_sessions ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    sessionType: r.session_type,
    durationSeconds: r.duration_seconds,
    cardsReviewed: r.cards_reviewed,
    scoreAvg: r.score_avg,
    createdAt: new Date(r.created_at * 1000).toISOString(),
  }));
}

export async function getLearningSessionCountByType(sessionType: LearningSessionType): Promise<number> {
  const db = await getItalproDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM learning_sessions WHERE session_type = ?',
    [sessionType],
  );
  return row?.count ?? 0;
}

export async function getCompletedLessonCount(): Promise<number> {
  const db = await getItalproDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM lesson_progress WHERE status = 'completed'",
  );
  return row?.count ?? 0;
}

export async function getWeekActivity(): Promise<boolean[]> {
  const db = await getItalproDb();
  const result: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0] ?? '';
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM learning_sessions WHERE date(created_at, 'unixepoch') = ?`,
      [dateStr],
    );
    result.push((row?.count ?? 0) > 0);
  }
  return result;
}

// ─── B2B operational tools ───────────────────────────────────────────────────

export async function logNumberLookup(input: {
  inputValue: string;
  spokenIt: string;
  mode: string;
}): Promise<void> {
  const db = await getItalproDb();
  const id = makeId('number');
  await db.runAsync(
    `INSERT INTO b2b_number_lookups (id, input_value, spoken_it, mode, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [id, input.inputValue, input.spokenIt, input.mode],
  );
  await insertSm2Card({
    id: `number-${input.inputValue.replace(/[^0-9a-zA-Z]+/g, '-')}-${input.mode}`,
    frontIt: input.spokenIt,
    frontFr: input.inputValue,
    category: 'numbers_drill',
  });
}

export async function getRecentNumberLookups(limit = 8): Promise<NumberLookupRow[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<{
    id: string;
    input_value: string;
    spoken_it: string;
    mode: string;
    created_at: string;
  }>('SELECT * FROM b2b_number_lookups ORDER BY created_at DESC LIMIT ?', [limit]);
  return rows.map((row) => ({
    id: row.id,
    inputValue: row.input_value,
    spokenIt: row.spoken_it,
    mode: row.mode,
    createdAt: row.created_at,
  }));
}

export async function saveCallReplay(input: {
  scenarioId: string;
  title: string;
  audioUri: string;
  durationSeconds: number;
  score?: number | null;
}): Promise<void> {
  const db = await getItalproDb();
  await db.runAsync(
    `INSERT INTO call_replays (id, scenario_id, title, audio_uri, duration_seconds, score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [makeId('replay'), input.scenarioId, input.title, input.audioUri, input.durationSeconds, input.score ?? null],
  );
}

export async function getCallReplays(limit = 12): Promise<CallReplayRow[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<{
    id: string;
    scenario_id: string;
    title: string;
    audio_uri: string;
    duration_seconds: number;
    score: number | null;
    created_at: string;
  }>('SELECT * FROM call_replays ORDER BY created_at DESC LIMIT ?', [limit]);
  return rows.map((row) => ({
    id: row.id,
    scenarioId: row.scenario_id,
    title: row.title,
    audioUri: row.audio_uri,
    durationSeconds: row.duration_seconds,
    score: row.score,
    createdAt: row.created_at,
  }));
}

export async function upsertPhonemeAttempt(phoneme: string, missed: boolean): Promise<void> {
  const db = await getItalproDb();
  await db.runAsync(
    `INSERT INTO phoneme_stats (phoneme, misses, attempts, updated_at)
     VALUES (?, ?, 1, datetime('now'))
     ON CONFLICT(phoneme) DO UPDATE SET
       misses = misses + ?,
       attempts = attempts + 1,
       updated_at = datetime('now')`,
    [phoneme, missed ? 1 : 0, missed ? 1 : 0],
  );
}

export async function getPhonemeStats(): Promise<PhonemeStatRow[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<{
    phoneme: string;
    misses: number;
    attempts: number;
    updated_at: string;
  }>('SELECT * FROM phoneme_stats ORDER BY misses DESC, attempts DESC');
  return rows.map((row) => ({
    phoneme: row.phoneme,
    misses: row.misses,
    attempts: row.attempts,
    updatedAt: row.updated_at,
  }));
}

export type DayProgressRow = {
  daysActive: number;
  daysSinceStart: number;
  firstSessionAt: string | null;
};

export async function getDayProgress(): Promise<DayProgressRow> {
  const db = await getItalproDb();
  const distinctRow = await db.getFirstAsync<{ days: number; first_at: string | null }>(
    `SELECT COUNT(DISTINCT date(created_at, 'unixepoch')) as days,
            MIN(created_at) as first_at
     FROM learning_sessions`,
  );

  const daysActive = distinctRow?.days ?? 0;
  const firstUnix = distinctRow?.first_at ? Number(distinctRow.first_at) : null;
  const firstSessionAt = firstUnix ? new Date(firstUnix * 1000).toISOString() : null;

  let daysSinceStart = 0;
  if (firstUnix) {
    const elapsedMs = Date.now() - firstUnix * 1000;
    daysSinceStart = Math.max(1, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)) + 1);
  }

  return { daysActive, daysSinceStart, firstSessionAt };
}

// ─── XP, achievements and lesson gates ───────────────────────────────────────

export function getLevelFromXp(totalXp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, totalXp) / 100)) + 1;
}

function getLevelStartXp(level: number): number {
  return Math.pow(Math.max(1, level) - 1, 2) * 100;
}

function mapXpProfile(totalXp: number, updatedAt: string): XpProfileRow {
  const level = getLevelFromXp(totalXp);
  const start = getLevelStartXp(level);
  const next = getLevelStartXp(level + 1);
  return {
    id: 'local',
    totalXp,
    level,
    xpIntoLevel: totalXp - start,
    xpForNextLevel: next - start,
    updatedAt,
  };
}

export async function getXpProfile(): Promise<XpProfileRow> {
  const db = await getItalproDb();
  await db.runAsync("INSERT OR IGNORE INTO xp_profile (id, total_xp, updated_at) VALUES ('local', 0, datetime('now'))");
  const row = await db.getFirstAsync<{ total_xp: number; updated_at: string }>(
    "SELECT total_xp, updated_at FROM xp_profile WHERE id = 'local'",
  );
  return mapXpProfile(row?.total_xp ?? 0, row?.updated_at ?? new Date().toISOString());
}

export async function addXp(amount: number): Promise<XpProfileRow> {
  const db = await getItalproDb();
  const rounded = Math.round(amount);
  await db.runAsync("INSERT OR IGNORE INTO xp_profile (id, total_xp, updated_at) VALUES ('local', 0, datetime('now'))");
  await db.runAsync(
    "UPDATE xp_profile SET total_xp = MAX(0, total_xp + ?), updated_at = datetime('now') WHERE id = 'local'",
    [rounded],
  );
  if (rounded !== 0) {
    await db.runAsync('INSERT INTO xp_log (amount, earned_at) VALUES (?, unixepoch())', [rounded]);
  }
  return getXpProfile();
}

export async function getDailyXpEarned(): Promise<number> {
  const db = await getItalproDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM xp_log WHERE date(earned_at, 'unixepoch') = date('now')`,
  );
  return Math.max(0, row?.total ?? 0);
}

export async function getWeeklyXpHistory(weeks = 8): Promise<{ label: string; xp: number }[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<{ week: string; xp: number }>(
    `SELECT strftime('%Y-W%W', earned_at, 'unixepoch') as week, COALESCE(SUM(amount), 0) as xp
     FROM xp_log
     WHERE earned_at >= unixepoch('now', '-${weeks * 7} days')
     GROUP BY week
     ORDER BY week ASC`,
  );
  return rows.map((row) => ({ label: row.week, xp: row.xp }));
}

export async function getDailySetting(key: string, defaultValue: string): Promise<string> {
  const db = await getItalproDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? defaultValue;
}

export async function setDailySetting(key: string, value: string): Promise<void> {
  const db = await getItalproDb();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

export async function getDailyPhrase(): Promise<DailyPhrase | null> {
  const raw = await getDailySetting('daily_phrase_json', '');
  if (!raw) return null;
  try {
    const phrase = JSON.parse(raw) as DailyPhrase;
    const today = new Date().toISOString().slice(0, 10);
    return phrase.date === today ? phrase : null;
  } catch {
    return null;
  }
}

export async function saveDailyPhrase(phrase: DailyPhrase): Promise<void> {
  await setDailySetting('daily_phrase_json', JSON.stringify(phrase));
}

export async function getUnlockedAchievements(): Promise<AchievementUnlockRow[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<{ achievement_id: string; unlocked_at: string }>(
    'SELECT achievement_id, unlocked_at FROM achievement_unlocks ORDER BY unlocked_at DESC',
  );
  return rows.map((row) => ({ achievementId: row.achievement_id, unlockedAt: row.unlocked_at }));
}

export async function unlockAchievement(achievementId: string): Promise<boolean> {
  const db = await getItalproDb();
  const existing = await db.getFirstAsync<{ achievement_id: string }>(
    'SELECT achievement_id FROM achievement_unlocks WHERE achievement_id = ?',
    [achievementId],
  );
  if (existing) return false;
  await db.runAsync('INSERT INTO achievement_unlocks (achievement_id, unlocked_at) VALUES (?, datetime(\'now\'))', [
    achievementId,
  ]);
  return true;
}

export async function getLessonProgress(): Promise<LessonProgressRow[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<{
    lesson_id: string;
    status: LessonStatus;
    quiz_score: number | null;
    completed_at: string | null;
    updated_at: string;
  }>('SELECT lesson_id, status, quiz_score, completed_at, updated_at FROM lesson_progress ORDER BY rowid ASC');
  return rows.map((row) => ({
    lessonId: row.lesson_id,
    status: row.status,
    quizScore: row.quiz_score,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  }));
}

export async function ensureLessonProgressSeed(
  lessonIds: string[],
  initiallyAvailableLessonIds: string[] = lessonIds.slice(0, 1),
): Promise<LessonProgressRow[]> {
  const db = await getItalproDb();
  const initialAvailable = new Set(initiallyAvailableLessonIds);
  for (const [index, lessonId] of lessonIds.entries()) {
    await db.runAsync(
      `INSERT OR IGNORE INTO lesson_progress (lesson_id, status, updated_at)
       VALUES (?, ?, datetime('now'))`,
      [lessonId, index === 0 || initialAvailable.has(lessonId) ? 'available' : 'locked'],
    );
  }
  for (const lessonId of initiallyAvailableLessonIds) {
    await db.runAsync(
      `UPDATE lesson_progress
       SET status = 'available', updated_at = datetime('now')
       WHERE lesson_id = ? AND status = 'locked'`,
      [lessonId],
    );
  }
  return getLessonProgress();
}

export async function completeLessonGate(params: {
  lessonId: string;
  nextLessonId?: string | null;
  score: number;
}): Promise<void> {
  const db = await getItalproDb();
  const passed = params.score >= 80;
  await db.runAsync(
    `UPDATE lesson_progress
     SET status = ?, quiz_score = ?, completed_at = CASE WHEN ? THEN datetime('now') ELSE completed_at END, updated_at = datetime('now')
     WHERE lesson_id = ?`,
    [passed ? 'completed' : 'available', params.score, passed ? 1 : 0, params.lessonId],
  );

  if (passed && params.nextLessonId) {
    await db.runAsync(
      `INSERT INTO lesson_progress (lesson_id, status, updated_at)
       VALUES (?, 'available', datetime('now'))
       ON CONFLICT(lesson_id) DO UPDATE SET
         status = CASE WHEN status = 'locked' THEN 'available' ELSE status END,
         updated_at = datetime('now')`,
      [params.nextLessonId],
    );
  }
}

// ─── Cached Quiz Items ────────────────────────────────────────────────────────

export type CachedQuizItemRow = {
  id: string;
  it: string;
  fr: string;
  phonetic: string | null;
  category: string;
  explanation: string | null;
};

export async function getCachedQuizItems(): Promise<CachedQuizItemRow[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<{
    id: string;
    it: string;
    fr: string;
    phonetic: string | null;
    category: string;
    explanation: string | null;
  }>('SELECT id, it, fr, phonetic, category, explanation FROM cached_quiz_items ORDER BY created_at DESC');
  return rows;
}

export async function insertCachedQuizItems(
  items: {
    id: string;
    it: string;
    fr: string;
    phonetic?: string;
    category: string;
    explanation?: string;
  }[]
): Promise<void> {
  const db = await getItalproDb();
  for (const item of items) {
    await db.runAsync(
      `INSERT OR IGNORE INTO cached_quiz_items (id, it, fr, phonetic, category, explanation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [item.id, item.it, item.fr, item.phonetic ?? null, item.category, item.explanation ?? null]
    );
  }
}

// ─── Cached AI dialogue content (call simulator) ───────────────────────────────
//
// Client questions and guided reply choices generated by the AI during a call
// are cached on-device, indexed by scenario + mood + topic. When the AI is
// unavailable later, these enrich the offline experience instead of always
// replaying the same predefined bank.

function djb2(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export type CachedClientReply = {
  contentIt: string;
  contentFr: string;
  coachingNote: string | null;
};

export async function insertCachedClientReply(input: {
  scenarioId: string;
  mood: string;
  topic: string;
  contentIt: string;
  contentFr: string;
  coachingNote?: string | null;
}): Promise<void> {
  const db = await getItalproDb();
  const id = `${input.scenarioId}|${input.mood}|${input.topic}|${djb2(input.contentIt)}`;
  await db.runAsync(
    `INSERT OR IGNORE INTO cached_client_replies (id, scenario_id, mood, topic, content_it, content_fr, coaching_note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.scenarioId, input.mood, input.topic, input.contentIt, input.contentFr, input.coachingNote ?? null]
  );
}

export async function getCachedClientReplies(
  scenarioId: string,
  mood: string,
  topic: string
): Promise<CachedClientReply[]> {
  const db = await getItalproDb();
  return db.getAllAsync<CachedClientReply>(
    `SELECT content_it AS contentIt, content_fr AS contentFr, coaching_note AS coachingNote
     FROM cached_client_replies
     WHERE scenario_id = ? AND mood = ? AND topic = ?
     ORDER BY created_at DESC LIMIT 20`,
    [scenarioId, mood, topic]
  );
}

export async function insertCachedGuidedChoices(input: {
  scenarioId: string;
  mood: string;
  topic: string;
  choicesJson: string;
}): Promise<void> {
  const db = await getItalproDb();
  const id = `${input.scenarioId}|${input.mood}|${input.topic}|${djb2(input.choicesJson)}`;
  await db.runAsync(
    `INSERT OR IGNORE INTO cached_guided_choices (id, scenario_id, mood, topic, choices_json)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.scenarioId, input.mood, input.topic, input.choicesJson]
  );
}

export async function getCachedGuidedChoiceSets(
  scenarioId: string,
  mood: string,
  topic: string
): Promise<string[]> {
  const db = await getItalproDb();
  const rows = await db.getAllAsync<{ choicesJson: string }>(
    `SELECT choices_json AS choicesJson
     FROM cached_guided_choices
     WHERE scenario_id = ? AND mood = ? AND topic = ?
     ORDER BY created_at DESC LIMIT 20`,
    [scenarioId, mood, topic]
  );
  return rows.map((r) => r.choicesJson);
}
