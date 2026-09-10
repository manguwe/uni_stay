-- ============================================================================
-- Diagnostic: gender-based hostel visibility appears to be showing every
-- hostel to a student. The RLS policy and its supporting function are
-- correct as written in phase6_patron_hostel_manager.sql (see the chat
-- response) — run these to find out which of the two likely causes below
-- actually applies to your database.
-- ============================================================================

-- 1. Does the policy actually exist right now? If this doesn't show
--    "Public read hostels" with a definition matching phase6's version,
--    the migration (or an even later one) rolled back or was never run —
--    the same class of issue as the earlier profiles/current_user_role()
--    bugs. Re-run phase6_patron_hostel_manager.sql if so.
select policyname, qual
from pg_policies
where tablename = 'hostels' and policyname = 'Public read hostels';

-- 2. What gender is your test student account actually set to? If this
--    is null, the policy is correctly showing them everything — that's
--    the "not set yet, don't hide everything" rule working as designed,
--    not a bug. Complete their profile (My Profile page, or update here
--    for a quick test) and re-check the Explorer.
select email, role, gender from profiles where role = 'student';

-- Quick way to set a specific test student's gender directly, if you'd
-- rather not go through the UI to test:
--
--   update profiles set gender = 'male'   -- or 'female'
--   where email = 'student@example.com';
--
-- Remember gender locks after first save (a separate fix from a few
-- turns back) — only re-run this if it's currently null.
