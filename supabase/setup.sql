-- Our Week: database setup for Supabase.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- BEFORE running: replace YOUR-LOGIN-EMAIL below with the email of the login you created
-- (Authentication > Users > Add user). Only that login can read or change the planner.

-- 1) Who may use the planner. Not readable by anyone through the API.
create table if not exists public.planner_members (email text primary key);
alter table public.planner_members enable row level security;
insert into public.planner_members (email) values (lower('YOUR-LOGIN-EMAIL'))
  on conflict do nothing;

create or replace function public.is_planner_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.planner_members where email = lower(auth.jwt() ->> 'email'));
$$;
revoke all on function public.is_planner_member() from public;
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

drop policy if exists "members read" on public.docs;
drop policy if exists "members insert" on public.docs;
drop policy if exists "members update" on public.docs;
drop policy if exists "members delete" on public.docs;
create policy "members read"   on public.docs for select to authenticated using (public.is_planner_member());
create policy "members insert" on public.docs for insert to authenticated with check (public.is_planner_member());
create policy "members update" on public.docs for update to authenticated using (public.is_planner_member()) with check (public.is_planner_member());
create policy "members delete" on public.docs for delete to authenticated using (public.is_planner_member());
revoke all on public.docs from anon;

-- 3) Live updates, so both phones see changes right away.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 4) Bring over what was in the planner before (safe to run twice).
insert into public.docs (coll, id, data) values
  ('items', '0894663c-7f89-47c7-a549-2646ed78ac34', '{"done": false, "end": "2026-11-02", "kind": "chore", "notes": "", "start": "2026-11-02", "tEnd": "", "tStart": "", "time": "", "title": "Ck", "updated": 1793906898465, "who": "both"}'::jsonb),
  ('items', '1d3cecd8-dcb1-445a-ad40-cf277dae48fc', '{"done": false, "end": "2026-11-06", "kind": "away", "notes": "", "start": "2026-11-02", "tEnd": "", "tStart": "", "time": "", "title": "d", "updated": 1793906595045, "who": "both"}'::jsonb),
  ('items', '5113a007-772e-47e1-b03c-c3092b21cf8c', '{"done": false, "end": "2026-11-05", "kind": "plan", "notes": "", "start": "2026-11-05", "tEnd": "", "tStart": "", "time": "", "title": "test", "updated": 1793905515564, "who": "both"}'::jsonb),
  ('items', '5d204c5e-9c8e-41bb-b197-fda11a477eb2', '{"done": false, "end": "2026-11-06", "kind": "chore", "notes": "", "start": "2026-11-03", "tEnd": "", "tStart": "", "time": "after work", "title": "Z", "updated": 1793906870639, "who": "both"}'::jsonb),
  ('items', '89188b1c-9a25-4871-bea7-e800d7ca367b', '{"done": false, "end": "2026-11-07", "kind": "pto", "notes": "", "start": "2026-11-03", "tEnd": "", "tStart": "", "time": "", "title": "kevin pto", "updated": 1793905651705, "who": "both"}'::jsonb),
  ('items', 'ex1', '{"done": false, "end": "2026-11-04", "kind": "chore", "notes": "", "start": "2026-11-02", "tEnd": "", "tStart": "", "time": "after work", "title": "Laundry + fold", "updated": 1793906840198, "who": "both"}'::jsonb),
  ('items', 'ex2', '{"done": false, "end": "2026-11-07", "example": true, "kind": "chore", "notes": "", "start": "2026-11-07", "time": "", "title": "Clean bathroom", "updated": 1, "who": "a"}'::jsonb),
  ('items', 'ex3', '{"done": false, "end": "2026-11-05", "example": true, "kind": "plan", "notes": "", "start": "2026-11-05", "time": "8 pm", "title": "Movie night", "updated": 1, "who": "both"}'::jsonb),
  ('items', 'ex4', '{"done": false, "end": "2026-11-08", "example": true, "kind": "plan", "notes": "", "start": "2026-11-07", "time": "", "title": "Weekend away", "updated": 1, "who": "both"}'::jsonb),
  ('items', 'ex5', '{"done": false, "end": "2026-11-04", "example": true, "kind": "dinner", "notes": "", "start": "2026-11-03", "time": "", "title": "Chili + leftovers", "updated": 1, "who": "a"}'::jsonb),
  ('items', 'ex6', '{"done": false, "end": "2026-11-05", "example": true, "kind": "dinner", "notes": "", "start": "2026-11-05", "time": "", "title": "Pasta night", "updated": 1, "who": "b"}'::jsonb),
  ('shopping', '25a1b7a7-b54c-44f7-8336-16938420dd6c', '{"added": 1793906037171, "done": true, "doneAt": 1793906601774, "list": "general", "order": 1793906037171, "text": "test"}'::jsonb),
  ('shopping', '5b5d1511-9ccc-4611-8c7f-689b8ac6822f', '{"added": 1793905997069, "done": true, "doneAt": 1793906600123, "list": "general", "order": 1793905997069, "text": "eggs"}'::jsonb),
  ('shopping', 'e00120e5-f5b6-4562-ba8d-c1c91d525fdf', '{"added": 1793905995024, "done": true, "doneAt": 1793906009344, "text": "cilantro"}'::jsonb)
on conflict (coll, id) do nothing;
