-- ============================================================================
-- Eden Hostel Portal — Phase 4 migration
-- Admin dashboard (read-only aggregation, no new SQL needed — see note at
-- the bottom), full inventory CRUD, and admin-level user/complaint
-- oversight.
--
-- Run this AFTER the role-based-onboarding fix (previous turn), once.
-- Idempotent as always.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Admin can update ANY profile, not just their own
--
-- This was a genuine gap, not just a naming mismatch: only "Users can
-- update own profile" (auth.uid() = id) existed. The role-assignment UI
-- in this phase needs admin to change OTHER users' role/gender/etc., and
-- without this policy that UPDATE would be silently filtered to zero
-- rows by RLS. The existing prevent_role_self_promotion() and
-- prevent_gender_change_after_set() triggers already special-case admin
-- (they only block a NON-admin from changing those columns), so this one
-- new policy is the complete fix — no trigger changes needed.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can update any profile" on profiles;
create policy "Admins can update any profile" on profiles
  for update using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 2. Admin write access to the inventory hierarchy
--
-- KB §6's flexible hierarchy means block_id/floor_id/flat_id stay
-- nullable on their children exactly as Phase 1 defined them — nothing
-- about that changes here, this just adds who may write.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can insert hostels" on hostels;
create policy "Admins can insert hostels" on hostels
  for insert with check (public.current_user_role() = 'admin');
drop policy if exists "Admins can update hostels" on hostels;
create policy "Admins can update hostels" on hostels
  for update using (public.current_user_role() = 'admin');
drop policy if exists "Admins can delete hostels" on hostels;
create policy "Admins can delete hostels" on hostels
  for delete using (public.current_user_role() = 'admin');

drop policy if exists "Admins can insert blocks" on blocks;
create policy "Admins can insert blocks" on blocks
  for insert with check (public.current_user_role() = 'admin');
drop policy if exists "Admins can update blocks" on blocks;
create policy "Admins can update blocks" on blocks
  for update using (public.current_user_role() = 'admin');
drop policy if exists "Admins can delete blocks" on blocks;
create policy "Admins can delete blocks" on blocks
  for delete using (public.current_user_role() = 'admin');

drop policy if exists "Admins can insert floors" on floors;
create policy "Admins can insert floors" on floors
  for insert with check (public.current_user_role() = 'admin');
drop policy if exists "Admins can update floors" on floors;
create policy "Admins can update floors" on floors
  for update using (public.current_user_role() = 'admin');
drop policy if exists "Admins can delete floors" on floors;
create policy "Admins can delete floors" on floors
  for delete using (public.current_user_role() = 'admin');

drop policy if exists "Admins can insert flats" on flats;
create policy "Admins can insert flats" on flats
  for insert with check (public.current_user_role() = 'admin');
drop policy if exists "Admins can update flats" on flats;
create policy "Admins can update flats" on flats
  for update using (public.current_user_role() = 'admin');
drop policy if exists "Admins can delete flats" on flats;
create policy "Admins can delete flats" on flats
  for delete using (public.current_user_role() = 'admin');

drop policy if exists "Admins can insert rooms" on rooms;
create policy "Admins can insert rooms" on rooms
  for insert with check (public.current_user_role() = 'admin');
drop policy if exists "Admins can update rooms" on rooms;
create policy "Admins can update rooms" on rooms
  for update using (public.current_user_role() = 'admin');
drop policy if exists "Admins can delete rooms" on rooms;
create policy "Admins can delete rooms" on rooms
  for delete using (public.current_user_role() = 'admin');

-- beds already had "Admins can update beds" (Phase 2b) — add insert/delete.
drop policy if exists "Admins can insert beds" on beds;
create policy "Admins can insert beds" on beds
  for insert with check (public.current_user_role() = 'admin');
drop policy if exists "Admins can delete beds" on beds;
create policy "Admins can delete beds" on beds
  for delete using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 3. Guardrails (brief: "reasonable guardrails, not exhaustive")
--
-- Both triggers below also transitively protect hostels/blocks/floors/
-- flats from being deleted out from under an occupied bed: ON DELETE
-- CASCADE fires BEFORE DELETE triggers on the cascaded-to child rows too,
-- so deleting a hostel that contains an occupied bed hits the bed guard
-- during the cascade and aborts the whole statement — no separate guard
-- needed on the four higher levels.
-- ---------------------------------------------------------------------------
create or replace function public.guard_bed_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'occupied' then
    raise exception 'Cannot delete an occupied bed — release the allocation first.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_guard_bed_delete on beds;
create trigger trg_guard_bed_delete
  before delete on beds
  for each row execute function public.guard_bed_delete();

create or replace function public.guard_room_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from beds where room_id = old.id and status = 'occupied') then
    raise exception 'Cannot delete a room that has occupied beds — release/reassign them first.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_guard_room_delete on rooms;
create trigger trg_guard_room_delete
  before delete on rooms
  for each row execute function public.guard_room_delete();

create or replace function public.guard_room_bed_capacity_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occupied_count int;
begin
  if new.bed_capacity < old.bed_capacity then
    select count(*) into v_occupied_count from beds where room_id = old.id and status = 'occupied';
    if new.bed_capacity < v_occupied_count then
      raise exception 'Cannot reduce bed capacity below % occupied bed(s) already in this room', v_occupied_count;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_room_bed_capacity_update on rooms;
create trigger trg_guard_room_bed_capacity_update
  before update on rooms
  for each row execute function public.guard_room_bed_capacity_update();

-- ============================================================================
-- admin_override_complaint() — the audit-safe way for admin to force a
-- status change or reassignment (brief item 4). Admin already has a raw
-- UPDATE policy on complaints (Phase 3, kept as an escape hatch), but a
-- raw UPDATE wouldn't append to complaint_updates — this RPC does both
-- atomically, same reasoning as add_complaint_update() in Phase 3, so the
-- timeline stays complete ("credible," per KB §11) even for admin actions.
-- ============================================================================
create or replace function public.admin_override_complaint(
  p_complaint_id uuid,
  p_status text default null,
  p_comment text default null,
  p_assigned_to text default null
)
returns complaint_updates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_update complaint_updates;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin only';
  end if;

  update complaints
  set status = coalesce(p_status, status),
      assigned_to = coalesce(p_assigned_to, assigned_to),
      escalated_at = case
        when p_status = 'escalated' and escalated_at is null then now()
        else escalated_at
      end
  where id = p_complaint_id;

  insert into complaint_updates (complaint_id, actor_id, action, comment, resulting_status)
  values (p_complaint_id, auth.uid(), 'admin_override', p_comment, p_status)
  returning * into v_update;

  return v_update;
end;
$$;

grant execute on function public.admin_override_complaint(uuid, text, text, text) to authenticated;

-- ============================================================================
-- No new SQL for the Dashboard's headline stats / breakdown charts.
-- Admin already has full read access to every table involved (profiles,
-- hostels/rooms/beds, hostel_applications, complaints, payment_records) —
-- this is pure read aggregation with no security logic beyond "must be
-- admin," which existing RLS already covers. At this prototype's scale,
-- fetching the raw rows and grouping them client-side (src/lib/
-- adminStats.js) is simpler than maintaining 6+ separate SQL aggregate
-- functions for the same result.
-- ============================================================================
