-- ============================================================================
-- Eden Hostel Portal — Phase 3 migration
-- Complaint system: submission, chairperson review, patron/matron
-- escalation handling, append-only audit timeline (KB §11).
--
-- Run this AFTER phase2d_payment_rls_fix_and_gender_visibility.sql, once.
-- Idempotent as always — every DROP is either IF EXISTS immediately
-- followed by CREATE, or (for the one real table-column decision below)
-- explicitly called out as a one-time prototype choice.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- staff_hostel_assignments
--
-- DECISION: a join table, not a hostel_id column on profiles. A single
-- column would force "one hostel per staff member," which doesn't hold up
-- once the school's hostel count grows (KB §1 — "new hostel blocks... with
-- significant new capacity") or if one patron/matron covers welfare across
-- more than one hostel, which is common in practice. A join table costs
-- one extra join and scales without a later migration.
-- ---------------------------------------------------------------------------
create table if not exists staff_hostel_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  hostel_id uuid not null references hostels(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, hostel_id)
);

alter table staff_hostel_assignments enable row level security;

drop policy if exists "Staff can view own assignments" on staff_hostel_assignments;
create policy "Staff can view own assignments" on staff_hostel_assignments
  for select using (auth.uid() = profile_id);

drop policy if exists "Admins can view all assignments" on staff_hostel_assignments;
create policy "Admins can view all assignments" on staff_hostel_assignments
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admins can create assignments" on staff_hostel_assignments;
create policy "Admins can create assignments" on staff_hostel_assignments
  for insert with check (public.current_user_role() = 'admin');

drop policy if exists "Admins can remove assignments" on staff_hostel_assignments;
create policy "Admins can remove assignments" on staff_hostel_assignments
  for delete using (public.current_user_role() = 'admin');

-- Is the CALLING user (auth.uid(), never a parameter — same safety
-- pattern as current_user_role()/my_active_room_id()) assigned to the
-- given hostel? Safe to pass hostel_id as a parameter here because it's
-- only ever used to test "is MY assignment present for THIS hostel," not
-- to select whose data to return.
create or replace function public.is_staff_for_hostel(p_hostel_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from staff_hostel_assignments sha
    where sha.profile_id = auth.uid()
      and sha.hostel_id = p_hostel_id
  );
$$;

-- ---------------------------------------------------------------------------
-- complaints
--
-- hostel_id is required (a complaint is always about a specific hostel);
-- block/floor/flat/room stay nullable and independently overridable, same
-- flexible-hierarchy pattern as hostel_applications.
--
-- escalated_at (nullable, set once, never cleared) is what patron/matron
-- visibility keys off — not the current `status` — because a chairperson
-- can resolve a complaint directly without ever escalating it (status
-- would still end up 'resolved', which must NOT become visible to
-- patron/matron just because the string matches something they also
-- produce). "Has this complaint EVER reached escalation" is the real
-- question, and only escalated_at answers it unambiguously.
--
-- ATTACHMENT DECISION: a single nullable `photo_path` column, not a
-- separate complaint_attachments table. KB §11 describes "optional photo
-- attachment" in the singular, and a prototype has no need for a
-- multi-file model yet — one column is simplest and this can become a
-- proper table later without breaking anything currently built.
-- ---------------------------------------------------------------------------
create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,

  hostel_id uuid not null references hostels(id),
  block_id uuid references blocks(id),
  floor_id uuid references floors(id),
  flat_id uuid references flats(id),
  room_id uuid references rooms(id),

  category text not null check (category in (
    'maintenance', 'plumbing', 'electricity', 'water', 'furniture', 'cleaning',
    'security', 'noise', 'roommate_issue', 'accommodation_issue', 'welfare', 'other'
  )),
  description text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'submitted' check (status in (
    'submitted', 'under_review', 'escalated', 'assigned', 'in_progress',
    'resolved', 'rejected', 'closed'
  )),

  assigned_to text, -- free-text "assigned to" (e.g. a maintenance contact name) — no dedicated staff-user type this phase, per brief
  escalated_at timestamptz,
  photo_path text, -- private Storage path in the complaint-photos bucket

  created_at timestamptz not null default now()
);

create index if not exists idx_complaints_student on complaints(student_id);
create index if not exists idx_complaints_hostel on complaints(hostel_id);
create index if not exists idx_complaints_status on complaints(status);
create index if not exists idx_complaints_escalated on complaints(escalated_at);

alter table complaints enable row level security;

drop policy if exists "Students can view own complaints" on complaints;
create policy "Students can view own complaints" on complaints
  for select using (auth.uid() = student_id);

drop policy if exists "Students can submit own complaints" on complaints;
create policy "Students can submit own complaints" on complaints
  for insert with check (auth.uid() = student_id and status = 'submitted');

