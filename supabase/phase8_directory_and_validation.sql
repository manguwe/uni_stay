-- ============================================================================
-- Eden Hostel Portal — Phase 8 migration
-- New profile fields: NRC/Passport (student picks which type) and phone
-- number, per KB §8a/§8b. Feeds the new Student Directory (Patron/Matron)
-- and extends the admin roster.
--
-- Run this AFTER the previous fix batch, once. Idempotent.
-- ============================================================================

alter table profiles add column if not exists id_document_type text
  check (id_document_type in ('nrc', 'passport'));
alter table profiles add column if not exists id_document_number text;
alter table profiles add column if not exists phone_number text;

-- No new RLS needed here. Student Directory visibility (item 3) already
-- works via the profiles policy from the earlier staff-visibility fix
-- ("Staff can view relevant student profiles"): it grants
-- chairperson/patron_matron visibility into any student who has a
-- hostel_applications row in their assigned hostel, and every allocated
-- student necessarily has one (allocations always originate from an
-- approved application, and AllocateBedModal only ever searches beds
-- within that same application's hostel_id — never a different one) —
-- so the existing policy already covers the newly-added columns too,
-- since RLS is row-level, not column-level. Verified this before writing
-- any new policy rather than assuming a gap existed.
