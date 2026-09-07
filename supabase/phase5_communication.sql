-- ============================================================================
-- Eden Hostel Portal — Phase 5 migration
-- Announcements (KB §12) and in-app Notifications. No separate
-- "maintenance requests" table — see the reasoning in the chat response;
-- existing complaint fields (category, assigned_to, status,
-- complaint_updates comments) already cover every field asked for.
--
-- Run this AFTER phase4_admin_dashboard_and_inventory.sql, once.
-- Idempotent as always.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- announcements
--
-- Scope columns are independently nullable, not a single "scope type +
-- scope id" pair — a match requires every NON-null target column to equal
-- the viewer's corresponding location value; all-null means "all
-- students." This also naturally handles a logged-out visitor (KB §7
-- browsing) seeing only broadcast announcements, with no special-casing.
-- ---------------------------------------------------------------------------
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references profiles(id),
  title text not null,
  body text not null,
  target_hostel_id uuid references hostels(id),
  target_block_id uuid references blocks(id),
  target_flat_id uuid references flats(id),
  target_room_id uuid references rooms(id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_announcements_hostel on announcements(target_hostel_id);
create index if not exists idx_announcements_created_at on announcements(created_at);

alter table announcements enable row level security;

-- Returns the caller's current hostel/block/floor/flat/room, or zero rows
-- if they have no active allocation. Deliberately separate from the
-- existing my_active_room_id() (Phase 2b/2c) rather than refactoring it —
-- that function is already relied on elsewhere and working; adding a new,
-- narrowly-scoped function is lower risk than changing a shared one.
create or replace function public.my_active_location()
returns table (hostel_id uuid, block_id uuid, floor_id uuid, flat_id uuid, room_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select r.hostel_id, r.block_id, r.floor_id, r.flat_id, r.id
  from allocations al
  join hostel_applications a on a.id = al.application_id
  join beds b on b.id = al.bed_id
  join rooms r on r.id = b.room_id
  where a.student_id = auth.uid()
    and al.released_at is null
  limit 1;
$$;

drop policy if exists "Students can view relevant announcements" on announcements;
create policy "Students can view relevant announcements" on announcements
  for select using (
    (expires_at is null or expires_at > now())
    and (
      (target_hostel_id is null and target_block_id is null and target_flat_id is null and target_room_id is null)
      or exists (
        select 1 from public.my_active_location() loc
        where (target_hostel_id is null or target_hostel_id = loc.hostel_id)
          and (target_block_id is null or target_block_id = loc.block_id)
          and (target_flat_id is null or target_flat_id = loc.flat_id)
          and (target_room_id is null or target_room_id = loc.room_id)
      )
    )
  );

-- Staff/admin read visibility isn't sensitive (unlike payment/complaint
-- data), so no scoping here — only WHO MAY CREATE is scoped, below.
drop policy if exists "Staff can view all announcements" on announcements;
create policy "Staff can view all announcements" on announcements
  for select using (public.current_user_role() in ('chairperson', 'patron_matron'));

drop policy if exists "Admins can view all announcements" on announcements;
create policy "Admins can view all announcements" on announcements
  for select using (public.current_user_role() = 'admin');

-- Admin may post at any scope, including "all students" (all target_*
-- null). Chairperson/patron_matron MUST target a hostel they're assigned
-- to — they can never post an unscoped/all-students announcement, and
-- can't target a hostel they don't cover.
drop policy if exists "Staff and admin can create announcements" on announcements;
create policy "Staff and admin can create announcements" on announcements
  for insert with check (
    created_by = auth.uid()
    and (
      public.current_user_role() = 'admin'
      or (
        public.current_user_role() in ('chairperson', 'patron_matron')
        and target_hostel_id is not null
        and public.is_staff_for_hostel(target_hostel_id)
      )
    )
  );

drop policy if exists "Creators and admin can update announcements" on announcements;
create policy "Creators and admin can update announcements" on announcements
  for update using (created_by = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "Creators and admin can delete announcements" on announcements;
create policy "Creators and admin can delete announcements" on announcements
  for delete using (created_by = auth.uid() or public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- notifications
--
-- No INSERT policy for any role — every row is written by a SECURITY
-- DEFINER trigger (below), matching the same "no client can write this
-- directly" pattern as complaint_updates.
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications(user_id, read);

alter table notifications enable row level security;

drop policy if exists "Users can view own notifications" on notifications;
create policy "Users can view own notifications" on notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Users can mark own notifications read" on notifications;
create policy "Users can mark own notifications read" on notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Application status change -> notify the student. Fires only on an
-- actual status transition; the student's own initial INSERT (status
-- always 'submitted') is a different statement entirely and never
-- triggers this.
create or replace function public.notify_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into notifications (user_id, message, link)
    values (
      new.student_id,
      format('Your application status changed to %s.', replace(new.status, '_', ' ')),
      '/accommodation/applications'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_application_status_change on hostel_applications;
create trigger trg_notify_application_status_change
  after update on hostel_applications
  for each row execute function public.notify_application_status_change();

-- Complaint update -> notify the student, but only for STAFF actions, not
-- the student's own auto-logged 'submitted' entry (actor_id = the
-- student themselves in that one case, and nowhere else — students have
-- no other path to write complaint_updates at all).
create or replace function public.notify_complaint_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  select student_id into v_student_id from complaints where id = new.complaint_id;

  if v_student_id is not null and new.actor_id is distinct from v_student_id then
    insert into notifications (user_id, message, link)
    values (
      v_student_id,
      format('Your complaint was updated: %s.', replace(new.action, '_', ' ')),
      '/accommodation/complaints'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_complaint_update on complaint_updates;
create trigger trg_notify_complaint_update
  after insert on complaint_updates
  for each row execute function public.notify_complaint_update();

-- Payment confirmed/rejected -> notify the student. Only fires on that
-- specific transition — the student's own proof submission sets status to
-- 'awaiting_verification', never 'confirmed'/'rejected', so this can't
-- fire from the student's own action.
create or replace function public.notify_payment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  if new.status in ('confirmed', 'rejected') and new.status is distinct from old.status then
    select a.student_id into v_student_id
    from allocations al
    join hostel_applications a on a.id = al.application_id
    where al.id = new.allocation_id;

    if v_student_id is not null then
      insert into notifications (user_id, message, link)
      values (v_student_id, format('Your payment was %s.', new.status), '/accommodation/finance');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_payment_status_change on payment_records;
create trigger trg_notify_payment_status_change
  after update on payment_records
  for each row execute function public.notify_payment_status_change();
