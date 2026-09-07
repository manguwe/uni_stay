-- ============================================================================
-- Eden Hostel Portal — Phase 2b migration
-- Payment status tracking (no in-app payment processing — KB §4/§17) and
-- roommate visibility (KB §9, strict).
--
-- Run this AFTER supabase/phase2_applications_and_allocation.sql, once.
-- Every statement below is idempotent (IF NOT EXISTS / DROP...IF EXISTS +
-- CREATE / ON CONFLICT), following the same lesson learned from the
-- earlier profiles/current_user_role() bugs: nothing here is EVER dropped
-- with a bare DROP — only CREATE OR REPLACE, IF NOT EXISTS, or
-- DROP...IF EXISTS immediately followed by CREATE, so a partial failure
-- can't silently roll back or orphan a policy again.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Configuration — the two "flat constant" values called out in the brief.
-- Both are plain SQL functions rather than a settings table, so changing
-- the prototype's fee or grace period later is a one-line edit to this
-- file (find `default_amount_due` / `payment_deadline_days` below), not a
-- data migration.
-- ---------------------------------------------------------------------------
create or replace function public.default_amount_due()
returns numeric
language sql
immutable
as $$
  -- Flat hostel fee per term, ZMW (Eden University is in Zambia — KB §24
  -- references ecampus.edenuniversity.edu.zm). Change this one line to
  -- adjust the default applied to every new allocation.
  select 1500.00::numeric;
$$;

create or replace function public.payment_deadline_days()
returns int
language sql
immutable
as $$
  -- Days after allocation before an unpaid/unverified balance is flagged
  -- "overdue" for admin. Change this one line to adjust the grace period.
  select 7;
$$;

