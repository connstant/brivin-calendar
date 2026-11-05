-- Our Week: database setup for Supabase. Starts with an empty planner.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- The planner login is plan@brivin.com. It must match loginEmail in public/config.js
-- and the user you created under Authentication > Users. Only that login can use the planner.
-- Safe to run more than once: it never deletes your planner data.

-- 1) Who may use the planner. Nobody can read this list through the API.
create table if not exists public.planner_members (email text primary key);
alter table public.planner_members enable row level security;
revoke all on public.planner_members from anon, authenticated;
insert into public.planner_members (email) values (lower('plan@brivin.com'))
  on conflict do nothing;

create or replace function public.is_planner_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.planner_members where email = lower(auth.jwt() ->> 'email'));
$$;
revoke all on function public.is_planner_member() from public, anon;
grant execute on function public.is_planner_member() to authenticated;

-- 2) The planner's data: one row per calendar item, shopping item or setting.
create table if not exists public.docs (
  coll text not null check (coll in ('items', 'shopping', 'settings')),
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  data jsonb not null check (octet_length(data::text) < 20000),
  updated_at timestamptz not null default now(),
  primary key (coll, id)
);
alter table public.docs enable row level security;

-- Signed-in users may use the table; the policies below still limit it to the planner login.
revoke all on public.docs from anon;
grant select, insert, update, delete on public.docs to authenticated;

drop policy if exists "members read" on public.docs;
drop policy if exists "members insert" on public.docs;
drop policy if exists "members update" on public.docs;
drop policy if exists "members delete" on public.docs;
create policy "members read"   on public.docs for select to authenticated using (public.is_planner_member());
create policy "members insert" on public.docs for insert to authenticated with check (public.is_planner_member());
create policy "members update" on public.docs for update to authenticated using (public.is_planner_member()) with check (public.is_planner_member());
create policy "members delete" on public.docs for delete to authenticated using (public.is_planner_member());

-- 3) Live updates, so both phones see changes right away.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 4) Quick check: should list the table and your login.
select (select count(*) from public.docs) as planner_rows,
       (select string_agg(email, ', ') from public.planner_members) as allowed_login;
