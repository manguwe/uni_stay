-- ============================================================================
-- Eden Hostel Portal — Phase 7 fix
-- Root cause of "Patron/Matron's Applications view shows less detail than
-- Admin's": hostel_applications' RLS was already correctly scoped by
-- hostel (Phase 6), but the EMBEDDED applicant profile
-- (profiles!hostel_applications_student_id_fkey(...)) has its own,
-- separate RLS check — and profiles only ever had "Users can view own
-- profile" and "Admins can view all profiles". Chairperson/patron_matron
-- had no policy letting them see an applicant's or complainant's profile
-- at all, so PostgREST silently nulled that embed rather than erroring.
-- Same root cause also explains blank student names on staff's complaint
-- cards and Payment Verification queue — one fix covers all three.
--
-- Run this AFTER the previous nav/dropdown fix batch, once. Idempotent.
-- ============================================================================

drop policy if exists "Staff can view relevant student profiles" on profiles;
create policy "Staff can view relevant student profiles" on profiles
  for select using (
    public.current_user_role() in ('chairperson', 'patron_matron')
    and (
      exists (
        select 1 from hostel_applications a
        where a.student_id = profiles.id and public.is_staff_for_hostel(a.hostel_id)
      )
      or exists (
        select 1 from complaints c
        where c.student_id = profiles.id and public.is_staff_for_hostel(c.hostel_id)
      )
    )
  );

-- Scope note: this exposes the full profile row (including email, gender,
-- year_of_study), not just the columns the UI happens to select today —
-- RLS is row-level, not column-level. That's intentional here: gender is
-- literally required for the allocation gender-match check and
-- year_of_study is an application priority factor, so hostel staff
-- reviewing their own hostel's applicants/complainants need this, the
-- same way admin already has it. It does NOT expose a student to staff
-- outside their assigned hostel, or expose any student who has neither
-- an application nor a complaint in that hostel.
