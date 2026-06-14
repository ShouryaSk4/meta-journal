-- =====================================================================
-- Meta Journal — Supabase schema
-- Run this once in the Supabase SQL Editor (Project → SQL → New query).
-- =====================================================================

create table if not exists public.journal_entries (
  id            bigserial primary key,
  entry_date    date        not null unique,   -- ISO yyyy-mm-dd, upsert key
  display_date  text        not null,          -- "May 25, 2026"
  ts            bigint      not null,
  sc            jsonb       not null,          -- { health, work, mind, money, rel, growth, spirit, disc, energy, day }
  sleep         numeric,
  workout_type  text,
  workout_min   integer,
  deep          numeric,
  waste         numeric,
  spirit_time   integer,
  output        text,
  win           text,
  mistake       text,
  fix           text,
  why           text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists journal_entries_entry_date_desc_idx
  on public.journal_entries (entry_date desc);

-- Keep updated_at fresh on every UPDATE
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists journal_entries_touch on public.journal_entries;
create trigger journal_entries_touch
  before update on public.journal_entries
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Row Level Security
-- =====================================================================
-- This is a personal single-user journal served as a static page, so the
-- anon key is the only credential available in the browser. We enable RLS
-- and grant full CRUD to the anon role so the page can read/write.
--
-- WARNING: anyone who knows your Supabase URL + anon key can also read
-- and write this table. If you want stricter privacy, add Supabase Auth
-- and replace these policies with `auth.uid() = user_id` style rules.
-- =====================================================================

alter table public.journal_entries enable row level security;

drop policy if exists "anon read"   on public.journal_entries;
drop policy if exists "anon insert" on public.journal_entries;
drop policy if exists "anon update" on public.journal_entries;
drop policy if exists "anon delete" on public.journal_entries;

create policy "anon read"   on public.journal_entries for select using (true);
create policy "anon insert" on public.journal_entries for insert with check (true);
create policy "anon update" on public.journal_entries for update using (true) with check (true);
create policy "anon delete" on public.journal_entries for delete using (true);

-- Table-level grants (required — RLS alone is not enough for the anon key)
grant usage on schema public to anon, authenticated;
grant all on table public.journal_entries to anon, authenticated;
grant usage, select on sequence public.journal_entries_id_seq to anon, authenticated;
