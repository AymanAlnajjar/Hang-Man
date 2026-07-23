-- ============================================================================
--  لعبة المشنقة — Supabase setup
--  Run this ONCE in your Supabase project:
--  Dashboard -> SQL Editor -> New query -> paste all of this -> Run.
-- ============================================================================

-- 1) The single table that holds each game room.
create table if not exists public.games (
  id          text primary key,            -- the room code (e.g. "K7QM2")
  player_a    text,                         -- first player's anonymous id
  player_b    text,                         -- second player's anonymous id
  chooser     text,                         -- who sets the word this round
  word        text,                         -- the chosen word (normalized)
  guessed     text[]  not null default '{}',-- letters guessed so far
  status      text    not null default 'waiting',  -- waiting|choosing|playing|finished
  result      text,                         -- won|lost|null
  round       int     not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2) Keep updated_at fresh on every change (nice for debugging / cleanup).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists games_touch_updated_at on public.games;
create trigger games_touch_updated_at
  before update on public.games
  for each row execute function public.touch_updated_at();

-- 3) Turn on Realtime so both players' screens sync live.
--    Wrapped so re-running this script doesn't error if it's already added.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;

-- 4) Row Level Security.
--    This is a private 2-player game guarded by a hard-to-guess room code,
--    so we allow the public "anon" key to read/write freely. That is enough
--    for a personal game. (If you ever make it public, tighten these.)
alter table public.games enable row level security;

drop policy if exists "games public access" on public.games;
create policy "games public access"
  on public.games
  for all
  using (true)
  with check (true);

-- Done. Your app just needs the Project URL and anon key (Settings -> API).