-- ---------------------------------------------------------------------------
-- payment_records
--
-- One row per allocation (unique constraint below), auto-created by
-- allocate_bed() — see the updated function further down. A student never
-- INSERTs a payment_records row directly; "submitting proof" is an UPDATE
-- of their own existing row (reference_number/receipt_path + a status
-- flip to 'awaiting_verification'), locked down by both RLS and a trigger
-- below so they can't touch amount_due or verify themselves.
-- ---------------------------------------------------------------------------
create table if not exists payment_records (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null unique references allocations(id) on delete cascade,
  amount_due numeric not null,
  reference_number text,
  receipt_path text, -- Supabase Storage path in the private payment-receipts bucket
  status text not null default 'unpaid'
    check (status in ('unpaid', 'awaiting_verification', 'confirmed', 'rejected')),
  submitted_at timestamptz,
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_records_status on payment_records(status);
create index if not exists idx_payment_records_allocation on payment_records(allocation_id);

alter table payment_records enable row level security;

drop policy if exists "Students can view own payment records" on payment_records;
create policy "Students can view own payment records" on payment_records
  for select using (
    exists (
      select 1 from allocations al
      join hostel_applications a on a.id = al.application_id
      where al.id = payment_records.allocation_id
        and a.student_id = auth.uid()
    )
  );

drop policy if exists "Admins can view all payment records" on payment_records;
create policy "Admins can view all payment records" on payment_records
  for select using (public.current_user_role() = 'admin');

-- The student may only UPDATE their own record, and only while it's
-- unpaid/rejected (i.e. "no submission currently pending review"). USING
-- decides which EXISTING rows qualify; WITH CHECK decides what the
-- RESULTING row must look like — these are deliberately different
-- conditions (old status vs new status). Omitting WITH CHECK here was the
-- original Phase 2b bug: Postgres defaults it to the USING clause, which
-- then re-tested status in ('unpaid','rejected') against the NEW row too
-- — but the trigger below always sets the new status to
-- 'awaiting_verification', so every legitimate submission failed RLS.
drop policy if exists "Students can submit own payment proof" on payment_records;
create policy "Students can submit own payment proof" on payment_records
  for update
  using (
    exists (
      select 1 from allocations al
      join hostel_applications a on a.id = al.application_id
      where al.id = payment_records.allocation_id
        and a.student_id = auth.uid()
    )
    and status in ('unpaid', 'rejected')
  )
  with check (
    exists (
      select 1 from allocations al
      join hostel_applications a on a.id = al.application_id
      where al.id = payment_records.allocation_id
        and a.student_id = auth.uid()
    )
    and status = 'awaiting_verification'
  );

drop policy if exists "Admins can verify payment records" on payment_records;
create policy "Admins can verify payment records" on payment_records
  for update using (public.current_user_role() = 'admin');

-- Column-level guard: RLS only decides which ROWS a student can touch, not
-- which COLUMNS within an allowed row. Without this, a student could
-- send an UPDATE that also sets amount_due, verified_by, verified_at, or
-- jumps straight to 'confirmed' themselves — the RLS USING clause above
-- wouldn't catch that. This trigger enforces it server-side (KB §18):
-- non-admins may only move status unpaid/rejected -> awaiting_verification
-- and set reference_number/receipt_path; everything else snaps back to
-- its previous value, including allocation_id (so a student can't repoint
-- their record at a different allocation). Admins are unrestricted.
create or replace function public.guard_payment_record_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() = 'admin' then
    return new;
  end if;

  if old.status not in ('unpaid', 'rejected') then
    raise exception 'This payment record is not open for a new submission';
  end if;
  if new.status <> 'awaiting_verification' then
    raise exception 'Students can only submit proof for verification';
  end if;

  new.allocation_id := old.allocation_id;
  new.amount_due := old.amount_due;
  new.verified_by := old.verified_by;
  new.verified_at := old.verified_at;
  new.rejection_reason := null; -- clear a prior rejection on resubmit
  new.submitted_at := now();

  return new;
end;
$$;

drop trigger if exists trg_guard_payment_record_update on payment_records;
create trigger trg_guard_payment_record_update
  before update on payment_records
  for each row execute function public.guard_payment_record_update();

-- ---------------------------------------------------------------------------
-- Private storage bucket for receipt uploads
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

-- Upload path convention: {auth.uid()}/{paymentRecordId}-{filename}. The
-- first path segment is the uploading student's own id, so ownership is
-- enforced purely from the path — no extra join needed at upload time.
drop policy if exists "Students can upload own receipts" on storage.objects;
create policy "Students can upload own receipts" on storage.objects
  for insert
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Students can view own receipts" on storage.objects;
create policy "Students can view own receipts" on storage.objects
  for select
  using (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Admins can view all receipts" on storage.objects;
create policy "Admins can view all receipts" on storage.objects
  for select
  using (
    bucket_id = 'payment-receipts'
    and public.current_user_role() = 'admin'
  );

-- No update/delete policies — receipts are re-uploaded under a fresh path
-- on resubmission (see uploadReceipt() client-side), never overwritten in
-- place, which keeps a full history of what was submitted.

-- ============================================================================
-- allocate_bed() — CREATE OR REPLACE with the same signature/return type
-- as Phase 2 (never dropped, per the lesson from the current_user_role()
-- bug). Adds exactly one thing: auto-creating the matching payment_records
-- row right after the allocation itself.
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

  -- New in Phase 2b: every allocation gets a payment_records row so
  -- Finance has something to show the student immediately.
  insert into payment_records (allocation_id, amount_due, status)
  values (v_allocation.id, public.default_amount_due(), 'unpaid')
  on conflict (allocation_id) do nothing;

  return v_allocation;
end;
$$;

-- Callable from the client for the admin payment queue's overdue calc.
grant execute on function public.payment_deadline_days() to authenticated;

-- ============================================================================
-- Roommate visibility (KB §9 — strict)
--
-- DESIGN NOTE: rather than adding a new SELECT policy directly on
-- `profiles` (which would expose the ENTIRE profile row — email, gender,
-- student number — to a roommate; RLS is row-level, not column-level),
-- this uses a SECURITY DEFINER function that returns only id + full_name.
-- That's a deliberate, safer deviation from "give me the policy" as
-- literally asked — flagging it here rather than silently narrowing scope.
--
-- WHY THIS IS SAFE AGAINST A STUDENT QUERYING DIRECTLY:
--   1. my_active_room_id() takes NO parameters — it always computes "the
--      room I (auth.uid(), from the caller's own JWT) currently have a
--      CONFIRMED, ACTIVE allocation in." There is no student_id argument
--      a student could pass to probe someone else's room.
--   2. get_my_roommates() only ever joins against that same auth.uid()-
--      derived room id, and explicitly excludes the caller's own row.
--   3. Both functions are SECURITY DEFINER, so they can read allocations/
--      hostel_applications/beds/payment_records/profiles internally even
--      though a student has no direct SELECT/UPDATE rights on most of
--      those tables — but the functions themselves never take untrusted
--      input that changes WHOSE room is being computed.
--   4. Because this is exposed as a function (RPC), not a table or view a
--      student can SELECT * from with arbitrary filters, there's no query
--      shape that returns more than {id, full_name} for the caller's
--      current confirmed roommates — Postgres enforces this the same way
--      regardless of how the client calls it.
-- ============================================================================
create or replace function public.my_active_room_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select r.id
  from allocations al
  join hostel_applications a on a.id = al.application_id
  join beds b on b.id = al.bed_id
  join rooms r on r.id = b.room_id
  join payment_records pr on pr.allocation_id = al.id
  where a.student_id = auth.uid()
    and al.released_at is null
    and pr.status = 'confirmed'
  limit 1;
$$;

create or replace function public.get_my_roommates()
returns table (id uuid, full_name text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.full_name
  from profiles p
  join hostel_applications a on a.student_id = p.id
  join allocations al on al.application_id = a.id
  join beds b on b.id = al.bed_id
  where al.released_at is null
    and public.my_active_room_id() is not null
    and b.room_id = public.my_active_room_id()
    and p.id <> auth.uid();
$$;

revoke execute on function public.my_active_room_id() from public, anon;
revoke execute on function public.get_my_roommates() from public, anon;
grant execute on function public.my_active_room_id() to authenticated;
grant execute on function public.get_my_roommates() to authenticated;

-- Explicitly NOT touched by this migration, confirmed unaffected:
--   - Phase 1's public SELECT policies on hostels/blocks/floors/flats/
--     rooms/beds — the Hostel Explorer's queries never touch profiles or
--     these two new functions, so it still only ever renders bed/room
--     STATUS, never an occupant's name (KB §9's general-explorer rule).
--   - profiles' existing RLS ("Users can view own profile", "Admins can
--     view all profiles") — no new policy was added to profiles itself.
