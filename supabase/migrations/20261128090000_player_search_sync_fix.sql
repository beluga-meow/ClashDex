-- PekkaDex — keep search_name correct on every write.
--
-- The Edge Function filters coc_player_index on search_name. The name-search
-- migration (20261125090000) replaced pdx_player_index_sync() with a version
-- that maintains name_folded but not search_name, so rows written after it
-- would drop out of name search. This migration is the final word on the
-- trigger and also repairs rows that lost their search_name.

create or replace function public.pdx_player_index_sync()
returns trigger
language plpgsql
as $$
begin
  new.name_raw := coalesce(new.name_raw, new.name);
  new.name_folded := public.pdx_fold_name(new.name_raw);
  new.name_skeleton := public.pdx_name_skeleton(new.name_raw);
  new.name_codepoints := public.pdx_name_codepoints(new.name_raw);
  new.search_name := public.pdx_fold_name(new.name_raw);
  return new;
end;
$$;

drop trigger if exists pdx_player_index_sync on public.coc_player_index;
create trigger pdx_player_index_sync
before insert or update of name, name_raw on public.coc_player_index
for each row execute function public.pdx_player_index_sync();

update public.coc_player_index
set search_name = public.pdx_fold_name(coalesce(name_raw, name))
where search_name is null
   or search_name <> public.pdx_fold_name(coalesce(name_raw, name));

create index if not exists coc_player_index_search_name_trgm
  on public.coc_player_index using gin (search_name gin_trgm_ops);
create index if not exists coc_player_index_search_name_prefix
  on public.coc_player_index (search_name text_pattern_ops);
