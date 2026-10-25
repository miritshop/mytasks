-- "היום שלי": schema for Supabase (PostgreSQL).
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is idempotent.

-- ============ Tables ============
-- Every row belongs to one user (owner). Row Level Security (below) makes sure
-- a user can only ever read or change their own rows.

create table if not exists public.lists (
  id             uuid primary key,
  owner          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null,
  emoji          text,
  color          text,
  position       integer not null default 0,        -- order in the sidebar (top-level lists only)
  parent_task_id uuid,                               -- set when this list is a task's own sub-table
  columns        jsonb not null default '[]'::jsonb, -- [{id,name,type,options:[{id,label,icon,color}]}]
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- A task OR a category (is_group = true). Nesting is unlimited through parent_id.
create table if not exists public.tasks (
  id           uuid primary key,
  owner        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id      uuid not null references public.lists(id) on delete cascade,
  parent_id    uuid references public.tasks(id) on delete cascade,
  title        text not null default '',
  is_group     boolean not null default false,
  done         boolean not null default false,
  today        boolean not null default false,
  priority     smallint check (priority between 1 and 3),
  note         text not null default '',
  reason       text not null default '',
  icon         text not null default '',
  vals         jsonb not null default '{}'::jsonb,  -- values of the list's custom columns {columnId: value}
  links        jsonb not null default '[]'::jsonb,  -- graph links: [taskId]
  sub_list_id  uuid,                                -- the task's own sub-table
  pos          jsonb,                               -- manual position in the graph {x,y}
  collapsed    boolean not null default false,      -- category open/closed in the table
  g_collapsed  boolean not null default false,      -- category open/closed in the graph
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Per-user app state that is not a list or a task (UI choices, dismissed hints...)
create table if not exists public.user_settings (
  owner      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Images attached to tasks. The file itself lives in Storage (bucket "task-images").
create table if not exists public.attachments (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  path       text not null,                          -- "<owner>/<task>/<file>" inside the bucket
  name       text not null default '',
  size       integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tasks_owner_list_idx   on public.tasks (owner, list_id);
create index if not exists tasks_parent_idx       on public.tasks (parent_id);
create index if not exists tasks_vals_gin_idx     on public.tasks using gin (vals);
create index if not exists attachments_task_idx   on public.attachments (task_id);
create index if not exists lists_owner_pos_idx    on public.lists (owner, position);

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists lists_touch on public.lists;
create trigger lists_touch before update on public.lists
  for each row execute function public.touch_updated_at();
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.user_settings;
create trigger settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ============ Security: Row Level Security ============
-- With RLS on, the public (anon) key in the website can do nothing by itself:
-- every query is checked against the logged-in user.

alter table public.lists         enable row level security;
alter table public.tasks         enable row level security;
alter table public.user_settings enable row level security;
alter table public.attachments   enable row level security;

drop policy if exists "own lists"       on public.lists;
drop policy if exists "own tasks"       on public.tasks;
drop policy if exists "own settings"    on public.user_settings;
drop policy if exists "own attachments" on public.attachments;

create policy "own lists"       on public.lists         for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own tasks"       on public.tasks         for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own settings"    on public.user_settings for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own attachments" on public.attachments   for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- ============ Image storage ============
-- Private bucket: files are only reachable through short-lived signed links,
-- and only inside the user's own folder ("<user id>/...").

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-images', 'task-images', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "own images read"   on storage.objects;
drop policy if exists "own images write"  on storage.objects;
drop policy if exists "own images delete" on storage.objects;

create policy "own images read"   on storage.objects for select to authenticated
  using (bucket_id = 'task-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own images write"  on storage.objects for insert to authenticated
  with check (bucket_id = 'task-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'task-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ v2: time estimates, AI provenance, personal AI rules ============
-- (idempotent; safe to run on an existing database)

alter table public.tasks add column if not exists estimate_min integer
  check (estimate_min is null or estimate_min between 0 and 1440);          -- estimated minutes
alter table public.tasks add column if not exists ai jsonb not null default '{}'::jsonb;
  -- which values were set by AI (and not yet approved/changed by the user):
  -- {"priority":true,"estimate":true,"parent":true,"tags":[optionId],"vals":{columnId:true}}

-- The user's own rules for the AI, e.g. "cook only when the baby is awake".
create table if not exists public.ai_rules (
  id         uuid primary key,
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id    uuid references public.lists(id) on delete cascade,  -- null = applies to all lists
  text       text not null default '',
  enabled    boolean not null default true,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_rules_owner_idx on public.ai_rules (owner, position);

drop trigger if exists ai_rules_touch on public.ai_rules;
create trigger ai_rules_touch before update on public.ai_rules
  for each row execute function public.touch_updated_at();

alter table public.ai_rules enable row level security;
drop policy if exists "own rules" on public.ai_rules;
create policy "own rules" on public.ai_rules for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- ============ v3: daily limit for AI requests ============
-- One row per user per day. take_ai_quota() adds 1 and refuses once the limit is passed.
-- Only the Edge Function calls it (with the user's own login); a user can only ever raise their own count.

create table if not exists public.ai_usage (
  owner uuid not null references auth.users(id) on delete cascade,
  day   date not null default current_date,
  count integer not null default 0,
  primary key (owner, day)
);
alter table public.ai_usage enable row level security;
drop policy if exists "own usage" on public.ai_usage;
create policy "own usage" on public.ai_usage for select to authenticated using (owner = auth.uid());

create or replace function public.take_ai_quota(max_per_day integer) returns integer
language plpgsql security definer set search_path = public as $$
declare c integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.ai_usage (owner, day, count) values (auth.uid(), current_date, 1)
  on conflict (owner, day) do update set count = public.ai_usage.count + 1
  returning count into c;
  if c > max_per_day then raise exception 'quota_exceeded'; end if;   -- the raise also undoes this increment
  return c;
end $$;

revoke all on function public.take_ai_quota(integer) from public, anon;
grant execute on function public.take_ai_quota(integer) to authenticated;

-- ============ v4: "when" (today / this week / next week / soon / a date) ============
alter table public.tasks add column if not exists when_kind text
  check (when_kind is null or when_kind in ('today', 'week', 'next', 'soon', 'date'));
alter table public.tasks add column if not exists when_date date;
  -- for 'date': the due date. For 'today'/'week'/'next': the day it was chosen (so we know when it has run out).
