-- ============================================================================
-- Eden Hostel Portal — Phase 2 migration
-- Applications, allocation, and the auth/role layer needed to enforce RLS
-- (students see only their own applications; only admin can allocate).
--
-- Run this AFTER supabase/schema.sql, in the SQL Editor, once.
-- Safe to re-run during development — it drops Phase 2 objects first.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Clean slate (Phase 2 objects only)
-- ---------------------------------------------------------------------------
drop function if exists public.release_bed(uuid);
drop function if exists public.allocate_bed(uuid, uuid, text);
-- NOTE: current_user_role() is deliberately NOT dropped here. Its logic
-- never changes between runs of this file (always `select role from
-- profiles where id = auth.uid()`), and the `create or replace function`
-- below updates it in place without disturbing anything that depends on
-- it. Dropping it here (even with CASCADE) would silently take out every
-- admin-gated policy that references it — on profiles, hostel_applications,
-- allocations, AND beds (a Phase 1 table this file doesn't otherwise touch)
-- — which is exactly the kind of silent regression to avoid. If this
-- function's signature or return type ever genuinely needs to change,
-- CREATE OR REPLACE can't do that in place; at that point, drop it
-- explicitly with CASCADE and re-create all 5 policies listed above by
-- hand in the same migration, right after the new function definition.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop trigger if exists trg_prevent_role_self_promotion on profiles;
drop function if exists public.prevent_role_self_promotion();
drop table if exists allocations cascade;
drop table if exists hostel_applications cascade;
drop table if exists profiles cascade;

-- ---------------------------------------------------------------------------
-- profiles
--
-- One row per auth.users id. Holds the role (student / chairperson /
-- patron_matron / admin per KB §5) plus the student-facing fields the
-- application form and gender-match check need. A trigger creates a bare
-- 'student' row automatically on signup; the app fills in the rest via an
-- onboarding update afterward.
--
-- NOTE ON GENDER: this is a required prototype field used only to enforce
-- the hostel gender-designation rule (KB §16) — it is not collected for any
-- other purpose and hostels use it only for the male/female/mixed match
-- check, never displayed to other students.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
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

-- In case profiles already existed (e.g. from a prior partial run) without
-- this column:
alter table profiles add column if not exists email text;

-- SECURITY DEFINER so RLS policies elsewhere can check "is this user an
-- admin?" without recursing into profiles' own RLS.
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

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

-- Keep profiles.email in sync if a user's login email changes later.
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

-- Defense in depth: even though the client never exposes a role selector,
-- block any attempt to change one's own role via a direct UPDATE unless
-- the requester is already an admin (KB §18 — server-side enforcement).
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

drop trigger if exists trg_prevent_role_self_promotion on profiles;
create trigger trg_prevent_role_self_promotion
  before update on profiles
  for each row execute function public.prevent_role_self_promotion();

-- Backfill: anyone who already signed up in an earlier partial run gets a
-- profile row too, instead of silently having none.
insert into public.profiles (id, role, email)
select u.id, 'student', u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

alter table profiles enable row level security;

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on profiles;
create policy "Admins can view all profiles" on profiles
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- hostel_applications
--
-- Room/bed targeting mirrors the flexible hierarchy from Phase 1: block/
-- floor/flat/room/preferred_bed are all nullable because a student may not
-- have picked all the way down to a specific bed (KB §8 — "preferred bed"
-- is optional; admin can allocate a different available bed).
--
-- WAITLIST: kept as a status value + priority_rank column rather than a
-- separate `waitlist` table. A waitlisted row already carries every field
-- needed to match it against a freed bed (target hostel/room, priority
-- notes) — a separate table would just duplicate those columns and need
-- to stay in sync with the application. priority_rank lets admin order
-- candidates manually without an extra join; NULL means "no rank set yet".
-- ---------------------------------------------------------------------------
create table if not exists hostel_applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,

  hostel_id uuid not null references hostels(id),
  block_id uuid references blocks(id),
  floor_id uuid references floors(id),
  flat_id uuid references flats(id),
  room_id uuid references rooms(id),
  preferred_bed_id uuid references beds(id),

  year_of_study int,
  new_intake boolean not null default false,
  medical_needs text,
  notes text,

  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'approved', 'rejected', 'waitlisted')),
  priority_rank int,
  rejection_reason text,

  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id)
);

create index if not exists idx_applications_student on hostel_applications(student_id);
create index if not exists idx_applications_status on hostel_applications(status);
create index if not exists idx_applications_hostel on hostel_applications(hostel_id);
create index if not exists idx_applications_room on hostel_applications(room_id);

alter table hostel_applications enable row level security;

drop policy if exists "Students can view own applications" on hostel_applications;
create policy "Students can view own applications" on hostel_applications
  for select using (auth.uid() = student_id);

drop policy if exists "Admins can view all applications" on hostel_applications;
create policy "Admins can view all applications" on hostel_applications
  for select using (public.current_user_role() = 'admin');

-- Students may only insert a fresh application for themselves, and only
-- ever in 'submitted' state — they cannot insert as pre-approved.
drop policy if exists "Students can submit own applications" on hostel_applications;
create policy "Students can submit own applications" on hostel_applications
  for insert with check (auth.uid() = student_id and status = 'submitted');

