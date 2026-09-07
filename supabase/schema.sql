-- ============================================================================
-- Eden Hostel Portal — Phase 1 schema
-- Hostel structure: hostels -> blocks -> floors -> flats -> rooms -> beds
-- (KB §6). Intermediate levels are optional per-hostel (KB §6, §21) — a room
-- can attach directly to a block/floor/hostel and skip flats, etc.
--
-- Run this whole file once in the Supabase SQL editor (SQL Editor > New query).
-- Safe to re-run: it drops and recreates the Phase 1 tables first.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Clean slate (Phase 1 tables only — safe to re-run during development)
-- ---------------------------------------------------------------------------
drop table if exists beds cascade;
drop table if exists rooms cascade;
drop table if exists flats cascade;
drop table if exists floors cascade;
drop table if exists blocks cascade;
drop table if exists hostels cascade;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table hostels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text not null check (gender in ('male', 'female', 'mixed')),
  campus_location text,
  total_bed_capacity int not null default 0,
  created_at timestamptz not null default now()
);

create table blocks (
  id uuid primary key default gen_random_uuid(),
  hostel_id uuid not null references hostels(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table floors (
  id uuid primary key default gen_random_uuid(),
  hostel_id uuid not null references hostels(id) on delete cascade,
  block_id uuid references blocks(id) on delete cascade, -- nullable: a hostel may skip "block"
  name text not null,
  created_at timestamptz not null default now()
);

create table flats (
  id uuid primary key default gen_random_uuid(),
  hostel_id uuid not null references hostels(id) on delete cascade,
  floor_id uuid references floors(id) on delete cascade, -- nullable: a hostel may skip "flat"
  name text not null,
  created_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  hostel_id uuid not null references hostels(id) on delete cascade,
  block_id uuid references blocks(id) on delete cascade,
  floor_id uuid references floors(id) on delete cascade,
  flat_id uuid references flats(id) on delete cascade,
  room_number text not null,
  room_type text,
  bed_capacity int not null check (bed_capacity > 0),
  facilities text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table beds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  bed_label text not null,
  status text not null default 'vacant'
    check (status in ('vacant', 'occupied', 'reserved', 'maintenance')),
  created_at timestamptz not null default now(),
  unique (room_id, bed_label)
);

-- ---------------------------------------------------------------------------
-- Indexes for the explorer's common filter/lookup patterns
-- ---------------------------------------------------------------------------
create index idx_blocks_hostel on blocks(hostel_id);
create index idx_floors_hostel on floors(hostel_id);
create index idx_floors_block on floors(block_id);
create index idx_flats_hostel on flats(hostel_id);
create index idx_flats_floor on flats(floor_id);
create index idx_rooms_hostel on rooms(hostel_id);
create index idx_rooms_block on rooms(block_id);
create index idx_rooms_floor on rooms(floor_id);
create index idx_rooms_flat on rooms(flat_id);
create index idx_rooms_room_number on rooms(room_number);
create index idx_beds_room on beds(room_id);
create index idx_beds_status on beds(status);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Phase 1 is read-only and public-facing: hostel/room/bed *structure* and
-- aggregate status is not sensitive on its own (no student names or contact
-- info live in these tables — that only appears with roommate visibility in
-- a later phase, per KB §9, and will get its own tighter policies then).
-- So: SELECT is open to anon + authenticated, and there are deliberately no
-- INSERT/UPDATE/DELETE policies yet — nobody can write from the client until
-- the Admin role and auth are built in Phase 4. Writes for now only happen
-- via the Supabase SQL editor (e.g. this seed script) using the service role.
-- ---------------------------------------------------------------------------

alter table hostels enable row level security;
alter table blocks enable row level security;
alter table floors enable row level security;
alter table flats enable row level security;
alter table rooms enable row level security;
alter table beds enable row level security;

create policy "Public read hostels" on hostels for select using (true);
create policy "Public read blocks" on blocks for select using (true);
create policy "Public read floors" on floors for select using (true);
create policy "Public read flats" on flats for select using (true);
create policy "Public read rooms" on rooms for select using (true);
create policy "Public read beds" on beds for select using (true);

-- ============================================================================
-- Seed data — fictional, for demo purposes only (KB §3)
--
-- Hostel 1 "New Hostel" (male): demonstrates the FULL hierarchy on one
-- branch (Block A -> Floor 2 -> Flat 2 -> Room 204, matching the KB §6
-- worked example exactly) and a SKIPPED "flat" level on another branch
-- (Block A -> Floor 1 -> rooms directly), to prove the flexible hierarchy
-- actually works in the explorer.
--
-- Hostel 2 "Ruth Hostel" (female): simpler structure, one block, floors
-- with rooms directly under them (no flats at all), to further prove the
-- skip-a-level requirement (KB §6, §21).
-- ============================================================================

do $$
declare
  new_hostel_id uuid;
  ruth_hostel_id uuid;

  block_a_id uuid;
  floor1_id uuid;
  floor2_id uuid;
  flat1_id uuid;
  flat2_id uuid;

  ruth_block_a_id uuid;
  ruth_floor1_id uuid;
  ruth_floor2_id uuid;

  room_id uuid;
begin
  -- ---------------------------------------------------------------------
  -- Hostel 1: New Hostel (male)
  -- ---------------------------------------------------------------------
  insert into hostels (name, gender, campus_location, total_bed_capacity)
  values ('New Hostel', 'male', 'Eden University — East Campus', 48)
  returning id into new_hostel_id;

  insert into blocks (hostel_id, name) values (new_hostel_id, 'Block A')
  returning id into block_a_id;

  insert into floors (hostel_id, block_id, name) values (new_hostel_id, block_a_id, 'Floor 1')
  returning id into floor1_id;

  insert into floors (hostel_id, block_id, name) values (new_hostel_id, block_a_id, 'Floor 2')
  returning id into floor2_id;

  -- Floor 1: rooms directly under the floor — "flat" level is skipped here.
  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (new_hostel_id, block_a_id, floor1_id, '101', '2-bed', 2, array['Wardrobe','Study desk','Power outlet'])
  returning id into room_id;
  insert into beds (room_id, bed_label, status) values
    (room_id, 'Bed 1', 'occupied'),
    (room_id, 'Bed 2', 'vacant');

  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (new_hostel_id, block_a_id, floor1_id, '102', '2-bed', 2, array['Wardrobe','Study desk'])
  returning id into room_id;
  insert into beds (room_id, bed_label, status) values
    (room_id, 'Bed 1', 'occupied'),
    (room_id, 'Bed 2', 'occupied');

  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (new_hostel_id, block_a_id, floor1_id, '103', '4-bed', 4, array['Wardrobe','Study desk','Power outlet','Balcony'])
  returning id into room_id;
  insert into beds (room_id, bed_label, status) values
    (room_id, 'Bed 1', 'occupied'),
    (room_id, 'Bed 2', 'vacant'),
    (room_id, 'Bed 3', 'vacant'),
    (room_id, 'Bed 4', 'reserved');

  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (new_hostel_id, block_a_id, floor1_id, '104', '4-bed', 4, array['Wardrobe','Study desk'])
  returning id into room_id;
  insert into beds (room_id, bed_label, status) values
    (room_id, 'Bed 1', 'maintenance'),
    (room_id, 'Bed 2', 'maintenance'),
    (room_id, 'Bed 3', 'occupied'),
    (room_id, 'Bed 4', 'vacant');

  -- Floor 2: uses flats (Flat 1, Flat 2) — the full hierarchy branch,
  -- matching KB §6's worked example (New Hostel -> Block A -> Floor 2 ->
  -- Flat 2 -> Room 204 -> Bed 2).
  insert into flats (hostel_id, floor_id, name) values (new_hostel_id, floor2_id, 'Flat 1')
  returning id into flat1_id;
  insert into flats (hostel_id, floor_id, name) values (new_hostel_id, floor2_id, 'Flat 2')
  returning id into flat2_id;

  insert into rooms (hostel_id, block_id, floor_id, flat_id, room_number, room_type, bed_capacity, facilities)
  values (new_hostel_id, block_a_id, floor2_id, flat1_id, '201', '2-bed', 2, array['Wardrobe','Study desk','Power outlet'])
  returning id into room_id;
  insert into beds (room_id, bed_label, status) values
    (room_id, 'Bed 1', 'vacant'),
    (room_id, 'Bed 2', 'vacant');

  insert into rooms (hostel_id, block_id, floor_id, flat_id, room_number, room_type, bed_capacity, facilities)
  values (new_hostel_id, block_a_id, floor2_id, flat1_id, '202', '2-bed', 2, array['Wardrobe','Study desk'])
  returning id into room_id;
  insert into beds (room_id, bed_label, status) values
    (room_id, 'Bed 1', 'occupied'),
    (room_id, 'Bed 2', 'reserved');

  insert into rooms (hostel_id, block_id, floor_id, flat_id, room_number, room_type, bed_capacity, facilities)
  values (new_hostel_id, block_a_id, floor2_id, flat2_id, '203', '4-bed', 4, array['Wardrobe','Study desk','Power outlet'])
  returning id into room_id;
  insert into beds (room_id, bed_label, status) values
    (room_id, 'Bed 1', 'occupied'),
    (room_id, 'Bed 2', 'occupied'),
    (room_id, 'Bed 3', 'occupied'),
    (room_id, 'Bed 4', 'vacant');

  insert into rooms (hostel_id, block_id, floor_id, flat_id, room_number, room_type, bed_capacity, facilities)
  values (new_hostel_id, block_a_id, floor2_id, flat2_id, '204', '4-bed', 4, array['Wardrobe','Study desk','Power outlet','Balcony'])
  returning id into room_id;
  insert into beds (room_id, bed_label, status) values
    (room_id, 'Bed 1', 'occupied'),
    (room_id, 'Bed 2', 'vacant'),
    (room_id, 'Bed 3', 'vacant'),
    (room_id, 'Bed 4', 'occupied');

  -- ---------------------------------------------------------------------
  -- Hostel 2: Ruth Hostel (female) — one block, floors, rooms directly
  -- under floors. No flats anywhere in this hostel.
  -- ---------------------------------------------------------------------
  insert into hostels (name, gender, campus_location, total_bed_capacity)
  values ('Ruth Hostel', 'female', 'Eden University — West Campus', 32)
  returning id into ruth_hostel_id;

  insert into blocks (hostel_id, name) values (ruth_hostel_id, 'Block A')
  returning id into ruth_block_a_id;

  insert into floors (hostel_id, block_id, name) values (ruth_hostel_id, ruth_block_a_id, 'Floor 1')
  returning id into ruth_floor1_id;
  insert into floors (hostel_id, block_id, name) values (ruth_hostel_id, ruth_block_a_id, 'Floor 2')
  returning id into ruth_floor2_id;

  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (ruth_hostel_id, ruth_block_a_id, ruth_floor1_id, '101', '2-bed', 2, array['Wardrobe','Study desk'])
  returning id into room_id;
  insert into beds (room_id, bed_label, status) values
    (room_id, 'Bed 1', 'vacant'),
    (room_id, 'Bed 2', 'vacant');

  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (ruth_hostel_id, ruth_block_a_id, ruth_floor1_id, '102', '4-bed', 4, array['Wardrobe','Study desk','Power outlet'])
  returning id into room_id;
  insert into beds (room_id, bed_label, status) values
    (room_id, 'Bed 1', 'occupied'),
    (room_id, 'Bed 2', 'occupied'),
    (room_id, 'Bed 3', 'occupied'),
    (room_id, 'Bed 4', 'occupied');

  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (ruth_hostel_id, ruth_block_a_id, ruth_floor2_id, '201', '2-bed', 2, array['Wardrobe','Study desk','Power outlet'])
  returning id into room_id;
  insert into beds (room_id, bed_label, status) values
    (room_id, 'Bed 1', 'reserved'),
    (room_id, 'Bed 2', 'vacant');

  insert into rooms (hostel_id, block_id, floor_id, room_number, room_type, bed_capacity, facilities)
  values (ruth_hostel_id, ruth_block_a_id, ruth_floor2_id, '202', '4-bed', 4, array['Wardrobe','Study desk'])
  returning id into room_id;
  insert into beds (room_id, bed_label, status) values
    (room_id, 'Bed 1', 'maintenance'),
    (room_id, 'Bed 2', 'vacant'),
    (room_id, 'Bed 3', 'vacant'),
    (room_id, 'Bed 4', 'occupied');

end $$;
