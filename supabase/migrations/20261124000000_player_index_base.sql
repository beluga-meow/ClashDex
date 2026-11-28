-- PekkaDex — shared player/clan index schema (base)
--
-- These tables were created by hand in the hosted project, so a fresh clone
-- could not be set up from this repository. Everything here is idempotent:
-- it creates what is missing, adds the columns later migrations expect, and
-- is safe to run on the existing production database.
--
-- Only the `coc` Edge Function writes these tables (service role). RLS is on
-- with no policies, so the browser cannot read player tags directly.
--
-- Run with: npx supabase db push --project-ref hrloxvshgehvkmpnnbyz

create extension if not exists pg_trgm;

-- 1. Player index ----------------------------------------------------------
create table if not exists public.coc_player_index (
  player_tag text primary key,
  name text not null,
  search_name text,
  town_hall_level integer,
  trophies integer,
  role text,
  clan_tag text,
  clan_name text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.coc_player_index add column if not exists search_name text;
alter table public.coc_player_index add column if not exists updated_at timestamptz default now();
alter table public.coc_player_index add column if not exists created_at timestamptz default now();

-- State of the search_name column before the trigger below takes over:
-- rows written by an older function deployment may predate it.
update public.coc_player_index
set search_name = lower(
  regexp_replace(
    translate(
      normalize(coalesce(name, ''), NFKD),
      'ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ',
      'abcdefghijklmnopqrstuvwxyz'
    ),
    '[^[:alnum:]]', '', 'g'
  )
)
where search_name is null;

-- 2. Membership history ----------------------------------------------------
create table if not exists public.coc_player_clan_memberships (
  player_tag text not null,
  clan_tag text not null,
  clan_name text,
  player_name text,
  role text,
  town_hall_level integer,
  trophies integer,
  updated_at timestamptz not null default now(),
  primary key (player_tag, clan_tag)
);

-- 3. Clan index ------------------------------------------------------------
create table if not exists public.coc_clan_index (
  clan_tag text primary key,
  name text not null,
  clan_type text,
  description text,
  location_id integer,
  location_name text,
  clan_level integer,
  members integer,
  clan_points integer,
  required_trophies integer,
  required_town_hall_level integer,
  badge_url text,
  updated_at timestamptz not null default now()
);

alter table public.coc_clan_index add column if not exists clan_type text;
alter table public.coc_clan_index add column if not exists description text;
alter table public.coc_clan_index add column if not exists location_id integer;
alter table public.coc_clan_index add column if not exists location_name text;
alter table public.coc_clan_index add column if not exists clan_level integer;
alter table public.coc_clan_index add column if not exists members integer;
alter table public.coc_clan_index add column if not exists clan_points integer;
alter table public.coc_clan_index add column if not exists required_trophies integer;
alter table public.coc_clan_index add column if not exists required_town_hall_level integer;
alter table public.coc_clan_index add column if not exists badge_url text;
alter table public.coc_clan_index add column if not exists updated_at timestamptz default now();

-- 3b. Folding helpers (redefined with the same rules in the next migration) --
create or replace function public.pdx_fold_name(value text)
returns text
language sql
immutable
as $$
  select lower(
    regexp_replace(
      translate(
        normalize(coalesce(value, ''), NFKD),
        'ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ',
        'abcdefghijklmnopqrstuvwxyz'
      ),
      '[^[:alnum:]]', '', 'g'
    )
  );
$$;

create or replace function public.pdx_name_skeleton(value text)
returns text
language sql
immutable
as $$
  select lower(
    regexp_replace(
      translate(
        normalize(coalesce(value, ''), NFKD),
        'ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ',
        'abcdefghijklmnopqrstuvwxyz'
      ),
      '[^[:alpha:]]', '', 'g'
    )
  );
$$;

create or replace function public.pdx_name_codepoints(value text)
returns text
language sql
immutable
as $$
  select string_agg(ascii(ch)::text, ' ')
  from regexp_split_to_table(coalesce(value, ''), '') as ch
  where ch <> '';
$$;

-- 4. Writes keep the folded columns in sync -------------------------------
-- search_name is what the Edge Function filters on. Filling it in the
-- database means a row is searchable even if an older function wrote it.
create or replace function public.pdx_player_index_sync()
returns trigger
language plpgsql
as $$
begin
  new.name_raw := coalesce(new.name_raw, new.name);
  new.name_folded := public.pdx_fold_name(new.name_raw);
  new.name_skeleton := public.pdx_name_skeleton(new.name_raw);
  new.name_codepoints := public.pdx_name_codepoints(new.name_raw);
  new.search_name := coalesce(
    nullif(new.search_name, ''),
    public.pdx_fold_name(new.name_raw)
  );
  return new;
end;
$$;

drop trigger if exists pdx_player_index_sync on public.coc_player_index;
create trigger pdx_player_index_sync
before insert or update of name, name_raw, search_name on public.coc_player_index
for each row execute function public.pdx_player_index_sync();

-- 5. Search indexes --------------------------------------------------------
create index if not exists coc_player_index_search_name_trgm
  on public.coc_player_index using gin (search_name gin_trgm_ops);

create index if not exists coc_player_index_search_name_prefix
  on public.coc_player_index (search_name text_pattern_ops);

create index if not exists coc_player_index_townhall
  on public.coc_player_index (town_hall_level);

create index if not exists coc_player_index_updated
  on public.coc_player_index (updated_at desc);

create index if not exists coc_player_clan_memberships_clan
  on public.coc_player_clan_memberships (clan_tag);

-- 6. Rate limit storage for the Edge Function -----------------------------
-- The function calls consume_coc_api_rate_limit(); it was also missing from
-- this repository, so a fresh deploy failed every request with a 503.
create table if not exists public.coc_api_rate_limit (
  ip_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (ip_hash, window_start)
);

create or replace function public.consume_coc_api_rate_limit(
  p_ip_hash text,
  p_limit integer default 80,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  v_window := to_timestamp(
    floor(extract(epoch from now()) / greatest(p_window_seconds, 1)) *
    greatest(p_window_seconds, 1)
  );

  insert into public.coc_api_rate_limit (ip_hash, window_start, hits)
  values (p_ip_hash, v_window, 1)
  on conflict (ip_hash, window_start)
  do update set hits = public.coc_api_rate_limit.hits + 1
  returning hits into v_hits;

  return v_hits <= greatest(p_limit, 1);
end;
$$;

-- 7. RLS: service role only ----------------------------------------------
alter table public.coc_player_index enable row level security;
alter table public.coc_player_clan_memberships enable row level security;
alter table public.coc_clan_index enable row level security;
alter table public.coc_api_rate_limit enable row level security;
