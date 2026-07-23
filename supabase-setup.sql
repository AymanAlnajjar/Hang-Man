-- ============================================================================
--  لعبة المشنقة — Supabase setup
--  Run this in your Supabase project:
--  Dashboard -> SQL Editor -> New query -> paste all of this -> Run.
--  It is safe to re-run: it only adds what's missing (no data is dropped).
-- ============================================================================

-- 1) The main table that holds each game room.
create table if not exists public.games (
  id          text primary key,            -- the room code (e.g. "K7QM2")
  player_a    text,                         -- first player's anonymous id
  player_b    text,                         -- second player's anonymous id
  status      text    not null default 'waiting',  -- waiting|choosing|playing|finished
  round       int     not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- co-op fields
  chooser     text,
  word        text,
  guessed     text[]  not null default '{}',
  result      text
);

-- 1b) Columns added for game modes + versus play (safe on an existing table).
alter table public.games
  add column if not exists mode        text    not null default 'coop',
  add column if not exists category    text,
  add column if not exists word_for_a  text,
  add column if not exists word_for_b  text,
  add column if not exists guessed_a   text[]  not null default '{}',
  add column if not exists guessed_b   text[]  not null default '{}',
  add column if not exists a_done      boolean not null default false,
  add column if not exists b_done      boolean not null default false;

-- 2) Live chat messages, one row per message.
create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  game_id     text not null references public.games(id) on delete cascade,
  sender      text not null,               -- the sender's anonymous id
  sender_role text,                         -- 'a' or 'b' (for colouring bubbles)
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists messages_game_idx
  on public.messages (game_id, created_at);

-- 3) Keep updated_at fresh on every change to a game.
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

-- 4) Turn on Realtime for both tables so screens sync live.
--    Wrapped so re-running this script doesn't error if already added.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- 5) Row Level Security.
--    This is a private game guarded by a hard-to-guess room code, so we allow
--    the public "anon" key to read/write freely. Enough for a personal game.
alter table public.games    enable row level security;
alter table public.messages enable row level security;

drop policy if exists "games public access" on public.games;
create policy "games public access"
  on public.games for all using (true) with check (true);

drop policy if exists "messages public access" on public.messages;
create policy "messages public access"
  on public.messages for all using (true) with check (true);

-- Done. Your app needs the Project URL and anon key (Settings -> API).