-- Status changes (under_review/approved/rejected/waitlisted), review notes,
-- and rejection reasons are admin-only.
drop policy if exists "Admins can update applications" on hostel_applications;
create policy "Admins can update applications" on hostel_applications
  for update using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- allocations
--
-- released_at is null for the currently-active allocation. A bed can be
-- allocated, released (freed), and reallocated over time, so this is an
-- append-mostly history table rather than a 1:1 with beds — but only ONE
-- row per bed (and per application) may be active at once, enforced with
-- partial unique indexes at the DB level (KB §16), not just in the UI.
-- ---------------------------------------------------------------------------
create table if not exists allocations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references hostel_applications(id) on delete cascade,
  bed_id uuid not null references beds(id),
  term text not null default 'Current Term',
  allocated_at timestamptz not null default now(),
  allocated_by uuid references profiles(id),
  released_at timestamptz,
  released_by uuid references profiles(id)
);

create unique index if not exists uq_allocations_active_bed
  on allocations(bed_id) where released_at is null;

create unique index if not exists uq_allocations_active_application
  on allocations(application_id) where released_at is null;

create index if not exists idx_allocations_bed on allocations(bed_id);

alter table allocations enable row level security;

drop policy if exists "Admins can view all allocations" on allocations;
create policy "Admins can view all allocations" on allocations
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Students can view own allocations" on allocations;
create policy "Students can view own allocations" on allocations
  for select using (
    exists (
      select 1 from hostel_applications a
      where a.id = allocations.application_id and a.student_id = auth.uid()
    )
  );

-- All writes to allocations happen through allocate_bed()/release_bed()
-- below (SECURITY DEFINER, admin-checked internally) rather than direct
-- client inserts/updates, so the race-condition guard (row lock) and the
-- gender check can't be bypassed by calling the table directly. No
-- INSERT/UPDATE policy is defined here on purpose — direct table writes
-- from the client are refused by RLS regardless of role.

-- ---------------------------------------------------------------------------
-- Admin write access to beds (Phase 1 only granted public SELECT)
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can update beds" on beds;
create policy "Admins can update beds" on beds
  for update using (public.current_user_role() = 'admin');

-- ============================================================================
-- allocate_bed(application_id, bed_id, term)
--
-- Does the whole allocate operation atomically:
--   1. Locks the bed row (FOR UPDATE) so two admins allocating the same bed
--      at once can't both succeed — the second call sees the post-lock
--      status and is rejected, closing the race window from KB §8/§16.
--   2. Re-checks the bed is still 'vacant'.
--   3. Checks the student's gender against the hostel's gender_designation
--      (mixed hostels skip the check) — raises a clear error if it fails,
--      which the client surfaces as the blocking message required by the
--      brief rather than silently refusing.
--   4. Inserts the allocation, flips the bed to 'occupied', and marks the
--      application 'approved'.
-- SECURITY DEFINER + an explicit role check inside, so this can safely
-- bypass the "no direct writes" stance on allocations/beds above while
-- still enforcing admin-only from the server, not just the UI.
-- ============================================================================
create or replace function public.allocate_bed(
  p_application_id uuid,
  p_bed_id uuid,
  p_term text default 'Current Term'
)
returns allocations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bed_status text;
  v_student_gender text;
  v_hostel_gender text;
  v_allocation allocations;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admin can allocate beds';
  end if;

  select status into v_bed_status from beds where id = p_bed_id for update;
  if v_bed_status is null then
    raise exception 'Bed not found';
  end if;
  if v_bed_status <> 'vacant' then
    raise exception 'Bed is no longer available (current status: %)', v_bed_status;
  end if;

  select p.gender into v_student_gender
  from hostel_applications a
  join profiles p on p.id = a.student_id
  where a.id = p_application_id;

  select h.gender into v_hostel_gender
  from beds b
  join rooms r on r.id = b.room_id
  join hostels h on h.id = r.hostel_id
  where b.id = p_bed_id;

  if v_hostel_gender <> 'mixed' and v_student_gender is distinct from v_hostel_gender then
    raise exception
      'Gender mismatch: student is % but this hostel is designated %',
      coalesce(v_student_gender, 'unspecified'), v_hostel_gender;
  end if;

  insert into allocations (application_id, bed_id, term, allocated_by)
  values (p_application_id, p_bed_id, p_term, auth.uid())
  returning * into v_allocation;

  update beds set status = 'occupied' where id = p_bed_id;

  update hostel_applications
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_application_id;

  return v_allocation;
end;
$$;

-- ============================================================================
-- release_bed(bed_id)
--
-- Manual "free this bed" action for the prototype (full release-on-
-- nonpayment automation is Phase 2b). Closes the active allocation and
-- flips the bed back to vacant so it can be reallocated or offered to a
-- waitlisted applicant.
-- ============================================================================
create or replace function public.release_bed(p_bed_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admin can release beds';
  end if;

  update allocations
  set released_at = now(), released_by = auth.uid()
  where bed_id = p_bed_id and released_at is null;

  update beds set status = 'vacant' where id = p_bed_id;
end;
$$;

-- ============================================================================
-- Promote yourself to admin for the demo
--
-- There's no role-management UI yet (that's part of the Admin Dashboard,
-- KB §13 — later phase). Sign up two accounts in the app first (one to
-- act as the applying student, one to act as admin), then run this once
-- for the admin account's email:
--
--   update profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'admin@example.com');
-- ============================================================================
