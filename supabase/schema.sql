-- MercatoTalk Supabase schema
-- Execute in Supabase SQL Editor after creating a free project.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  native_language text not null default 'fr',
  target_language text not null default 'it',
  level text not null default 'A1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  front_fr text not null,
  back_it text not null,
  phonetic text,
  module text not null,
  interval_days integer not null default 0,
  ease_factor numeric(4, 2) not null default 2.50,
  repetitions integer not null default 0,
  due_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.dialogue_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null,
  title text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dialogue_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.dialogue_sessions(id) on delete cascade,
  role text not null check (role in ('client', 'learner', 'coach')),
  content_it text not null,
  content_fr text,
  turn_index integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audio_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.dialogue_sessions(id) on delete set null,
  message_id uuid references public.dialogue_messages(id) on delete set null,
  provider text not null check (provider in ('groq-whisper', 'deepgram-tts', 'edge-neural-tts', 'expo-speech')),
  direction text not null check (direction in ('stt', 'tts')),
  language text,
  duration_ms integer,
  transcript text,
  status text not null default 'processed',
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.corrections (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.dialogue_messages(id) on delete cascade,
  session_id uuid not null references public.dialogue_sessions(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  corrected_it text not null,
  feedback_fr text not null,
  next_focus jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.call_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.dialogue_sessions(id) on delete set null,
  global_score integer not null check (global_score between 0 and 100),
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.learning_cards enable row level security;
alter table public.dialogue_sessions enable row level security;
alter table public.dialogue_messages enable row level security;
alter table public.audio_events enable row level security;
alter table public.corrections enable row level security;
alter table public.call_reports enable row level security;

create policy "profiles own rows"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "learning cards own rows"
  on public.learning_cards for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "dialogue sessions own rows"
  on public.dialogue_sessions for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "dialogue messages through owned session"
  on public.dialogue_messages for all
  using (
    exists (
      select 1 from public.dialogue_sessions
      where dialogue_sessions.id = dialogue_messages.session_id
      and dialogue_sessions.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.dialogue_sessions
      where dialogue_sessions.id = dialogue_messages.session_id
      and dialogue_sessions.owner_id = auth.uid()
    )
  );

create policy "audio events own rows"
  on public.audio_events for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "corrections through owned session"
  on public.corrections for all
  using (
    exists (
      select 1 from public.dialogue_sessions
      where dialogue_sessions.id = corrections.session_id
      and dialogue_sessions.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.dialogue_sessions
      where dialogue_sessions.id = corrections.session_id
      and dialogue_sessions.owner_id = auth.uid()
    )
  );

create policy "call reports own rows"
  on public.call_reports for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
