export const ITALPRO_LOCAL_SCHEMA_SQL = `
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
`;
