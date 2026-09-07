-- ============================================================================
-- Diagnostic: confirm what's actually assigned right now
-- ============================================================================
select email, role from profiles where role in ('chairperson', 'patron_matron');

select sha.*, h.name as hostel_name, p.email, p.role
from staff_hostel_assignments sha
join hostels h on h.id = sha.hostel_id
join profiles p on p.id = sha.profile_id
order by p.email;

-- If a chairperson/patron_matron email above has NO matching row in the
-- second query, that's the entire bug — not a schema problem, just a
-- missing assignment. Fix with:

insert into staff_hostel_assignments (profile_id, hostel_id)
values (
  (select id from profiles where email = 'chair@example.com'),
  (select id from hostels where name = 'New Hostel')
)
on conflict do nothing;

-- Repeat for your patron_matron test account and whichever hostel they
-- should cover. Re-run the second diagnostic query above afterward to
-- confirm the row now exists before retrying anything in the app.