drop policy if exists "Chairpersons can view assigned-hostel complaints" on complaints;
create policy "Chairpersons can view assigned-hostel complaints" on complaints
  for select using (
    public.current_user_role() = 'chairperson'
    and public.is_staff_for_hostel(hostel_id)
  );

drop policy if exists "Patrons can view escalated assigned-hostel complaints" on complaints;
create policy "Patrons can view escalated assigned-hostel complaints" on complaints
  for select using (
    public.current_user_role() = 'patron_matron'
    and public.is_staff_for_hostel(hostel_id)
    and escalated_at is not null
  );

drop policy if exists "Admins can view all complaints" on complaints;
create policy "Admins can view all complaints" on complaints
  for select using (public.current_user_role() = 'admin');

-- Admin-only raw UPDATE escape hatch for corrections. Chairperson/patron
-- get NO update policy at all — every status change/comment they make
-- goes through add_complaint_update() below (SECURITY DEFINER), which
-- validates the role, hostel assignment, and allowed action/transition
-- before touching this table, and pairs the change with an audit row
-- atomically. This is the same reasoning as allocate_bed() in Phase 2:
-- a multi-role, multi-transition write is safer centralized in one
-- checked function than spread across several RLS policies.
drop policy if exists "Admins can update complaints" on complaints;
create policy "Admins can update complaints" on complaints
  for update using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- complaint_updates — append-only audit timeline (KB §11)
--
-- No INSERT/UPDATE/DELETE policy is granted to ANYONE, including admin.
-- The only ways a row is ever created are the SECURITY DEFINER trigger
-- below (logs the initial submission) and the SECURITY DEFINER RPC
-- (logs every staff action) — both bypass RLS by nature of running as
-- the function owner, so no INSERT policy is needed for them to work,
-- and no policy means no client, of any role, can insert/edit/delete a
-- row directly. That's what makes this genuinely append-only rather than
-- just "append-only by convention."
-- ---------------------------------------------------------------------------
create table if not exists complaint_updates (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,
  comment text,
  resulting_status text, -- null when the update was a comment with no status change
  created_at timestamptz not null default now()
);

create index if not exists idx_complaint_updates_complaint on complaint_updates(complaint_id);

alter table complaint_updates enable row level security;

drop policy if exists "Students can view own complaint updates" on complaint_updates;
create policy "Students can view own complaint updates" on complaint_updates
  for select using (
    exists (
      select 1 from complaints c
      where c.id = complaint_updates.complaint_id and c.student_id = auth.uid()
    )
  );

drop policy if exists "Chairpersons can view assigned-hostel updates" on complaint_updates;
create policy "Chairpersons can view assigned-hostel updates" on complaint_updates
  for select using (
    exists (
      select 1 from complaints c
      where c.id = complaint_updates.complaint_id
        and public.current_user_role() = 'chairperson'
        and public.is_staff_for_hostel(c.hostel_id)
    )
  );

drop policy if exists "Patrons can view escalated updates" on complaint_updates;
create policy "Patrons can view escalated updates" on complaint_updates
  for select using (
    exists (
      select 1 from complaints c
      where c.id = complaint_updates.complaint_id
        and public.current_user_role() = 'patron_matron'
        and public.is_staff_for_hostel(c.hostel_id)
        and c.escalated_at is not null
    )
  );

drop policy if exists "Admins can view all complaint updates" on complaint_updates;
create policy "Admins can view all complaint updates" on complaint_updates
  for select using (public.current_user_role() = 'admin');

-- Auto-log the initial "submitted" entry so the timeline always starts
-- correctly regardless of which client submitted the complaint.
create or replace function public.log_complaint_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into complaint_updates (complaint_id, actor_id, action, resulting_status)
  values (new.id, new.student_id, 'submitted', new.status);
  return new;
end;
$$;

drop trigger if exists trg_log_complaint_submission on complaints;
create trigger trg_log_complaint_submission
  after insert on complaints
  for each row execute function public.log_complaint_submission();

-- ---------------------------------------------------------------------------
-- Private storage bucket for complaint photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('complaint-photos', 'complaint-photos', false)
on conflict (id) do nothing;

