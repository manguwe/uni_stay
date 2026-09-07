-- ============================================================================
-- Eden Hostel Portal — Phase 6 migration
-- RBAC restructure: Patron/Matron becomes the hostel-level manager for
-- applications, allocation, and payment verification within their
-- assigned hostel(s) — previously admin-only. Admin keeps everything as
-- a fallback/override. Chairperson is unaffected.
--
-- Run this AFTER phase5_communication.sql, once. Idempotent as always —
-- every function is CREATE OR REPLACE (never dropped), every policy is
-- DROP...IF EXISTS immediately followed by CREATE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- DIAGNOSTIC for Part 1 (run this yourself first): confirms every
-- announcements policy actually exists in your live database. If
-- "Admins can view all announcements" is missing here despite being in
-- phase5_communication.sql, that migration partially rolled back (same
-- class of issue as the earlier profiles/current_user_role() bugs) and
-- should be re-run in full before anything else.
--
--   select policyname, cmd from pg_policies
--   where tablename = 'announcements' order by policyname;
--
-- Expected 6 rows: 3 select (students/staff/admin), 1 insert, 1 update,
-- 1 delete. The SQL and the frontend (CreateAnnouncement.jsx's loadList())
-- were both already unconditional for admin with no allocation dependency
-- — if the policy is present and the account's role really is 'admin',
-- admin already sees every announcement today. The dedicated "All
-- Announcements" page below is still built as asked, for discoverability
-- and parity with "All Complaints" — but the root cause, if there is
-- one, is almost certainly a missing policy row, not scope-filtering
-- logic keyed off an allocation.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. allocate_bed() — broadened to admin OR the hostel's assigned
--    patron/matron. Gender-match enforcement (KB §16) and the race-safe
--    row lock are completely unchanged — only WHO may call this changed,
--    never WHAT it enforces.
-- ---------------------------------------------------------------------------
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
  v_hostel_id uuid;
  v_allocation allocations;
begin
  select h.id, h.gender into v_hostel_id, v_hostel_gender
  from beds b
  join rooms r on r.id = b.room_id
  join hostels h on h.id = r.hostel_id
  where b.id = p_bed_id;

  if v_hostel_id is null then
    raise exception 'Bed not found';
  end if;

  if not (
    public.current_user_role() = 'admin'
    or (public.current_user_role() = 'patron_matron' and public.is_staff_for_hostel(v_hostel_id))
  ) then
    raise exception 'Only admin or this hostel''s assigned patron/matron can allocate beds';
  end if;

  select status into v_bed_status from beds where id = p_bed_id for update;
  if v_bed_status <> 'vacant' then
    raise exception 'Bed is no longer available (current status: %)', v_bed_status;
  end if;

  select p.gender into v_student_gender
  from hostel_applications a
  join profiles p on p.id = a.student_id
  where a.id = p_application_id;

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

  insert into payment_records (allocation_id, amount_due, status)
  values (v_allocation.id, public.default_amount_due(), 'unpaid')
  on conflict (allocation_id) do nothing;

  return v_allocation;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. release_bed() — same broadening.
-- ---------------------------------------------------------------------------
create or replace function public.release_bed(p_bed_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hostel_id uuid;
begin
  select h.id into v_hostel_id
  from beds b
  join rooms r on r.id = b.room_id
  join hostels h on h.id = r.hostel_id
  where b.id = p_bed_id;

  if v_hostel_id is null then
    raise exception 'Bed not found';
  end if;

  if not (
    public.current_user_role() = 'admin'
    or (public.current_user_role() = 'patron_matron' and public.is_staff_for_hostel(v_hostel_id))
  ) then
    raise exception 'Only admin or this hostel''s assigned patron/matron can release this bed';
  end if;

  update allocations
  set released_at = now(), released_by = auth.uid()
  where bed_id = p_bed_id and released_at is null;

  update beds set status = 'vacant' where id = p_bed_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. guard_payment_record_update() — CRITICAL: without this, patron/
--    matron's confirm/reject actions would be silently forced through
--    the student-only branch (unpaid/rejected -> awaiting_verification
--    ONLY), since the trigger previously only exempted 'admin'. Found by
--    tracing every admin-only gate in the system, not assumed.
-- ---------------------------------------------------------------------------
create or replace function public.guard_payment_record_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hostel_id uuid;
begin
  if public.current_user_role() = 'admin' then
    return new;
  end if;

  if public.current_user_role() = 'patron_matron' then
    select r.hostel_id into v_hostel_id
    from allocations al
    join beds b on b.id = al.bed_id
    join rooms r on r.id = b.room_id
    where al.id = old.allocation_id;

    if v_hostel_id is not null and public.is_staff_for_hostel(v_hostel_id) then
      return new;
    end if;
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

-- ---------------------------------------------------------------------------
-- 4. hostel_applications — patron can view/update their hostel's rows.
--    ReviewQueue.jsx's markUnderReview/waitlistApplication/
--    rejectApplication are plain .update() calls — reused unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists "Patrons can view own-hostel applications" on hostel_applications;
create policy "Patrons can view own-hostel applications" on hostel_applications
  for select using (
    public.current_user_role() = 'patron_matron' and public.is_staff_for_hostel(hostel_id)
  );

drop policy if exists "Patrons can update own-hostel applications" on hostel_applications;
create policy "Patrons can update own-hostel applications" on hostel_applications
  for update using (
    public.current_user_role() = 'patron_matron' and public.is_staff_for_hostel(hostel_id)
  );

-- ---------------------------------------------------------------------------
-- 5. allocations — patron can view their hostel's allocations.
-- ---------------------------------------------------------------------------
drop policy if exists "Patrons can view own-hostel allocations" on allocations;
create policy "Patrons can view own-hostel allocations" on allocations
  for select using (
    public.current_user_role() = 'patron_matron'
    and exists (
      select 1 from beds b
      join rooms r on r.id = b.room_id
      where b.id = allocations.bed_id and public.is_staff_for_hostel(r.hostel_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 6. payment_records — patron can view + verify their hostel's records.
--    confirmPayment()/rejectPayment() are plain .update() calls, reused
--    unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists "Patrons can view own-hostel payment records" on payment_records;
create policy "Patrons can view own-hostel payment records" on payment_records
  for select using (
    public.current_user_role() = 'patron_matron'
    and exists (
      select 1 from allocations al
      join beds b on b.id = al.bed_id
      join rooms r on r.id = b.room_id
      where al.id = payment_records.allocation_id
        and public.is_staff_for_hostel(r.hostel_id)
    )
  );

drop policy if exists "Patrons can verify own-hostel payment records" on payment_records;
create policy "Patrons can verify own-hostel payment records" on payment_records
  for update using (
    public.current_user_role() = 'patron_matron'
    and exists (
      select 1 from allocations al
      join beds b on b.id = al.bed_id
      join rooms r on r.id = b.room_id
      where al.id = payment_records.allocation_id
        and public.is_staff_for_hostel(r.hostel_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Storage: patron needs to view receipts for their hostel's students
--    (Payment Verification queue reuse shows "View receipt").
-- ---------------------------------------------------------------------------
drop policy if exists "Patrons can view own-hostel receipts" on storage.objects;
create policy "Patrons can view own-hostel receipts" on storage.objects
  for select
  using (
    bucket_id = 'payment-receipts'
    and public.current_user_role() = 'patron_matron'
    and exists (
      select 1 from payment_records pr
      join allocations al on al.id = pr.allocation_id
      join beds b on b.id = al.bed_id
      join rooms r on r.id = b.room_id
      where pr.receipt_path = storage.objects.name
        and public.is_staff_for_hostel(r.hostel_id)
    )
  );

-- ============================================================================
-- 8. Tighten hostels/blocks/floors/flats/rooms/beds visibility
--
-- WHY THIS CHANGED: reusing ReviewQueue/PaymentVerificationQueue for
-- patron means those queries embed hostels(name)/rooms(room_number) etc,
-- and PostgREST applies each EMBEDDED table's own RLS independently of
-- the parent row's visibility. The original policies had a bare "or
-- current_user_gender() is null" branch intended for students who
-- haven't completed their profile (KB §7) — but staff accounts almost
-- always have gender = null too, since it's a student-only field. Left
-- as-is, that branch would have accidentally granted staff visibility
-- into EVERY hostel (too broad), while a staff account that happens to
-- have a gender set (e.g. promoted from a former student account) could
-- be wrongly BLOCKED from their own assigned hostel if it doesn't match
-- their personal gender (too narrow — an actual bug). This makes each
-- role's rule explicit instead of relying on a side effect of the
-- student-oriented fallback.
-- ============================================================================
drop policy if exists "Public read hostels" on hostels;
create policy "Public read hostels" on hostels
  for select using (
    auth.uid() is null
    or public.current_user_role() = 'admin'
    or (
      public.current_user_role() in ('chairperson', 'patron_matron')
      and public.is_staff_for_hostel(id)
    )
    or (
      public.current_user_role() = 'student'
      and (gender = 'mixed' or public.current_user_gender() is null or gender = public.current_user_gender())
    )
  );

drop policy if exists "Public read blocks" on blocks;
create policy "Public read blocks" on blocks
  for select using (
    auth.uid() is null
    or public.current_user_role() = 'admin'
    or (
      public.current_user_role() in ('chairperson', 'patron_matron')
      and public.is_staff_for_hostel(blocks.hostel_id)
    )
    or (
      public.current_user_role() = 'student'
      and exists (
        select 1 from hostels h
        where h.id = blocks.hostel_id
          and (h.gender = 'mixed' or public.current_user_gender() is null or h.gender = public.current_user_gender())
      )
    )
  );

drop policy if exists "Public read floors" on floors;
create policy "Public read floors" on floors
  for select using (
    auth.uid() is null
    or public.current_user_role() = 'admin'
    or (
      public.current_user_role() in ('chairperson', 'patron_matron')
      and public.is_staff_for_hostel(floors.hostel_id)
    )
    or (
      public.current_user_role() = 'student'
      and exists (
        select 1 from hostels h
        where h.id = floors.hostel_id
          and (h.gender = 'mixed' or public.current_user_gender() is null or h.gender = public.current_user_gender())
      )
    )
  );

drop policy if exists "Public read flats" on flats;
create policy "Public read flats" on flats
  for select using (
    auth.uid() is null
    or public.current_user_role() = 'admin'
    or (
      public.current_user_role() in ('chairperson', 'patron_matron')
      and public.is_staff_for_hostel(flats.hostel_id)
    )
    or (
      public.current_user_role() = 'student'
      and exists (
        select 1 from hostels h
        where h.id = flats.hostel_id
          and (h.gender = 'mixed' or public.current_user_gender() is null or h.gender = public.current_user_gender())
      )
    )
  );

drop policy if exists "Public read rooms" on rooms;
create policy "Public read rooms" on rooms
  for select using (
    auth.uid() is null
    or public.current_user_role() = 'admin'
    or (
      public.current_user_role() in ('chairperson', 'patron_matron')
      and public.is_staff_for_hostel(rooms.hostel_id)
    )
    or (
      public.current_user_role() = 'student'
      and exists (
        select 1 from hostels h
        where h.id = rooms.hostel_id
          and (h.gender = 'mixed' or public.current_user_gender() is null or h.gender = public.current_user_gender())
      )
    )
  );

drop policy if exists "Public read beds" on beds;
create policy "Public read beds" on beds
  for select using (
    auth.uid() is null
    or public.current_user_role() = 'admin'
    or (
      public.current_user_role() in ('chairperson', 'patron_matron')
      and exists (
        select 1 from rooms r where r.id = beds.room_id and public.is_staff_for_hostel(r.hostel_id)
      )
    )
    or (
      public.current_user_role() = 'student'
      and exists (
        select 1 from rooms r
        join hostels h on h.id = r.hostel_id
        where r.id = beds.room_id
          and (h.gender = 'mixed' or public.current_user_gender() is null or h.gender = public.current_user_gender())
      )
    )
  );
