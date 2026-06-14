-- Run this in Supabase SQL Editor if you see "Load failed" or "permission denied"
-- (table exists but anon key cannot read/write)

grant usage on schema public to anon, authenticated;
grant all on table public.journal_entries to anon, authenticated;
grant usage, select on sequence public.journal_entries_id_seq to anon, authenticated;

-- Re-apply RLS policies if needed
alter table public.journal_entries enable row level security;

drop policy if exists "anon read"   on public.journal_entries;
drop policy if exists "anon insert" on public.journal_entries;
drop policy if exists "anon update" on public.journal_entries;
drop policy if exists "anon delete" on public.journal_entries;

create policy "anon read"   on public.journal_entries for select using (true);
create policy "anon insert" on public.journal_entries for insert with check (true);
create policy "anon update" on public.journal_entries for update using (true) with check (true);
create policy "anon delete" on public.journal_entries for delete using (true);
