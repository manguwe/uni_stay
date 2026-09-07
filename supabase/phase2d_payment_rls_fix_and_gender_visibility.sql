-- ============================================================================
-- Eden Hostel Portal — Phase 2d fixes
-- 1. payment_records RLS bug: the student UPDATE policy had no explicit
--    WITH CHECK, so Postgres defaulted it to the USING clause — which is
--    correct for "which rows can a student touch" but wrong for "what can
--    the resulting row look like," causing every legitimate submission to
--    fail RLS. Fixed with an explicit WITH CHECK.
-- 2. Gender-based visibility (KB §7, Decisions Log) — enforced via RLS on
--    hostels AND the full hierarchy beneath it (blocks/floors/flats/
--    rooms/beds), not just filtered client-side, so it holds even against
--    a direct REST call.
--
-- Run this AFTER phase2c_profile_fixes_and_roster.sql, once. Idempotent —
-- every policy below is DROP...IF EXISTS immediately followed by CREATE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- DIAGNOSTIC — run this yourself first to confirm the row already exists
-- for the allocation you're testing with (per your item 1):
--
--   select pr.*, al.id as allocation_id, al.released_at
--   from payment_records pr
--   join allocations al on al.id = pr.allocation_id
--   where al.released_at is null
--   order by pr.created_at desc;
--
-- If that returns a row with status 'unpaid', the row exists as designed —
-- the bug below is what's actually blocking the UPDATE.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Fix: payment_records UPDATE policy needs an explicit WITH CHECK
-- ---------------------------------------------------------------------------
drop policy if exists "Students can submit own payment proof" on payment_records;
create policy "Students can submit own payment proof" on payment_records
  for update
  using (
    -- Which rows a student may attempt to update: their own, and only
    -- while no submission is currently pending review.
    exists (
      select 1 from allocations al
      join hostel_applications a on a.id = al.application_id
      where al.id = payment_records.allocation_id
        and a.student_id = auth.uid()
    )
    and status in ('unpaid', 'rejected')
  )
  with check (
    -- What the RESULTING row must look like: still their own record, and
    -- the only status a non-admin update may land on is
    -- 'awaiting_verification' — matching exactly what
    -- guard_payment_record_update() forces it to. This is the missing
    -- piece; without it Postgres reused the USING clause above, which the
    -- post-trigger row (status now 'awaiting_verification') always failed.
    exists (
      select 1 from allocations al
      join hostel_applications a on a.id = al.application_id
      where al.id = payment_records.allocation_id
        and a.student_id = auth.uid()
    )
    and status = 'awaiting_verification'
  );

-- Extra defense-in-depth while we're in here: lock allocation_id too, so a
-- student can never repoint their payment record at a different
-- allocation via the same UPDATE (the unique constraint on allocation_id
-- already made this hard, but this closes it explicitly rather than
-- relying on that constraint as the only line of defense).
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
  new.rejection_reason := null;
  new.submitted_at := now();

  return new;
end;
$$;

-- Admins' policies are untouched and unaffected: "Admins can verify payment
-- records" only ever tests public.current_user_role() = 'admin', which
-- doesn't reference OLD/NEW row columns at all — so Postgres defaulting
-- WITH CHECK to USING there was never a problem, and still isn't.

-- ---------------------------------------------------------------------------
-- 2. Gender-based visibility, enforced in RLS across the whole hierarchy
--
-- Rule for every table below: a row is visible if —
--   - the viewer isn't logged in (anon can still browse freely, KB §7), or
--   - the viewer is admin (always sees everything, every screen), or
--   - the hostel is 'mixed', or
--   - the viewer's profile gender isn't set yet (show everything rather
--     than hiding it), or
--   - the hostel's gender matches the viewer's profile gender.
--
-- Applied to hostels directly, and to blocks/floors/flats/rooms/beds via
-- an EXISTS back to hostels — so a student can't see a mismatched
-- hostel's rooms/beds even by guessing/reusing a hostel id in a direct
-- REST call, not just by browsing the Explorer UI.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_gender()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select gender from public.profiles where id = auth.uid();
$$;

drop policy if exists "Public read hostels" on hostels;
create policy "Public read hostels" on hostels
  for select using (
    auth.uid() is null
    or public.current_user_role() = 'admin'
    or gender = 'mixed'
    or public.current_user_gender() is null
    or gender = public.current_user_gender()
  );

drop policy if exists "Public read blocks" on blocks;
create policy "Public read blocks" on blocks
  for select using (
    auth.uid() is null
    or public.current_user_role() = 'admin'
    or exists (
      select 1 from hostels h
      where h.id = blocks.hostel_id
        and (
          h.gender = 'mixed'
          or public.current_user_gender() is null
          or h.gender = public.current_user_gender()
        )
    )
  );

drop policy if exists "Public read floors" on floors;
create policy "Public read floors" on floors
  for select using (
    auth.uid() is null
    or public.current_user_role() = 'admin'
    or exists (
      select 1 from hostels h
      where h.id = floors.hostel_id
        and (
          h.gender = 'mixed'
          or public.current_user_gender() is null
          or h.gender = public.current_user_gender()
        )
    )
  );

drop policy if exists "Public read flats" on flats;
create policy "Public read flats" on flats
  for select using (
    auth.uid() is null
    or public.current_user_role() = 'admin'
    or exists (
      select 1 from hostels h
      where h.id = flats.hostel_id
        and (
          h.gender = 'mixed'
          or public.current_user_gender() is null
          or h.gender = public.current_user_gender()
        )
    )
  );

drop policy if exists "Public read rooms" on rooms;
create policy "Public read rooms" on rooms
  for select using (
    auth.uid() is null
    or public.current_user_role() = 'admin'
    or exists (
      select 1 from hostels h
      where h.id = rooms.hostel_id
        and (
          h.gender = 'mixed'
          or public.current_user_gender() is null
          or h.gender = public.current_user_gender()
        )
    )
  );

drop policy if exists "Public read beds" on beds;
create policy "Public read beds" on beds
  for select using (
    auth.uid() is null
    or public.current_user_role() = 'admin'
    or exists (
      select 1
      from rooms r
      join hostels h on h.id = r.hostel_id
      where r.id = beds.room_id
        and (
          h.gender = 'mixed'
          or public.current_user_gender() is null
          or h.gender = public.current_user_gender()
        )
    )
  );

-- No frontend changes needed for this part: fetchHostels() and every
-- other hierarchy.js query already do a plain `select *` — the filtering
-- happens entirely server-side now, so the same code path used by both
-- the Explorer and Apply For A Room's location dropdowns is automatically
-- correct everywhere, for free.
