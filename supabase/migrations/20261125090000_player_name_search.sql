-- PekkaDex — player name search (Phase 5)
-- Adds folded / skeleton / codepoint name columns, trigram indexes and a ranked
-- search function over public.coc_player_index.
--
-- Run with:  npx supabase db push --project-ref hrloxvshgehvkmpnnbyz
-- (or paste into the SQL editor of the project).
--
-- The Edge Function `coc` keeps using the service role key, which bypasses RLS,
-- so enabling RLS on this table does not change how the site searches. Any
-- direct anon/authenticated read of the index must be granted explicitly — see
-- the RLS notes at the end.

-- 1. Trigram search support -------------------------------------------------
create extension if not exists pg_trgm;

-- 2. Name columns -----------------------------------------------------------
alter table public.coc_player_index add column if not exists name_raw text;
alter table public.coc_player_index add column if not exists name_folded text;
alter table public.coc_player_index add column if not exists name_skeleton text;
alter table public.coc_player_index add column if not exists name_codepoints text;

-- 3. Folding functions ------------------------------------------------------
-- Mirrors assets/js/name-fold.js and normalizeText() in the Edge Function:
-- small-caps letters become plain letters, NFKD splits accents, combining marks
-- and every non alphanumeric character are dropped, then lower-cased.
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

-- 4. Backfill the existing rows --------------------------------------------
update public.coc_player_index
set name_raw = coalesce(name_raw, name)
where name_raw is null;

update public.coc_player_index
set name_folded = public.pdx_fold_name(coalesce(name_raw, name)),
    name_skeleton = public.pdx_name_skeleton(coalesce(name_raw, name)),
    name_codepoints = public.pdx_name_codepoints(coalesce(name_raw, name))
where name_folded is null
   or name_skeleton is null
   or name_codepoints is null;

-- 5. Keep the columns in sync on every write -------------------------------
create or replace function public.pdx_player_index_sync()
returns trigger
language plpgsql
as $$
begin
  new.name_raw := coalesce(new.name_raw, new.name);
  new.name_folded := public.pdx_fold_name(new.name_raw);
  new.name_skeleton := public.pdx_name_skeleton(new.name_raw);
  new.name_codepoints := public.pdx_name_codepoints(new.name_raw);
  return new;
end;
$$;

drop trigger if exists pdx_player_index_sync on public.coc_player_index;
create trigger pdx_player_index_sync
before insert or update of name, name_raw on public.coc_player_index
for each row execute function public.pdx_player_index_sync();

-- 6. Indexes ---------------------------------------------------------------
create index if not exists coc_player_index_name_folded_trgm
  on public.coc_player_index using gin (name_folded gin_trgm_ops);

create index if not exists coc_player_index_name_skeleton_trgm
  on public.coc_player_index using gin (name_skeleton gin_trgm_ops);

create index if not exists coc_player_index_name_folded_prefix
  on public.coc_player_index (name_folded text_pattern_ops);

create index if not exists coc_player_index_townhall
  on public.coc_player_index (town_hall_level);

-- 7. Ranked search ---------------------------------------------------------
-- exact (0) > prefix (1) > substring (2) > fuzzy trigram (3).
-- Names shorter than 3 characters are rejected: they match almost everything.
create or replace function public.search_players(
  q text,
  exact_match boolean default false,
  th_level integer default null,
  result_limit integer default 200
)
returns table (
  player_tag text,
  name text,
  town_hall_level integer,
  trophies integer,
  role text,
  clan_tag text,
  clan_name text,
  match_type text,
  match_rank integer
)
language sql
stable
as $$
  with params as (
    select public.pdx_fold_name(q) as folded
  ),
  scored as (
    select
      p.player_tag,
      p.name,
      p.town_hall_level,
      p.trophies,
      p.role,
      p.clan_tag,
      p.clan_name,
      p.name_folded,
      case
        when p.name_folded = f.folded then 0
        when p.name_folded like f.folded || '%' then 1
        when p.name_folded like '%' || f.folded || '%' then 2
        else 3
      end as match_rank
    from public.coc_player_index p
    cross join params f
    where char_length(f.folded) >= 3
      and (not exact_match or p.name_folded = f.folded)
      and (th_level is null or p.town_hall_level = th_level)
      and (
        p.name_folded = f.folded
        or p.name_folded like '%' || f.folded || '%'
        or similarity(p.name_folded, f.folded) >= 0.45
      )
  )
  select
    s.player_tag,
    s.name,
    s.town_hall_level,
    s.trophies,
    s.role,
    s.clan_tag,
    s.clan_name,
    case s.match_rank
      when 0 then 'exact'
      when 1 then 'prefix'
      when 2 then 'contains'
      else 'fuzzy'
    end as match_type,
    s.match_rank
  from scored s
  cross join params f
  order by
    s.match_rank,
    similarity(s.name_folded, f.folded) desc,
    s.name,
    s.player_tag
  limit least(greatest(coalesce(result_limit, 200), 1), 1000);
$$;

grant execute on function public.search_players(text, boolean, integer, integer) to anon, authenticated, service_role;

-- 8. Row Level Security review --------------------------------------------
-- The shared player index is written only by the Edge Function, which uses the
-- service role key and therefore bypasses RLS. Reads from the browser go
-- through the function too, so no anon policy is needed for the site to work.
--
-- If you ever want the index readable directly from the browser, decide the
-- exposure first and then add an explicit policy, for example:
--
--   alter table public.coc_player_index enable row level security;
--   create policy "public read of the player index"
--     on public.coc_player_index for select
--     to anon, authenticated using (true);
--
-- Without a policy, RLS denies every anon/authenticated read, which is the safe
-- default for a table that holds player tags.
