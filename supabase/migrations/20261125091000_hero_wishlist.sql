-- PekkaDex — per-user cosmetic wishlist (Phase 4)
-- Backs the collection tracker: one row per user per cosmetic item, RLS locked
-- to the owner. The heroes page does not write to it yet (see CHANGELOG.md);
-- this migration only creates the safe storage so the UI can be wired next.
--
-- Run with:  npx supabase db push --project-ref hrloxvshgehvkmpnnbyz

create table if not exists public.hero_wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('skin', 'scenery')),
  item_id text not null check (char_length(item_id) between 1 and 120),
  owned boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, kind, item_id)
);

alter table public.hero_wishlist enable row level security;

-- Owners can read, add and remove only their own rows.
drop policy if exists "wishlist rows are readable by their owner" on public.hero_wishlist;
create policy "wishlist rows are readable by their owner"
  on public.hero_wishlist for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "wishlist rows are insertable by their owner" on public.hero_wishlist;
create policy "wishlist rows are insertable by their owner"
  on public.hero_wishlist for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "wishlist rows are updatable by their owner" on public.hero_wishlist;
create policy "wishlist rows are updatable by their owner"
  on public.hero_wishlist for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "wishlist rows are deletable by their owner" on public.hero_wishlist;
create policy "wishlist rows are deletable by their owner"
  on public.hero_wishlist for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Guests never reach the table: no policy is granted to anon, and RLS denies by
-- default. The Edge Function keeps using the service role and is unaffected.
