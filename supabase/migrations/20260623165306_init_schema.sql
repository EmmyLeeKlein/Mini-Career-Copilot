-- Career Copilot — initial schema: auth profile, prep kits, saved questions,
-- answer drafts, and mock interview simulations. Every table is scoped to
-- auth.uid() via RLS; there is no public/anon access anywhere.

create extension if not exists "pgcrypto";

-- ─── profiles ──────────────────────────────────────────────────
-- 1:1 extension of auth.users. Created automatically on signup via trigger.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  target_role text check (target_role in (
    'Marketing', 'Sales', 'Analyst', 'Data Analyst', 'Product Management',
    'Project Manager', 'Frontend Developer', 'Backend Developer',
    'UX Designer', 'Other'
  )),
  experience_level text check (experience_level in ('Student', 'Junior')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── kits ──────────────────────────────────────────────────────
-- One generated interview-prep kit (5 questions) per row.
create table public.kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in (
    'Marketing', 'Sales', 'Analyst', 'Data Analyst', 'Product Management',
    'Project Manager', 'Frontend Developer', 'Backend Developer',
    'UX Designer', 'Other'
  )),
  level text not null check (level in ('Student', 'Junior')),
  created_at timestamptz not null default now()
);

create index kits_user_id_idx on public.kits (user_id);

alter table public.kits enable row level security;

create policy "kits_select_own" on public.kits
  for select using (auth.uid() = user_id);
create policy "kits_insert_own" on public.kits
  for insert with check (auth.uid() = user_id);
create policy "kits_update_own" on public.kits
  for update using (auth.uid() = user_id);
create policy "kits_delete_own" on public.kits
  for delete using (auth.uid() = user_id);

-- ─── kit_questions ─────────────────────────────────────────────
-- The 5 questions belonging to a kit: question, intent, structure, example.
create table public.kit_questions (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.kits (id) on delete cascade,
  question_index smallint not null check (question_index between 1 and 5),
  question text not null,
  intent text not null,
  structure text not null,
  example text not null,
  unique (kit_id, question_index)
);

create index kit_questions_kit_id_idx on public.kit_questions (kit_id);

alter table public.kit_questions enable row level security;

create policy "kit_questions_select_own" on public.kit_questions
  for select using (
    exists (
      select 1 from public.kits
      where kits.id = kit_questions.kit_id and kits.user_id = auth.uid()
    )
  );
create policy "kit_questions_insert_own" on public.kit_questions
  for insert with check (
    exists (
      select 1 from public.kits
      where kits.id = kit_questions.kit_id and kits.user_id = auth.uid()
    )
  );
create policy "kit_questions_update_own" on public.kit_questions
  for update using (
    exists (
      select 1 from public.kits
      where kits.id = kit_questions.kit_id and kits.user_id = auth.uid()
    )
  );
create policy "kit_questions_delete_own" on public.kit_questions
  for delete using (
    exists (
      select 1 from public.kits
      where kits.id = kit_questions.kit_id and kits.user_id = auth.uid()
    )
  );

-- ─── saved_questions ───────────────────────────────────────────
-- Bookmarks: a user marking a kit_question as saved.
create table public.saved_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kit_question_id uuid not null references public.kit_questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, kit_question_id)
);

create index saved_questions_user_id_idx on public.saved_questions (user_id);

alter table public.saved_questions enable row level security;

create policy "saved_questions_select_own" on public.saved_questions
  for select using (auth.uid() = user_id);
create policy "saved_questions_insert_own" on public.saved_questions
  for insert with check (auth.uid() = user_id);
create policy "saved_questions_update_own" on public.saved_questions
  for update using (auth.uid() = user_id);
create policy "saved_questions_delete_own" on public.saved_questions
  for delete using (auth.uid() = user_id);

-- ─── answer_drafts ─────────────────────────────────────────────
-- The user's own written answer in the AnswerEditor, one per question.
create table public.answer_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kit_question_id uuid not null references public.kit_questions (id) on delete cascade,
  draft_text text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, kit_question_id)
);

create index answer_drafts_user_id_idx on public.answer_drafts (user_id);

alter table public.answer_drafts enable row level security;

create policy "answer_drafts_select_own" on public.answer_drafts
  for select using (auth.uid() = user_id);
create policy "answer_drafts_insert_own" on public.answer_drafts
  for insert with check (auth.uid() = user_id);
create policy "answer_drafts_update_own" on public.answer_drafts
  for update using (auth.uid() = user_id);
create policy "answer_drafts_delete_own" on public.answer_drafts
  for delete using (auth.uid() = user_id);

-- ─── simulations ───────────────────────────────────────────────
-- One mock-interview session.
create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scenario text not null check (scenario in (
    'First Interview', 'Stressful Interviewer', 'Behavioral Interview',
    'Lack of Experience'
  )),
  role text not null check (role in (
    'Marketing', 'Sales', 'Analyst', 'Data Analyst', 'Product Management',
    'Project Manager', 'Frontend Developer', 'Backend Developer',
    'UX Designer', 'Other'
  )),
  level text not null check (level in ('Student', 'Junior')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  feedback text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index simulations_user_id_idx on public.simulations (user_id);

alter table public.simulations enable row level security;

create policy "simulations_select_own" on public.simulations
  for select using (auth.uid() = user_id);
create policy "simulations_insert_own" on public.simulations
  for insert with check (auth.uid() = user_id);
create policy "simulations_update_own" on public.simulations
  for update using (auth.uid() = user_id);
create policy "simulations_delete_own" on public.simulations
  for delete using (auth.uid() = user_id);

-- ─── simulation_messages ───────────────────────────────────────
-- Turn-by-turn chat history for a simulation.
create table public.simulation_messages (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  turn_number smallint not null,
  sender text not null check (sender in ('interviewer', 'candidate')),
  content text not null,
  created_at timestamptz not null default now(),
  unique (simulation_id, turn_number, sender)
);

create index simulation_messages_simulation_id_idx on public.simulation_messages (simulation_id);

alter table public.simulation_messages enable row level security;

create policy "simulation_messages_select_own" on public.simulation_messages
  for select using (
    exists (
      select 1 from public.simulations
      where simulations.id = simulation_messages.simulation_id
        and simulations.user_id = auth.uid()
    )
  );
create policy "simulation_messages_insert_own" on public.simulation_messages
  for insert with check (
    exists (
      select 1 from public.simulations
      where simulations.id = simulation_messages.simulation_id
        and simulations.user_id = auth.uid()
    )
  );
create policy "simulation_messages_update_own" on public.simulation_messages
  for update using (
    exists (
      select 1 from public.simulations
      where simulations.id = simulation_messages.simulation_id
        and simulations.user_id = auth.uid()
    )
  );
create policy "simulation_messages_delete_own" on public.simulation_messages
  for delete using (
    exists (
      select 1 from public.simulations
      where simulations.id = simulation_messages.simulation_id
        and simulations.user_id = auth.uid()
    )
  );
