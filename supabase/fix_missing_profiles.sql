-- ============================================================================
-- Fix: public.profiles missing
--
-- ROOT CAUSE: the Supabase SQL editor runs a pasted script as one implicit
-- transaction. supabase/phase2_applications_and_allocation.sql does create
-- `profiles` near the top — but if ANY later statement in that same paste
-- errored (a duplicate-policy error on a second attempt, a permission
-- hiccup, etc.), Postgres rolled back the WHOLE transaction, including the
-- `create table profiles` that had already "succeeded" earlier in that run.
-- That's why `profiles` is in the file but was never actually in the
-- database when you ran the admin-promotion UPDATE.
--
-- No RLS policy anywhere in Phase 1/2 was found to be actually wrong —
-- every admin-only policy goes through current_user_role(), and every
-- foreign key to profiles(id) is correctly named. They will all resume
-- working the moment profiles exists again; nothing else needs changing.
--
-- Run this file on its own, in this order. Every statement here is
-- idempotent (IF NOT EXISTS / DROP...IF EXISTS + CREATE / ON CONFLICT), so
-- it's safe to re-run this exact file as many times as you need.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create the table (IF NOT EXISTS — won't clobber it if it partially
--    exists from an earlier attempt)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student'
    check (role in ('student', 'chairperson', 'patron_matron', 'admin')),
  full_name text,
  email text,
  student_number text,
  programme text,
  year_of_study int,
  gender text check (gender in ('male', 'female')),
  created_at timestamptz not null default now()
);

-- In case a prior partial run created profiles without the email column:
alter table public.profiles add column if not exists email text;

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- current_user_role() — every admin-only RLS policy in the app depends on
-- this. SECURITY DEFINER so it can read profiles without recursing into
-- profiles' own RLS.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 2. Trigger: auto-create a profile row (with email) on every new signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, email)
  values (new.id, 'student', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bonus: keep profiles.email in sync if someone changes their login email.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Defense in depth (unchanged from Phase 2 — recreated here so it's back
-- regardless of what survived the rollback): block a non-admin from
-- changing their own role via a direct UPDATE.
create or replace function public.prevent_role_self_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and public.current_user_role() <> 'admin' then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_self_promotion on public.profiles;
create trigger trg_prevent_role_self_promotion
  before update on public.profiles
  for each row execute function public.prevent_role_self_promotion();

-- ---------------------------------------------------------------------------
-- 3. Backfill: anyone who signed up while profiles didn't exist has no row
--    yet (their trigger fired against a table that wasn't there, or never
--    fired at all). Give them a default 'student' profile now.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, role, email)
select u.id, 'student', u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ---------------------------------------------------------------------------
-- 4. RLS policies on profiles (drop + recreate — safe to re-run, won't
--    error with "policy already exists" like a bare CREATE POLICY would)
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- ============================================================================
-- Next: check what else survived, before deciding what (if anything) else
-- to re-run.
--
--   select table_name from information_schema.tables
--   where table_schema = 'public' order by 1;
--
-- If hostel_applications, allocations, blocks/floors/flats/rooms/beds are
-- ALL present, you're done — every policy on those tables already
-- references current_user_role()/profiles by the correct names (verified
-- above), so they resume working the instant this script commits. Just
-- re-run your original admin-promotion query:
--
--   update profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'admin@example.com');
--
-- If hostel_applications/allocations are MISSING too, the whole Phase 2
-- transaction rolled back together (same root cause as above) — re-run
-- supabase/phase2_applications_and_allocation.sql in full; it's safe, since
-- nothing from it actually persisted.
-- ============================================================================
