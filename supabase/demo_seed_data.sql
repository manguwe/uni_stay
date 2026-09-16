-- ============================================================================
-- Eden Hostel Portal — Demo seed data for the competition presentation
--
-- SAFE TO RE-RUN. Two things make this idempotent:
--   1. Every demo account uses a fixed, clearly-demo-only email address
--      (@edenhostel.test). Section 0 deletes anything previously seeded
--      under those emails before recreating it.
--   2. Demo allocations use DEDICATED rooms (room numbers "D01"/"D02"/
--      "D03"), created fresh by this script inside New Hostel and Ruth
--      Hostel, rather than reusing whichever beds happened to be vacant
--      in the original Phase 1 seed data. This was the actual bug in
--      the previous version: it hardcoded specific Phase 1 beds
--      (New Hostel Room 201, etc.) that had already been allocated to a
--      real test student at some point during ordinary manual testing,
--      completely unrelated to this script — so it collided with
--      whatever real state happened to exist there. Dedicated,
--      script-owned rooms can never collide with anything else in the
--      database, and are exactly as easy to clean up as Unity Hostel
--      already was.
--
-- IMPORTANT — READ BEFORE THE DEMO, NOT DURING IT:
-- This script inserts directly into Supabase's own auth.users /
-- auth.identities tables to create login-ready accounts without going
-- through the signup UI. This is a well-established pattern for seeding
-- Supabase projects, but it touches managed internals that can vary
-- slightly by project/Postgres version. Please run this AND test that
-- every account below can actually log in with plenty of time to spare
-- before you're on stage. If any single account fails to log in, the
-- reliable fallback is: sign up that one account normally through
-- /signup with the same email, then re-run this script (the "configure
-- this account" UPDATE statements use email lookups, so they'll still
-- find and correctly configure an account created that way).
--
-- Every seeded account uses the same password: Demo12345!
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 0 — Clean slate for demo data only (safe re-run)
-- Order matters throughout: student-related rows first (cascades away
-- everything they created), THEN the dedicated demo rooms (safe once no
-- hostel_applications still points at them — room_id has no cascade),
-- THEN staff accounts (safe once nothing references them via
-- reviewed_by/allocated_by/verified_by/actor_id, none of which cascade),
-- THEN Unity Hostel.
-- ---------------------------------------------------------------------------
delete from announcements
where created_by in (
  select id from auth.users
  where email in ('admin.demo@edenhostel.test', 'patron.demo@edenhostel.test', 'chair.demo@edenhostel.test')
);

delete from auth.users where email in (
  'student.confirmed@edenhostel.test',
  'student.roommate@edenhostel.test',
  'student.awaiting@edenhostel.test',
  'student.waitlisted@edenhostel.test',
  'student.rejected@edenhostel.test',
  'student.complaint.progress@edenhostel.test',
  'student.complaint.resolved@edenhostel.test'
);

delete from rooms
where room_number like 'D%'
  and hostel_id in (select id from hostels where name in ('New Hostel', 'Ruth Hostel'));

delete from auth.users where email in (
  'admin.demo@edenhostel.test',
  'chair.demo@edenhostel.test',
  'patron.demo@edenhostel.test'
);

delete from hostels where name = 'Unity Hostel';

-- ============================================================================
-- Session-scoped helper (pg_temp — exists only for this SQL session, no
-- cleanup needed afterward): creates one auth user + a matching identity
-- row (recent Supabase versions check auth.identities for email/password
-- sign-in), returns its new id. The on_auth_user_created trigger fires
-- automatically on the auth.users insert and creates a bare 'student'
-- profile row — every UPDATE in the DO block below fills that row in,
-- same two-step shape the app's own signup flow uses.
--
-- Defined as its own statement, not nested inside the DO block below,
-- because PL/pgSQL does not support declaring a function inside another
-- function/DO block's DECLARE section.
-- ============================================================================
create or replace function pg_temp.create_demo_user(p_email text, p_password_hash text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    p_email, p_password_hash, now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id,
    jsonb_build_object('sub', v_id::text, 'email', p_email),
    'email', v_id::text, now(), now(), now()
  );

  return v_id;
end;
$$;

-- ============================================================================
-- SECTION 1 — Accounts, hostels, and every demo scenario
-- ============================================================================

