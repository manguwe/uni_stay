-- ============================================================================
-- Eden Hostel Portal — Phase 2c fixes
-- 1. Lock gender after first set (KB §8a) — a student can set it once;
--    only admin can change it after that.
-- 2. Roommate visibility now triggers on the allocation existing, not on
--    payment status (KB §9, corrected — was wrongly gated on 'confirmed').
-- 3. Drop the unused distance_from_home_km column — the KB's own
--    Decisions Log already said this was dropped as a priority factor;
--    it was added back in by mistake in Phase 2.
--
-- Run this AFTER phase2b_payments_and_roommates.sql, once. Idempotent as
-- always — nothing is dropped without an immediate, unconditional
-- recreate; the only DROP that isn't a function/trigger/policy is the
-- column drop in §3, which is a deliberate one-way prototype cleanup
-- (see the note there).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Lock profiles.gender after first set
--
-- "Users can update own profile" (from Phase 2) already lets a student
-- update any column on their own row, including gender, with nothing
-- stopping them from flipping it to game gender-designated allocation.
-- This mirrors the existing prevent_role_self_promotion() pattern: once
-- gender is non-null, only an admin can change it; a student's own
-- attempt to change it is silently reverted to the old value.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_gender_change_after_set()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.gender is not null
     and new.gender is distinct from old.gender
     and public.current_user_role() <> 'admin' then
    new.gender := old.gender;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_gender_change_after_set on profiles;
create trigger trg_prevent_gender_change_after_set
  before update on profiles
  for each row execute function public.prevent_gender_change_after_set();

-- ---------------------------------------------------------------------------
-- 2. Roommate visibility: allocation existing, not payment confirmed
--
-- Same signature/return type as Phase 2b (uuid, no args) — CREATE OR
-- REPLACE in place, nothing depending on it needs to change.
-- get_my_roommates() is untouched below this: it already just asks
-- "is my_active_room_id() non-null, and is this other student in that
-- same room?" — the payment_records join that made it conditional on
-- 'confirmed' lived ONLY inside my_active_room_id(), so removing it here
-- is the complete fix.
-- ---------------------------------------------------------------------------
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
  where a.student_id = auth.uid()
    and al.released_at is null
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Drop the unused distance_from_home_km column
--
-- DECISION: dropped, not just stopped-reading. This is prototype data
-- with no real student records to preserve (KB §3), and this system is
-- meant to hand off to the school's real infrastructure later (KB §20) —
-- carrying a column the KB explicitly documents as removed would just
-- confuse that migration. If you have test applications with values in
-- this column already, they're lost after this runs; that's expected and
-- fine for a prototype.
-- ---------------------------------------------------------------------------
alter table hostel_applications drop column if exists distance_from_home_km;