-- Upload path convention: {auth.uid()}/{complaintId}-{filename}, uploaded
-- BEFORE the complaint row is inserted (the client generates the
-- complaint's id client-side via crypto.randomUUID() and inserts it
-- explicitly) — so there's no chicken-and-egg problem and no need for a
-- student UPDATE policy on complaints at all.
drop policy if exists "Students can upload own complaint photos" on storage.objects;
create policy "Students can upload own complaint photos" on storage.objects
  for insert
  with check (
    bucket_id = 'complaint-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Students can view own complaint photos" on storage.objects;
create policy "Students can view own complaint photos" on storage.objects
  for select
  using (
    bucket_id = 'complaint-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff/admin viewing needs a different rule than the path-owner check
-- above, since the viewer isn't the uploader: look up which complaint
-- actually owns this path, and apply the SAME visibility rule as the
-- complaints table itself (assigned hostel, escalated-for-patron, or
-- admin).
drop policy if exists "Staff and admin can view complaint photos" on storage.objects;
create policy "Staff and admin can view complaint photos" on storage.objects
  for select
  using (
    bucket_id = 'complaint-photos'
    and exists (
      select 1 from complaints c
      where c.photo_path = storage.objects.name
        and (
          public.current_user_role() = 'admin'
          or (
            public.current_user_role() = 'chairperson'
            and public.is_staff_for_hostel(c.hostel_id)
          )
          or (
            public.current_user_role() = 'patron_matron'
            and public.is_staff_for_hostel(c.hostel_id)
            and c.escalated_at is not null
          )
        )
    )
  );

-- ============================================================================
-- add_complaint_update() — the one write path for chairperson/patron
-- actions. Validates role + hostel assignment + which actions/status
-- transitions that role may perform, then updates complaints and inserts
-- the audit row atomically.
--
-- ALLOWED ACTIONS PER ROLE (deliberately scoped to exactly what the brief
-- asked for — chairperson gets no reject/close action this phase, since
-- the brief's chairperson list didn't include it; admin can still set
-- those directly via the raw UPDATE policy above if needed for now):
--   chairperson:   reviewed (-> under_review), commented (no status
--                  change), escalated (-> escalated, stamps escalated_at),
--                  resolved (-> resolved, comment required)
--   patron_matron: commented, assigned (-> assigned, sets assigned_to),
--                  escalated_further (status unchanged — just logs it
--                  went to administration), resolved (-> resolved,
--                  comment required) — and only once escalated_at is set,
--                  i.e. only for complaints actually escalated to them
-- ============================================================================
create or replace function public.add_complaint_update(
  p_complaint_id uuid,
  p_action text,
  p_comment text default null,
  p_assigned_to text default null
)
returns complaint_updates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_hostel_id uuid;
  v_status text;
  v_escalated_at timestamptz;
  v_new_status text;
  v_update complaint_updates;
begin
  v_role := public.current_user_role();

  select hostel_id, status, escalated_at
  into v_hostel_id, v_status, v_escalated_at
  from complaints
  where id = p_complaint_id
  for update;

  if v_hostel_id is null then
    raise exception 'Complaint not found';
  end if;

  if v_role not in ('chairperson', 'patron_matron') then
    raise exception 'Only assigned hostel staff can update a complaint this way';
  end if;

  if not public.is_staff_for_hostel(v_hostel_id) then
    raise exception 'You are not assigned to this hostel';
  end if;

  if v_role = 'chairperson' and p_action not in ('reviewed', 'commented', 'escalated', 'resolved') then
    raise exception 'Action not permitted for chairperson';
  end if;

  if v_role = 'patron_matron' then
    if p_action not in ('commented', 'assigned', 'escalated_further', 'resolved') then
      raise exception 'Action not permitted for patron/matron';
    end if;
    if v_escalated_at is null then
      raise exception 'This complaint has not been escalated to patron/matron yet';
    end if;
  end if;

  if p_action = 'resolved' and (p_comment is null or btrim(p_comment) = '') then
    raise exception 'A closing comment is required to resolve a complaint';
  end if;

  v_new_status := case p_action
    when 'reviewed' then 'under_review'
    when 'escalated' then 'escalated'
    when 'assigned' then 'assigned'
    when 'resolved' then 'resolved'
    else null -- commented / escalated_further never change status
  end;

  if v_new_status is not null then
    update complaints
    set status = v_new_status,
        escalated_at = case when p_action = 'escalated' then now() else escalated_at end,
        assigned_to = case when p_action = 'assigned' then coalesce(p_assigned_to, assigned_to) else assigned_to end
    where id = p_complaint_id;
  end if;

  insert into complaint_updates (complaint_id, actor_id, action, comment, resulting_status)
  values (p_complaint_id, auth.uid(), p_action, p_comment, coalesce(v_new_status, v_status))
  returning * into v_update;

  return v_update;
end;
$$;

grant execute on function public.add_complaint_update(uuid, text, text, text) to authenticated;
grant execute on function public.is_staff_for_hostel(uuid) to authenticated;

-- ============================================================================
-- Assigning staff to a hostel — no admin UI for this yet (a full staff-
-- management screen is reasonable Phase 5 admin-dashboard scope). For now,
-- promote an account's role the same way admin was promoted in Phase 2,
-- then assign them to a hostel directly:
--
--   update profiles set role = 'chairperson'
--   where id = (select id from auth.users where email = 'chair@example.com');
--
--   insert into staff_hostel_assignments (profile_id, hostel_id)
--   values (
--     (select id from auth.users where email = 'chair@example.com'),
--     (select id from hostels where name = 'New Hostel')
--   )
--   on conflict do nothing;
--
-- Repeat with role = 'patron_matron' for a second test account.
-- ============================================================================