do $$
declare
  v_password text := crypt('Demo12345!', gen_salt('bf'));

  v_new_hostel_id uuid;
  v_ruth_hostel_id uuid;
  v_unity_hostel_id uuid;

  v_block_id uuid;
  v_floor1_id uuid;
  v_floor2_id uuid;
  v_room_id uuid;

  v_admin_id uuid;
  v_chair_id uuid;
  v_patron_id uuid;
  v_student_confirmed_id uuid;
  v_student_roommate_id uuid;
  v_student_awaiting_id uuid;
  v_student_waitlisted_id uuid;
  v_student_rejected_id uuid;
  v_student_complaint_progress_id uuid;
  v_student_complaint_resolved_id uuid;

  -- Dedicated demo rooms/beds (New Hostel D01/D02/D03, Ruth Hostel D01) —
  -- created fresh in Section 2b below, never reused from Phase 1's
  -- originally-seeded rooms. Named after their demo purpose, not a room
  -- number, since that's what they actually represent here.
  v_room_confirmed_id uuid;
  v_room_awaiting_id uuid;
  v_room_complaint_progress_id uuid;
  v_room_complaint_resolved_id uuid;

  v_bed_confirmed uuid;
  v_bed_roommate uuid;
  v_bed_awaiting uuid;
  v_bed_complaint_progress uuid;
  v_bed_complaint_resolved uuid;

  v_app_confirmed_id uuid;
  v_app_roommate_id uuid;
  v_app_awaiting_id uuid;
  v_app_complaint_progress_id uuid;
  v_app_complaint_resolved_id uuid;

  v_alloc_confirmed_id uuid;
  v_alloc_roommate_id uuid;
  v_alloc_awaiting_id uuid;
  v_alloc_complaint_progress_id uuid;
  v_alloc_complaint_resolved_id uuid;

  v_complaint_progress_id uuid;
  v_complaint_resolved_id uuid;
begin
  select id into v_new_hostel_id from hostels where name = 'New Hostel';
  select id into v_ruth_hostel_id from hostels where name = 'Ruth Hostel';

  if v_new_hostel_id is null or v_ruth_hostel_id is null then
    raise exception 'Expected "New Hostel" and "Ruth Hostel" from the Phase 1 seed to already exist — run supabase/schema.sql first if this is a brand new project.';
  end if;

  -- -------------------------------------------------------------------
  -- Staff accounts
  -- -------------------------------------------------------------------
  v_admin_id := pg_temp.create_demo_user('admin.demo@edenhostel.test', v_password);
  update profiles set role = 'admin', full_name = 'Admin Demo' where id = v_admin_id;

  v_chair_id := pg_temp.create_demo_user('chair.demo@edenhostel.test', v_password);
  update profiles set role = 'chairperson', full_name = 'Chishimba Mwansa' where id = v_chair_id;
  insert into staff_hostel_assignments (profile_id, hostel_id) values (v_chair_id, v_new_hostel_id);

  v_patron_id := pg_temp.create_demo_user('patron.demo@edenhostel.test', v_password);
  update profiles set role = 'patron_matron', full_name = 'Beatrice Tembo' where id = v_patron_id;
  insert into staff_hostel_assignments (profile_id, hostel_id) values (v_patron_id, v_new_hostel_id);

  -- -------------------------------------------------------------------
  -- Student accounts — every profile field complete (NRC/Passport and
  -- phone are required by the profile-completion gate)
  -- -------------------------------------------------------------------
  v_student_confirmed_id := pg_temp.create_demo_user('student.confirmed@edenhostel.test', v_password);
  update profiles set
    full_name = 'Mulenga Chanda', student_number = '2021100001', programme = 'BSc Computer Science',
    year_of_study = 2, gender = 'male', id_document_type = 'nrc', id_document_number = '123456/10/1',
    phone_number = '0977100001'
  where id = v_student_confirmed_id;

  v_student_roommate_id := pg_temp.create_demo_user('student.roommate@edenhostel.test', v_password);
  update profiles set
    full_name = 'Kondwani Phiri', student_number = '2021100002', programme = 'BEng Civil Engineering',
    year_of_study = 2, gender = 'male', id_document_type = 'nrc', id_document_number = '234567/10/1',
    phone_number = '0977100002'
  where id = v_student_roommate_id;

  v_student_awaiting_id := pg_temp.create_demo_user('student.awaiting@edenhostel.test', v_password);
  update profiles set
    full_name = 'Bwalya Kalunga', student_number = '2021100003', programme = 'BA Economics',
    year_of_study = 1, gender = 'male', id_document_type = 'passport', id_document_number = 'ZP1234567',
    phone_number = '0977100003'
  where id = v_student_awaiting_id;

  v_student_waitlisted_id := pg_temp.create_demo_user('student.waitlisted@edenhostel.test', v_password);
  update profiles set
    full_name = 'Natasha Mumba', student_number = '2021100004', programme = 'BSc Nursing',
    year_of_study = 1, gender = 'female', id_document_type = 'nrc', id_document_number = '345678/10/1',
    phone_number = '0977100004'
  where id = v_student_waitlisted_id;

  v_student_rejected_id := pg_temp.create_demo_user('student.rejected@edenhostel.test', v_password);
  update profiles set
    full_name = 'Chalwe Banda', student_number = '2021100005', programme = 'BSc Biology',
    year_of_study = 1, gender = 'female', id_document_type = 'nrc', id_document_number = '456789/10/1',
    phone_number = '0977100005'
  where id = v_student_rejected_id;

  v_student_complaint_progress_id := pg_temp.create_demo_user('student.complaint.progress@edenhostel.test', v_password);
  update profiles set
    full_name = 'Isaac Zulu', student_number = '2021100006', programme = 'BEng Electrical Engineering',
    year_of_study = 3, gender = 'male', id_document_type = 'nrc', id_document_number = '567890/10/1',
    phone_number = '0977100006'
  where id = v_student_complaint_progress_id;

  v_student_complaint_resolved_id := pg_temp.create_demo_user('student.complaint.resolved@edenhostel.test', v_password);
  update profiles set
    full_name = 'Grace Lungu', student_number = '2021100007', programme = 'BSc Chemistry',
    year_of_study = 2, gender = 'female', id_document_type = 'passport', id_document_number = 'ZP7654321',
    phone_number = '0977100007'
  where id = v_student_complaint_resolved_id;

  -- ============================================================================
  -- SECTION 2 — Unity Hostel (new, mixed), realistic "mostly occupied"
  -- bed-status mix
  -- ============================================================================
  insert into hostels (name, gender, campus_location, total_bed_capacity)
  values ('Unity Hostel', 'mixed', 'Eden University — Central Campus', 24)
  returning id into v_unity_hostel_id;

  insert into blocks (hostel_id, name) values (v_unity_hostel_id, 'Block A') returning id into v_block_id;
  insert into floors (hostel_id, block_id, name) values (v_unity_hostel_id, v_block_id, 'Floor 1') returning id into v_floor1_id;
  insert into floors (hostel_id, block_id, name) values (v_unity_hostel_id, v_block_id, 'Floor 2') returning id into v_floor2_id;

  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (v_unity_hostel_id, v_block_id, v_floor1_id, '101', '4-bed', 4, array['Wardrobe','Study desk','Power outlet'])
  returning id into v_room_id;
  insert into beds (room_id, bed_label, status) values
    (v_room_id, 'Bed 1', 'occupied'), (v_room_id, 'Bed 2', 'occupied'),
    (v_room_id, 'Bed 3', 'occupied'), (v_room_id, 'Bed 4', 'vacant');

  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (v_unity_hostel_id, v_block_id, v_floor1_id, '102', '4-bed', 4, array['Wardrobe','Study desk'])
  returning id into v_room_id;
  insert into beds (room_id, bed_label, status) values
    (v_room_id, 'Bed 1', 'occupied'), (v_room_id, 'Bed 2', 'occupied'),
    (v_room_id, 'Bed 3', 'reserved'), (v_room_id, 'Bed 4', 'occupied');

  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (v_unity_hostel_id, v_block_id, v_floor2_id, '201', '2-bed', 2, array['Wardrobe','Study desk','Power outlet'])
  returning id into v_room_id;
  insert into beds (room_id, bed_label, status) values
    (v_room_id, 'Bed 1', 'occupied'), (v_room_id, 'Bed 2', 'maintenance');

  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (v_unity_hostel_id, v_block_id, v_floor2_id, '202', '4-bed', 4, array['Wardrobe','Study desk','Balcony'])
  returning id into v_room_id;
  insert into beds (room_id, bed_label, status) values
    (v_room_id, 'Bed 1', 'occupied'), (v_room_id, 'Bed 2', 'occupied'),
    (v_room_id, 'Bed 3', 'vacant'), (v_room_id, 'Bed 4', 'occupied');

  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (v_unity_hostel_id, v_block_id, v_floor2_id, '203', '2-bed', 2, array['Wardrobe','Study desk'])
  returning id into v_room_id;
  insert into beds (room_id, bed_label, status) values
    (v_room_id, 'Bed 1', 'occupied'), (v_room_id, 'Bed 2', 'occupied');

  -- ============================================================================
  -- SECTION 2b — Dedicated demo rooms in New Hostel + Ruth Hostel
  --
  -- Created fresh, fully owned by this script (room numbers "D01"/"D02"/
  -- "D03" won't collide with any real numbering scheme), so demo
  -- allocations below can NEVER collide with a bed some other test
  -- session already allocated in the ORIGINAL Phase 1 rooms.
  -- ============================================================================
  insert into rooms (hostel_id, room_number, room_type, bed_capacity, facilities)
  values (v_new_hostel_id, 'D01', '2-bed', 2, array['Wardrobe','Study desk','Power outlet'])
  returning id into v_room_confirmed_id;
  insert into beds (room_id, bed_label, status) values (v_room_confirmed_id, 'Bed 1', 'vacant') returning id into v_bed_confirmed;
  insert into beds (room_id, bed_label, status) values (v_room_confirmed_id, 'Bed 2', 'vacant') returning id into v_bed_roommate;

  insert into rooms (hostel_id, room_number, room_type, bed_capacity, facilities)
  values (v_new_hostel_id, 'D02', '1-bed', 1, array['Wardrobe','Study desk'])
  returning id into v_room_awaiting_id;
  insert into beds (room_id, bed_label, status) values (v_room_awaiting_id, 'Bed 1', 'vacant') returning id into v_bed_awaiting;

  insert into rooms (hostel_id, room_number, room_type, bed_capacity, facilities)
  values (v_new_hostel_id, 'D03', '1-bed', 1, array['Wardrobe','Study desk'])
  returning id into v_room_complaint_progress_id;
  insert into beds (room_id, bed_label, status) values (v_room_complaint_progress_id, 'Bed 1', 'vacant') returning id into v_bed_complaint_progress;

  insert into rooms (hostel_id, room_number, room_type, bed_capacity, facilities)
  values (v_ruth_hostel_id, 'D01', '1-bed', 1, array['Wardrobe','Study desk'])
  returning id into v_room_complaint_resolved_id;
  insert into beds (room_id, bed_label, status) values (v_room_complaint_resolved_id, 'Bed 1', 'vacant') returning id into v_bed_complaint_resolved;

  -- ============================================================================
  -- SECTION 3 — Applications, allocations, and payments
  --
  -- Written directly to the tables (not via the allocate_bed() RPC),
  -- since that RPC checks current_user_role() against auth.uid(), which
  -- is null in a raw SQL Editor session with no JWT — it would reject
  -- every call here regardless of the account's real role. Seeding an
  -- end-state directly is correct for a trusted admin script; the RPC's
  -- checks matter for real client traffic, not this.
  -- ============================================================================

  -- --- Students 1 & 2: allocated + payment CONFIRMED, same room (roommates) ---
  insert into hostel_applications (id, student_id, hostel_id, room_id, year_of_study, status, submitted_at, reviewed_at, reviewed_by)
  values (gen_random_uuid(), v_student_confirmed_id, v_new_hostel_id, v_room_confirmed_id, 2, 'approved', now() - interval '14 days', now() - interval '13 days', v_patron_id)
  returning id into v_app_confirmed_id;

  insert into allocations (id, application_id, bed_id, term, allocated_at, allocated_by)
  values (gen_random_uuid(), v_app_confirmed_id, v_bed_confirmed, 'Current Term', now() - interval '13 days', v_patron_id)
  returning id into v_alloc_confirmed_id;
  update beds set status = 'occupied' where id = v_bed_confirmed;
  insert into payment_records (allocation_id, amount_due, reference_number, status, submitted_at, verified_by, verified_at)
  values (v_alloc_confirmed_id, 1500.00, 'MM240001', 'confirmed', now() - interval '10 days', v_patron_id, now() - interval '9 days');

  insert into hostel_applications (id, student_id, hostel_id, room_id, year_of_study, status, submitted_at, reviewed_at, reviewed_by)
  values (gen_random_uuid(), v_student_roommate_id, v_new_hostel_id, v_room_confirmed_id, 2, 'approved', now() - interval '12 days', now() - interval '11 days', v_patron_id)
  returning id into v_app_roommate_id;

  insert into allocations (id, application_id, bed_id, term, allocated_at, allocated_by)
  values (gen_random_uuid(), v_app_roommate_id, v_bed_roommate, 'Current Term', now() - interval '11 days', v_patron_id)
  returning id into v_alloc_roommate_id;
  update beds set status = 'occupied' where id = v_bed_roommate;
  insert into payment_records (allocation_id, amount_due, reference_number, status, submitted_at, verified_by, verified_at)
  values (v_alloc_roommate_id, 1500.00, 'MM240002', 'confirmed', now() - interval '9 days', v_patron_id, now() - interval '8 days');

  -- --- Student 3: allocated, payment AWAITING VERIFICATION ---
  insert into hostel_applications (id, student_id, hostel_id, room_id, year_of_study, status, submitted_at, reviewed_at, reviewed_by)
  values (gen_random_uuid(), v_student_awaiting_id, v_new_hostel_id, v_room_awaiting_id, 1, 'approved', now() - interval '6 days', now() - interval '5 days', v_patron_id)
  returning id into v_app_awaiting_id;

  insert into allocations (id, application_id, bed_id, term, allocated_at, allocated_by)
  values (gen_random_uuid(), v_app_awaiting_id, v_bed_awaiting, 'Current Term', now() - interval '5 days', v_patron_id)
  returning id into v_alloc_awaiting_id;
  update beds set status = 'occupied' where id = v_bed_awaiting;
  insert into payment_records (allocation_id, amount_due, reference_number, status, submitted_at)
  values (v_alloc_awaiting_id, 1500.00, 'MM240003', 'awaiting_verification', now() - interval '1 day');

  -- --- Student 4: WAITLISTED (Unity Hostel, mixed) ---
  insert into hostel_applications (student_id, hostel_id, year_of_study, status, priority_rank, submitted_at, reviewed_at, reviewed_by)
  values (v_student_waitlisted_id, v_unity_hostel_id, 1, 'waitlisted', 1, now() - interval '4 days', now() - interval '3 days', v_admin_id);

  -- --- Student 5: REJECTED, gender-mismatch narrative ---
  insert into hostel_applications (student_id, hostel_id, year_of_study, status, rejection_reason, submitted_at, reviewed_at, reviewed_by)
  values (
    v_student_rejected_id, v_new_hostel_id, 1, 'rejected',
    'New Hostel is designated male; this application does not match the required gender designation.',
    now() - interval '5 days', now() - interval '4 days', v_admin_id
  );

  -- --- Student 6: allocated + complaint IN PROGRESS (submitted -> escalated) ---
  insert into hostel_applications (id, student_id, hostel_id, room_id, year_of_study, status, submitted_at, reviewed_at, reviewed_by)
  values (gen_random_uuid(), v_student_complaint_progress_id, v_new_hostel_id, v_room_complaint_progress_id, 3, 'approved', now() - interval '20 days', now() - interval '19 days', v_patron_id)
  returning id into v_app_complaint_progress_id;

  insert into allocations (id, application_id, bed_id, term, allocated_at, allocated_by)
  values (gen_random_uuid(), v_app_complaint_progress_id, v_bed_complaint_progress, 'Current Term', now() - interval '19 days', v_patron_id)
  returning id into v_alloc_complaint_progress_id;
  update beds set status = 'occupied' where id = v_bed_complaint_progress;
  insert into payment_records (allocation_id, amount_due, reference_number, status, submitted_at, verified_by, verified_at)
  values (v_alloc_complaint_progress_id, 1500.00, 'MM240004', 'confirmed', now() - interval '18 days', v_patron_id, now() - interval '17 days');

  -- --- Student 7: allocated + complaint RESOLVED (Ruth Hostel, female) ---
  insert into hostel_applications (id, student_id, hostel_id, room_id, year_of_study, status, submitted_at, reviewed_at, reviewed_by)
  values (gen_random_uuid(), v_student_complaint_resolved_id, v_ruth_hostel_id, v_room_complaint_resolved_id, 2, 'approved', now() - interval '25 days', now() - interval '24 days', v_admin_id)
  returning id into v_app_complaint_resolved_id;

  insert into allocations (id, application_id, bed_id, term, allocated_at, allocated_by)
  values (gen_random_uuid(), v_app_complaint_resolved_id, v_bed_complaint_resolved, 'Current Term', now() - interval '24 days', v_admin_id)
  returning id into v_alloc_complaint_resolved_id;
  update beds set status = 'occupied' where id = v_bed_complaint_resolved;
  insert into payment_records (allocation_id, amount_due, reference_number, status, submitted_at, verified_by, verified_at)
  values (v_alloc_complaint_resolved_id, 1500.00, 'MM240005', 'confirmed', now() - interval '23 days', v_admin_id, now() - interval '22 days');

  -- ============================================================================
  -- SECTION 4 — Complaints with rich timelines
  -- ============================================================================

  insert into complaints (id, student_id, hostel_id, room_id, category, description, priority, status, escalated_at, created_at)
  values (
    gen_random_uuid(), v_student_complaint_progress_id, v_new_hostel_id, v_room_complaint_progress_id,
    'plumbing', 'The shower in our room has been leaking steadily for three days and the floor stays wet.',
    'high', 'escalated', now() - interval '1 day', now() - interval '3 days'
  )
  returning id into v_complaint_progress_id;
  -- log_complaint_submission() trigger already added the "submitted" entry.
  insert into complaint_updates (complaint_id, actor_id, action, comment, resulting_status, created_at)
  values (v_complaint_progress_id, v_chair_id, 'reviewed', null, 'under_review', now() - interval '2 days');
  insert into complaint_updates (complaint_id, actor_id, action, comment, resulting_status, created_at)
  values (v_complaint_progress_id, v_chair_id, 'escalated', 'Recurring leak, needs a plumber — escalating to Patron/Matron.', 'escalated', now() - interval '1 day');

  insert into complaints (id, student_id, hostel_id, room_id, category, description, priority, status, assigned_to, escalated_at, created_at)
  values (
    gen_random_uuid(), v_student_complaint_resolved_id, v_ruth_hostel_id, v_room_complaint_resolved_id,
    'electricity', 'One of the power outlets in our room sparked when I plugged in my laptop charger.',
    'high', 'resolved', 'Facilities — John Mwale', now() - interval '20 days', now() - interval '22 days'
  )
  returning id into v_complaint_resolved_id;
  insert into complaint_updates (complaint_id, actor_id, action, comment, resulting_status, created_at)
  values (v_complaint_resolved_id, v_admin_id, 'reviewed', null, 'under_review', now() - interval '21 days');
  insert into complaint_updates (complaint_id, actor_id, action, comment, resulting_status, created_at)
  values (v_complaint_resolved_id, v_admin_id, 'escalated', 'Electrical safety issue — escalating immediately.', 'escalated', now() - interval '20 days');
  insert into complaint_updates (complaint_id, actor_id, action, comment, resulting_status, created_at)
  values (v_complaint_resolved_id, v_admin_id, 'assigned', 'Assigned to facilities for urgent inspection.', 'assigned', now() - interval '19 days');
  insert into complaint_updates (complaint_id, actor_id, action, comment, resulting_status, created_at)
  values (v_complaint_resolved_id, v_admin_id, 'resolved', 'Outlet was faulty — replaced and tested safe. No further sparking.', 'resolved', now() - interval '18 days');

  -- ============================================================================
  -- SECTION 5 — Announcements
  -- ============================================================================
  insert into announcements (created_by, title, body, target_hostel_id, created_at)
  values (
    v_patron_id, 'Water shutdown — Saturday 8am-12pm',
    'Maintenance will be shutting off water supply to New Hostel this Saturday from 8am to 12pm for tank cleaning. Please store water in advance.',
    v_new_hostel_id, now() - interval '2 days'
  );

  insert into announcements (created_by, title, body, created_at)
  values (
    v_admin_id, 'Welcome to the new term',
    'Welcome back! Hostel fees for this term are due within 14 days of allocation. Check Finance for your payment status and instructions.',
    now() - interval '5 days'
  );

end $$;
