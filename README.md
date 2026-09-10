# Eden Hostel Portal — Phase 1 (Hostel Explorer)

Read-only Hostel Explorer prototype: hostel → block → floor → flat → room →
bed drill-down with bed-level color-coded availability, matching the
AcademiX portal's visual language. No applications, allocation, payments,
complaints, announcements, or admin dashboard yet — those are later phases.

## 1. Install dependencies

```bash
npm install
```

## 2. Set up Supabase

1. Create a free Supabase project at https://supabase.com (or use an
   existing one you've set aside for this project — keep it separate from
   the unrelated Campus Crib project, per the KB).
2. In your Supabase project, go to **SQL Editor → New query**, paste the
   entire contents of `supabase/schema.sql`, and run it. This creates the
   `hostels / blocks / floors / flats / rooms / beds` tables, enables Row
   Level Security with public-read policies, and seeds two fictional
   hostels with realistic bed statuses.
3. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

`.env.local` is already in `.gitignore` — never commit it, and never
hardcode these values in source (`src/lib/supabaseClient.js` reads them
from `import.meta.env` only).

## 4. Run it locally

```bash
npm run dev
```

Open http://localhost:5173 — you'll land on **Find a Room** under the
Accommodation section of the sidebar.

## 5. Try the demo flow

1. Pick a hostel (**New Hostel** or **Ruth Hostel**).
2. Drill down: Block → Floor → (Flat, where one exists) → Rooms.
   - Try **New Hostel → Block A → Floor 1** — rooms sit directly under the
     floor (no flat level), proving the flexible hierarchy from KB §6.
   - Try **New Hostel → Block A → Floor 2 → Flat 2 → Room 204** — this is
     the exact worked example from KB §6.
3. Click a room to see individual bed statuses, occupancy count, and
   facilities.
4. Use "Search by room number" at the top to jump straight to a room
   across both hostels.
5. Toggle "Show available rooms only" or filter by room type at the room
   grid level.

## Project structure

```
src/
  pages/HostelExplorer.jsx     — the explorer screen (Phase 1 scope)
  components/
    Layout.jsx, TopBar.jsx, Sidebar.jsx   — AcademiX-matching shell (KB §24)
    Breadcrumb.jsx                        — Hostel > Block > Floor > Flat trail
    RoomCard.jsx                          — room grid card, aggregate status
    RoomDetailPanel.jsx                   — bed-level detail view
    BedStatusBadge.jsx                    — 🟢🔴🟡⚫ status chip
  lib/
    supabaseClient.js   — Supabase client (env vars only)
    hierarchy.js         — drill-down queries, auto-skips empty levels
  styles/index.css       — Tailwind entry + AcademiX component classes
supabase/schema.sql       — tables, RLS policies, seed data
```

## Notes for later phases

- RLS currently only has public **SELECT** policies — there are
  deliberately no INSERT/UPDATE/DELETE policies yet, so nothing can be
  written from the client. Writes only happen via the SQL editor for now.
  Phase 2+ will add authenticated write policies scoped to role
  (student/chairperson/patron/admin) once auth is wired up.
- The hierarchy tables (`blocks/floors/flats/rooms`) all carry a required
  `hostel_id` plus nullable parent-level foreign keys, so a hostel can
  skip any intermediate level — the explorer's `findNextLevel()` helper
  in `src/lib/hierarchy.js` auto-detects and skips empty levels.
- Roommate names/contact info are intentionally **not** in this schema —
  per KB §9 that only becomes visible post-allocation, which is Phase 2+.

---

## Phase 2 — Applications & Allocation

Adds real Supabase Auth (student signup/login), an application form,
a student's own applications list, and an admin review queue with
allocate/waitlist/reject actions — including a server-side gender check
and a race-safe atomic allocation.

### 1. Run the Phase 2 SQL

In the Supabase SQL Editor, run `supabase/phase2_applications_and_allocation.sql`
**after** `supabase/schema.sql` (Phase 1). It adds:

- `profiles` (role, name, student number, programme, year, gender) with a
  trigger that auto-creates a bare `student` row on signup.
- `hostel_applications` and `allocations`, both with RLS: students only see
  their own rows, only admin can update/allocate.
- Two Postgres functions callable via `supabase.rpc()`:
  - `allocate_bed(application_id, bed_id, term)` — locks the bed row,
    re-checks it's still vacant (closes the two-admins-at-once race),
    checks the student's gender against the hostel's designation, then
    inserts the allocation and flips the bed atomically.
  - `release_bed(bed_id)` — admin-only "free this bed" action, used to
    demo waitlist promotion in this phase.
- A unique partial index so a bed (or application) can only have **one
  active allocation** at the database level, not just enforced in the UI.

### 2. Create a demo student and a demo admin

1. Run the app (`npm run dev`), go to **/signup**, and create two accounts
   — e.g. a student applying for the **male**-designated "New Hostel" and
   a second account you'll use as admin. Fill in real-looking profile
   fields (gender matters — it drives the gender-match check).
2. Promote the second account to admin: back in the SQL Editor, run

   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'admin@example.com');
   ```

   (There's no role-management UI yet — that's part of the Admin
   Dashboard, a later phase.)
3. Sign out and back in on that account to pick up the new role — the
   sidebar will show an **Admin → Review Queue** item once it's admin.

### 3. Checklist — click through the full apply → review → allocate flow

- [ ] **Apply from a bed:** as the student, go to Find a Room → drill into
      a room with a 🟢 vacant bed → click **Apply** next to that bed. The
      form should arrive pre-filled with that hostel/room/bed.
- [ ] Submit the application → see the confirmation screen → **My
      Applications** shows it as **Submitted**.
- [ ] **Admin allocates:** sign in as admin → **Review Queue** → the
      application appears, with student name/year/programme and the
      requested location. Click **Allocate bed** → the picker shows
      available beds (preferring the exact requested room) → confirm.
- [ ] Back as the student, **My Applications** now shows **Approved** with
      the allocated bed and term.
- [ ] Back in **Find a Room**, that bed now renders 🔴 occupied in the
      explorer grid.
- [ ] **Gender-mismatch case:** as the student, submit a second
      application targeting the *opposite*-gender hostel (e.g. a male
      profile applying to "Ruth Hostel"). As admin, try **Allocate bed** —
      confirming should fail with a clear "Gender mismatch…" error and no
      allocation is created.
- [ ] **Full-room case:** submit an application for a room where every bed
      is already occupied (e.g. Room 102 at Ruth Hostel, seeded fully
      occupied). As admin, open **Allocate bed** — it should report no
      beds available in that exact room and offer beds from the wider
      hostel instead (or nothing, if the whole hostel happens to be full);
      use **Waitlist** on this application instead and confirm it shows as
      **Waitlisted** in My Applications.
- [ ] **Waitlist promotion:** as admin, open a room with an occupied bed
      and a matching waitlisted application (e.g. the one just waitlisted)
      → click **Free bed** on an occupied bed in that room → the
      promotion prompt should list the waitlisted candidate → click
      **Promote & Allocate** → application flips to **Approved**, bed
      flips back to occupied.
- [ ] **Reject case:** submit a third application, reject it as admin with
      a reason → student's **My Applications** shows **Rejected** with
      that reason text.

---

## Phase 2b — Payment Status Tracking & Roommate Visibility

Adds payment status tracking (no in-app payment — students pay externally
and submit proof), private receipt uploads, admin verification, and
roommate visibility once payment is confirmed.

### 1. Run the Phase 2b SQL

In the Supabase SQL Editor, run `supabase/phase2b_payments_and_roommates.sql`
**after** `phase2_applications_and_allocation.sql`. It adds:

- `payment_records` (one row per allocation, auto-created by an updated
  `allocate_bed()`), with RLS + a trigger that stops a student from setting
  their own `amount_due`, verifying themselves, or resubmitting while a
  submission is already pending.
- A **private** `payment-receipts` Storage bucket — a student can only
  upload/read files under their own `{auth.uid()}/...` folder; admin can
  read all of them. Nothing is public.
- `default_amount_due()` and `payment_deadline_days()` — the two "flat
  constant" values called out in the brief. To change the prototype's fee
  or grace period, edit the single `select ...` line inside each function
  in `phase2b_payments_and_roommates.sql` and re-run that file (it's
  idempotent — safe to re-run any time).
- `my_active_room_id()` / `get_my_roommates()` — the roommate-visibility
  functions. See the long design-note comment above them in the SQL file
  for exactly why this is safe against a student querying tables directly
  instead of going through the UI.

### 2. Checklist

- [ ] **Submit payment as student:** with the allocated-student account
      from Phase 2, go to **Finance** → confirm the amount due and
      placeholder bank/mobile-money instructions render (no "pay" button
      anywhere) → enter a reference number, optionally attach a receipt
      image → submit → status flips to **Awaiting Verification**.
- [ ] **Verify as admin:** sign in as admin → **Payment Verification** →
      the submission appears under "Awaiting verification" with the
      student's name, room, reference number, and a "View receipt" link
      if one was attached (opens via a signed URL — the bucket is
      private, so this only works because the link is time-limited and
      generated server-side for an authorized viewer).
- [ ] Click **Confirm** → back as the student, **Finance** now shows
      **Confirmed** with the same reference/receipt as a read-only record.
- [ ] **Roommates appear:** as the confirmed student, go to **My
      Accommodation** → roommates (any other student with an active
      allocation to the same room) now show by name.
- [ ] **Roommates stay hidden — different student:** sign in as a
      *different* student with no allocation to that room (or no
      allocation at all) → their **My Accommodation** should show no
      roommate data for that room, confirming `get_my_roommates()` is
      correctly scoped to the caller's own confirmed room only.
- [ ] **Roommates stay hidden — before confirmation:** submit a payment
      for a second allocation but don't confirm it yet (or reject it) →
      that student's My Accommodation should say roommates aren't shown
      until payment is confirmed, even though they do have an active bed.
- [ ] **Rejection + resubmit:** as admin, reject a submitted payment with
      a reason → student's Finance shows the reason and the submission
      form again → resubmit → back to Awaiting Verification.
- [ ] **Overdue + release:** temporarily set `payment_deadline_days()` to
      `0` and re-run just that function's `create or replace` (or simply
      wait — for the prototype, `0` is the fast way to demo this) → an
      unpaid allocation now appears under "Overdue" in Payment
      Verification → click **Release bed** → bed flips back to vacant in
      the Explorer, and if a matching waitlisted application exists, the
      same promotion prompt from Phase 2 appears.
- [ ] **Explorer still name-free:** as any logged-in student, browse
      **Find a Room** into an occupied room — confirm it still only shows
      bed status (🟢🔴🟡⚫), never an occupant's name. Nothing in this
      phase touched Phase 1's hierarchy queries or the Explorer
      components, so this should be unaffected — this step is just to
      prove it.

---

## Phase 2c — Profile completion, gender lock, application form cleanup, roster

Fixes the gender-mismatch-shows-"unspecified" bug at its root (no
profile-completion gate existed), removes a field that the KB's own
Decisions Log had already ruled out, corrects roommate visibility to
trigger on allocation rather than payment, and adds the printable roster.

### 1. Run the Phase 2c SQL

Run `supabase/phase2c_profile_fixes_and_roster.sql` **after**
`phase2b_payments_and_roommates.sql`. It:
- Adds a trigger locking `profiles.gender` after the first time it's set
  (mirrors the existing role-lock trigger) — only admin can change it after.
- Updates `my_active_room_id()` to drop the `payment_records.status =
  'confirmed'` condition — roommates now show as soon as the allocation
  exists.
- Drops the unused `distance_from_home_km` column.

### 2. Backfilling existing test accounts

**No SQL needed.** Since gender only locks once it's already set, any
existing account with a `null` gender can just visit **My Profile**
(new sidebar item) once and fill it in — the field is still editable for
them at that point. If you'd rather bulk-set it directly for faster
testing across several accounts, this is fine too:

```sql
update profiles set full_name = 'Test Student', student_number = 'SIN0001',
  gender = 'male' -- or 'female'
where id = (select id from auth.users where email = 'student@example.com');
```

### 3. Root cause note

The actual reason gender ended up empty: `AuthContext.signUp()` filled in
the profile fields via a follow-up `UPDATE` right after
`supabase.auth.signUp()` — but if your Supabase project has email
confirmation turned on (the default for new projects), `signUp()` returns
a `user` with no active `session` until the confirmation link is clicked,
so that `UPDATE` ran unauthenticated and failed RLS silently. Fixed in
`AuthContext.jsx` to only attempt it when a session actually exists;
`Signup.jsx` now tells the student to check their email in that case
instead of quietly landing them on the Explorer looking signed-out. The
new **My Profile** gate is the safety net either way.

### 4. Checklist

- [ ] **Complete a profile as a new student:** sign up a fresh account →
      if you see "Check your email," either confirm it (if your project
      requires that) or disable email confirmation in Supabase Auth
      settings for faster prototype testing → sign in → go to **My
      Profile** → fill in student number + gender if not already set.
- [ ] **Gender lock:** save your profile once with a gender set → reload
      **My Profile** → the gender field now renders as read-only text
      with "contact admin to correct this," not an editable dropdown.
- [ ] **Apply gate:** as a student with an incomplete profile, click
      **Apply For A Room** in the sidebar → confirm you're redirected to
      **My Profile** with a banner explaining why, and that saving sends
      you straight to the application form afterward.
- [ ] **No more "unspecified":** submit an application to a hostel that
      doesn't match your profile's gender → as admin, try **Allocate
      bed** → the error should now say "student is male/female," never
      "unspecified."
- [ ] **Form cleanup:** open **Apply For A Room** — confirm there's no
      "Distance from home" field and no student-ID field. Check the
      admin **Review Queue** — confirm no distance value shows in an
      application's priority notes.
- [ ] **Roommates before payment:** get a student allocated (Phase 2
      flow) but do **not** submit/confirm payment yet → that student's
      **My Accommodation** should already show any roommates in the same
      room — no payment step required.
- [ ] **Roster:** as admin, open **Allocated Roster** → confirm every
      currently-allocated student appears with name/ID/programme/full
      location/payment status → try the hostel/block/floor/flat filters
      → click **Print** and confirm the sidebar/topbar disappear and the
      table prints as a plain, readable list.

---

## Phase 2d — Payment RLS fix + gender-based hostel visibility

### 1. Run the Phase 2d SQL

Run `supabase/phase2d_payment_rls_fix_and_gender_visibility.sql` **after**
`phase2c_profile_fixes_and_roster.sql`.

**Bug fix:** the `"Students can submit own payment proof"` UPDATE policy
had no explicit `WITH CHECK`, so Postgres silently reused the `USING`
clause for it — which tests `status in ('unpaid','rejected')`, correct for
deciding which *existing* row a student may touch, but wrong for the
*resulting* row, since the trigger always sets it to
`'awaiting_verification'`. Every legitimate submission failed RLS as a
result. Fixed with an explicit `WITH CHECK`. No frontend change was
needed — `submitPaymentProof()` was already doing an `UPDATE`, not an
`INSERT`.

**Final `payment_records` policies after this fix** (no INSERT policy
exists or is needed — the row is created by `allocate_bed()` via
`SECURITY DEFINER`, bypassing RLS entirely):

| Action | Policy | Who / condition |
|---|---|---|
| SELECT | "Students can view own payment records" | own record, via allocation → application → `student_id` |
| SELECT | "Admins can view all payment records" | `current_user_role() = 'admin'` |
| UPDATE | "Students can submit own payment proof" | `USING`: own record, status `unpaid`/`rejected`. `WITH CHECK`: still own record, resulting status must be `awaiting_verification` |
| UPDATE | "Admins can verify payment records" | `current_user_role() = 'admin'` (untouched — this condition never referenced row columns, so it was never affected by the missing-`WITH CHECK` bug) |

**Gender-based visibility:** enforced via RLS on `hostels` and, for
defense-in-depth, cascaded to `blocks`/`floors`/`flats`/`rooms`/`beds` too
(each via an `EXISTS` back to `hostels`), so a student can't see a
mismatched hostel's rooms/beds even via a direct REST call with a known
hostel id — not just hidden in the Explorer UI. **No frontend changes
were needed for this part** — `fetchHostels()` and friends already do a
plain `select *`; the filtering happens entirely server-side now, so
Apply For A Room's location dropdowns get the same correct filtering for
free.

### 2. Checklist

- [ ] **Payment submission works:** as an allocated student, go to
      **Finance** → submit a reference number → should now succeed and
      flip to **Awaiting Verification** with no RLS error.
- [ ] Confirm it shows up in admin's **Payment Verification** queue.
- [ ] **Male account:** sign in as (or create) a male-profile student →
      **Find a Room** → only male-designated and mixed hostels appear.
- [ ] **Female account:** same, only female-designated and mixed hostels
      appear.
- [ ] **No-gender account:** a student who hasn't completed their profile
      yet still sees every hostel (shouldn't be hidden just because
      gender is unset).
- [ ] **Admin unaffected:** sign in as admin → Explorer, Review Queue's
      Allocate modal, and Roster all still show/allow every hostel
      regardless of gender.

---

## Phase 3 — Complaint System

### 1. Run the Phase 3 SQL

Run `supabase/phase3_complaints.sql` **after**
`phase2d_payment_rls_fix_and_gender_visibility.sql`. It adds:

- `staff_hostel_assignments` — a join table (not a `hostel_id` column on
  `profiles`), so a chairperson/patron can cover more than one hostel
  without a later migration. See the SQL file's comment for the full
  reasoning.
- `complaints` and append-only `complaint_updates` — the latter has **no**
  INSERT/UPDATE/DELETE policy for anyone, including admin; every row is
  written by a `SECURITY DEFINER` trigger or RPC, which is what makes this
  genuinely append-only rather than append-only "by convention."
- The `add_complaint_update()` RPC — the single write path for
  chairperson/patron actions, validating role + hostel assignment + which
  actions each role may perform, then updating `complaints` and inserting
  the audit row atomically (same pattern as `allocate_bed()`).
- A private `complaint-photos` bucket, single-attachment `photo_path`
  column (not a separate attachments table — KB §11 says "optional photo
  attachment," singular; simplest fit for the prototype).

### 2. Assign a chairperson and a patron/matron for testing

No admin UI for this yet (reasonable Phase 5 scope). Run directly:

```sql
update profiles set role = 'chairperson'
where id = (select id from auth.users where email = 'chair@example.com');

insert into staff_hostel_assignments (profile_id, hostel_id)
values (
  (select id from auth.users where email = 'chair@example.com'),
  (select id from hostels where name = 'New Hostel')
)
on conflict do nothing;
```

Repeat with `role = 'patron_matron'` for a second test account, assigned
to the same hostel so the escalation handoff can be tested end to end.

### 3. Checklist

- [ ] **Submit as student:** go to **Complaints** → **New Complaint** →
      location fields are pre-filled from your active allocation (if you
      have one) but editable → pick a category, description, optional
      photo → submit → **My Complaints** shows it as **Submitted** with a
      one-entry timeline.
- [ ] **Chairperson reviews:** sign in as the chairperson account →
      **Complaints Dashboard** → the new complaint appears under "New" →
      expand it → **Mark Under Review** → **Escalate to Patron/Matron**
      (add an optional comment) → status flips to **Escalated**.
- [ ] **Different-hostel chairperson can't see it:** if you have a second
      chairperson assigned to a different hostel, confirm their dashboard
      does **not** show this complaint at all.
- [ ] **Patron picks it up:** sign in as patron/matron → **Complaints
      Dashboard** → the escalated complaint appears under "Active" →
      **Assign** (enter a maintenance contact name) → add a comment →
      **Resolve** with a required closing comment.
- [ ] **Full timeline visible throughout:** as the original student,
      reopen **My Complaints** → expand the complaint → confirm every
      step appears in order: Submitted → Marked under review → Escalated
      → Assigned → Resolved, each with the right actor name and comment.
- [ ] **Admin read-only view:** sign in as admin → **All Complaints** →
      the complaint appears with its full timeline; confirm there are no
      action buttons (Phase 5 scope).
- [ ] **Patron can't jump the queue:** submit a second complaint as a
      student and do **not** escalate it as chairperson — confirm it
      never appears on the patron/matron dashboard at all, proving
      `escalated_at` (not just status) is what gates their visibility.

---

## Role-based landing routing (KB §8a)

`"/"` now dispatches by role immediately after login, instead of sending
everyone to the student Explorer: admin → Review Queue, chairperson →
their dashboard, patron/matron → their dashboard, student → the
profile-completion gate if incomplete, otherwise the Explorer. Logged-out
visitors still land on the public Explorer (browsing needs no login, KB
§7). See `src/pages/RoleLanding.jsx`.

If you're testing a chairperson/patron_matron account and hit "You are
not assigned to this hostel," that's `is_staff_for_hostel()` correctly
failing closed — it almost always means the `staff_hostel_assignments`
row is simply missing for that account. Run
`supabase/verify_staff_assignments.sql` to check and fix it; no schema
change is needed, `profiles` has never had a hostel column of any kind.

### Checklist

- [ ] **Fresh student signup:** sign up a new account → confirm you land
      on **My Profile** with the completion banner (no hostel field
      anywhere on that form) → save → confirm you land on **Find a
      Room**, not back on Profile.
- [ ] **Chairperson goes straight to their dashboard:** sign in as a
      chairperson account → confirm you land directly on **Complaints
      Dashboard**, not the Explorer, and were never asked for student
      ID/gender.
- [ ] **Patron/matron and admin the same:** same check for each — direct
      to their own area, no gate.
- [ ] **Assignment bug resolved:** after confirming (and fixing if
      needed) the `staff_hostel_assignments` row via the verification
      SQL, confirm the chairperson/patron dashboard now loads without
      the "not assigned" error.

---

## Phase 4 — Administration Dashboard & Inventory Management

### 1. Run the Phase 4 SQL

Run `supabase/phase4_admin_dashboard_and_inventory.sql` **after** the
role-based-onboarding fix. It:

- Adds `"Admins can update any profile"` — a genuine gap found while
  verifying (not just a naming issue): only `auth.uid() = id` existed
  before, so the new User Management role-assignment UI would have
  silently failed without this.
- Adds admin `INSERT`/`UPDATE`/`DELETE` on `hostels`/`blocks`/`floors`/
  `flats`/`rooms`, and `INSERT`/`DELETE` on `beds` (`UPDATE` already
  existed from Phase 2b) — none of this existed before this phase.
- Adds two delete guardrails (occupied bed, room with an occupied bed)
  and a bed-capacity-reduction guardrail — all three surface their error
  message verbatim in the Inventory UI.
- Adds `admin_override_complaint()` — keeps the complaint audit trail
  intact even when admin forces a status change, instead of a raw
  `UPDATE` that would silently skip logging.
- **No new SQL for the dashboard's stats/charts** — admin already has
  full read access everywhere needed; aggregation happens client-side in
  `src/lib/adminStats.js`. See the note at the end of the SQL file.

### 2. On `assigned_hostel_id`

The brief mentioned this column name for role assignment — it doesn't
exist and was never part of the schema. Staff assignment has been the
`staff_hostel_assignments` join table since Phase 3 (a chairperson/patron
can cover more than one hostel). The new User Management UI writes to
that table, not a column — confirmed this before writing any code so
nothing gets fragmented into two competing designs.

### 3. Checklist

- [ ] **Dashboard stats match reality:** open **Dashboard** → pick one
      number (e.g. "Occupied beds") → cross-check it manually (e.g. count
      🔴 beds in the Explorer for both hostels) → confirm they match.
- [ ] **Create through Inventory, see it in the Explorer:** as admin, go
      to **Inventory** → add a new hostel (or open an existing one) → add
      a room → add a bed → switch to **Find a Room** as a student →
      confirm the new room/bed appears with the correct status color.
- [ ] **Guardrails fire correctly:** try to delete an occupied bed, or a
      room containing one, or reduce a room's bed capacity below its
      occupied count → confirm each is rejected with a clear message, not
      a silent failure or a generic error.
- [ ] **Promote a chairperson through the UI, not SQL:** go to **User
      Management** → edit a student's role to Chairperson → check the
      hostel(s) they should cover → save → sign in as that account →
      confirm their **Complaints Dashboard** loads correctly with no "not
      assigned to this hostel" error.
- [ ] **All Applications / All Complaints oversight:** confirm **All
      Applications** shows every status (not just pending) and the filter
      works; confirm **All Complaints**' admin override changes a
      complaint's status and the change appears in its timeline as
      "Admin override," not silently.
- [ ] **Roster still linked:** confirm **Allocated Roster** is reachable
      from the admin sidebar (unchanged from the earlier fix batch).

---

## Font fix (Inter, not Poppins/Nunito)

This was a genuine bug from Phase 1, not style drift: the app loaded
Poppins/Nunito, directly contradicting KB §24's typography note from the
very first message. Fixed in exactly two places —
`tailwind.config.js`'s `fontFamily.sans` and the Google Fonts `<link>` in
`index.html` — plus heading weight corrected from `font-semibold` (600) to
`font-bold` (700) in `src/styles/index.css` to match "bold weight for
headings, regular for body." A search across every component found zero
hardcoded font-family overrides, so a future font change really is a
one-line edit to `tailwind.config.js` — confirmed, not assumed.

- [ ] **Font checklist:** open at least 3 different screens (e.g. Login,
      Hostel Explorer, Admin Dashboard) → confirm text visibly reads as
      Inter, not the previous rounder Poppins look, on both headings and
      body text.

---

## Phase 5 — Communication

### 1. Run the Phase 5 SQL

Run `supabase/phase5_communication.sql` **after**
`phase4_admin_dashboard_and_inventory.sql`. It adds `announcements` (scope
enforced via RLS using the existing `is_staff_for_hostel()` — no
`assigned_hostel_id` column was introduced, same as Phase 4) and
`notifications` (written only by triggers on application/complaint/payment
status changes — no client can insert one directly).

### 2. Maintenance Requests — no new table

Every field the brief asked for (location, assigned person, status,
resolution notes) already exists on `complaints`/`complaint_updates` from
Phase 3. A separate table would duplicate all of it and need to stay in
sync forever. Instead, both staff dashboards now have a category filter —
picking "Maintenance" turns the existing dashboard into a maintenance
work-order view over the same data, with `assigned_to` and the resolved
comment serving as "assigned person" and "resolution notes."

### 3. Checklist

- [ ] **Font check** — see above.
- [ ] **All-students announcement:** as admin, go to **Post Announcement**
      → leave Hostel blank → post → sign in as any student → confirm it
      appears in **Announcements**.
- [ ] **Hostel-scoped announcement doesn't leak:** as admin (or a
      chairperson/patron assigned to one hostel), post an announcement
      scoped to a specific hostel → confirm a student allocated to a
      *different* hostel does **not** see it, while a student in the
      correct hostel does.
- [ ] **Notification on application status change:** as admin, allocate or
      reject a pending application → sign in as that student → confirm
      the bell shows an unread badge and the dropdown lists the status
      change, linking to My Applications.
- [ ] **Notification on complaint/payment updates:** repeat for a
      complaint status change (chairperson resolves it) and a payment
      confirmation — both should produce a bell notification for the
      right student, but the initial complaint *submission* itself should
      **not** notify the student who just submitted it (that would be
      notifying yourself about your own action).
- [ ] **Maintenance lens:** as chairperson or patron/matron, filter the
      dashboard to "Maintenance" → confirm only maintenance-category
      complaints show, with assigned-to and resolution notes visible
      exactly as before — nothing new to configure, just a filtered view.

---

## Admin announcement visibility + Patron/Matron RBAC restructure

### 1. On the announcement-visibility "bug"

Checked before changing anything: the RLS policy for admin
(`"Admins can view all announcements"`) was already unconditional — no
allocation dependency — and `CreateAnnouncement.jsx`'s list already calls
plain `fetchAnnouncements()` with no client-side filter. So the specific
theory (admin's feed filtered by allocation) doesn't match the code as
written. Two real possibilities: either that policy never actually landed
in your live database (the same transaction-rollback class of issue as
the earlier profiles bug), or admin simply had no *dedicated, discoverable*
view — only the creation page's list at the bottom. Run the diagnostic
query at the top of `phase6_patron_hostel_manager.sql` to check which.
Either way, the requested dedicated **All Announcements** page is built
now, mirroring All Complaints exactly.

### 2. Run the Phase 6 SQL

Run `supabase/phase6_patron_hostel_manager.sql` **after**
`phase5_communication.sql`. Same `assigned_hostel_id` correction as every
prior phase — reused `staff_hostel_assignments`/`is_staff_for_hostel()`,
no new column. It:

- Broadens `allocate_bed()` and `release_bed()` to admin OR the hostel's
  assigned patron/matron — gender-match enforcement and the race-safe row
  lock are byte-for-byte unchanged, only *who may call this* changed.
- **Fixes a bug that would have been invisible until tested**: the
  `guard_payment_record_update()` trigger only ever exempted `'admin'`
  from its restrictions — without updating it, a patron/matron's confirm/
  reject action would have been silently forced through the
  student-only branch and rejected. Found by tracing every admin-only
  gate in the system before writing any new policy, not by trial and error.
- Adds patron-scoped `SELECT`/`UPDATE` on `hostel_applications`,
  `allocations`, `payment_records`, and a scoped `SELECT` on the
  `payment-receipts` storage bucket.
- **Tightens `hostels`/`blocks`/`floors`/`flats`/`rooms`/`beds`
  visibility.** Reusing the admin screens means they now embed
  `hostels(name)`/`rooms(room_number)` for a patron/matron caller, and
  PostgREST enforces each embedded table's *own* RLS independently. The
  old policies had a blanket "gender not set → show everything" branch
  meant for incomplete student profiles — but staff accounts almost
  always have `gender = null` too (it's a student-only field), which
  would have accidentally shown a patron every hostel, not just their
  own. Rewritten so each role's rule is explicit instead of relying on
  that side effect.

### 3. What was reused vs. newly built

`ReviewQueue.jsx` and `PaymentVerificationQueue.jsx` are mounted
**completely unchanged** at both `/admin/...` and `/patron/...` — verified
neither file contains any `isAdmin` check or hardcoded `/admin/` link
before reusing them, so the only work was the RLS/RPC broadening above.
New: `PatronHub.jsx` (a stats + quick-links landing, same pattern as Admin
Dashboard) and `AllAnnouncements.jsx`.

### 4. Checklist

- [ ] **Admin sees patron-created announcements:** as patron/matron, post
      an announcement → sign in as admin → **All Announcements** → confirm
      it appears, correctly labeled with its scope.
- [ ] **Patron/matron full dashboard:** sign in as patron/matron → land on
      **Patron/Matron Dashboard** → confirm all four stat cards load with
      real numbers and each links through to a working screen.
- [ ] **Scoped correctly:** as that patron/matron, confirm **Applications**
      and **Payment Verification** show only rows for their assigned
      hostel — no other hostel's applications/payments appear, and
      attempting the same actions (allocate, confirm payment) works
      exactly as it did for admin, with gender/capacity rules still fully
      enforced.
- [ ] **Cannot act on a different hostel:** if you have a second hostel
      with no patron/matron assigned (or assigned to someone else),
      confirm this account sees nothing for it anywhere.
- [ ] **Admin retains everything:** confirm admin's own Review Queue,
      Payment Verification, and every other admin screen still show
      full cross-hostel data, unaffected.

---

## Fix batch: 404 on refresh, mobile nav, sticky sidebar, back navigation

All four were confirmed against the actual source before changing
anything (exact file/line matched the report in every case).

### 1. `vercel.json`

Added at the project root with the SPA rewrite rule. This only takes
effect on redeploy — nothing to run locally to test it, just verify
after your next Vercel deploy.

### 2 & 3. Mobile drawer + sticky sidebar

`Layout.jsx` now owns the open/closed state and passes it down —
`TopBar`'s hamburger button had genuinely no `onClick` at all before this
(confirmed by reading the file, not assumed). `Sidebar.jsx` now renders
two things: the same always-visible desktop `<aside>` (now `sticky
top-16 h-[calc(100vh-4rem)] overflow-y-auto` instead of a plain
`min-h-`, so it stays put while the page scrolls) and, only in the DOM
while `open` is true, a `fixed` mobile drawer with a dark overlay.
Tapping a nav link or the overlay closes it via the same `onClose`.

### 4. Back button

New `src/components/BackButton.jsx` (`useNavigate(-1)`, styled to match
the design system, `print:hidden` built in so it never shows up on the
Roster printout). Added to 9 screens — every genuine drill-down from a
dashboard/list that didn't already have a breadcrumb doing this job:
`SubmitComplaint`, `ReviewQueue` (covers both `/admin/applications` and
`/patron/applications` — same component, mounted twice),
`PaymentVerificationQueue` (same, both admin and patron routes),
`AllApplications`, `AllComplaints`, `AllAnnouncements`, `Roster`,
`UserManagement`, `Finance`.

**Deliberately skipped:** `ChairpersonDashboard`/`PatronDashboard`
(complaints) and `CreateAnnouncement` — these are top-level landing
destinations reached directly from the sidebar or `RoleLanding`, not
drill-downs from another in-app screen, so a "back" affordance there
wouldn't have a sensible destination. `Inventory.jsx` already has its own
breadcrumb ("← All hostels") and was correctly left alone, matching the
report's own list of exceptions.

### Checklist

- [ ] **404 fix:** after redeploying to Vercel, hard-refresh on a
      non-home route (e.g. `/accommodation/explore`) → confirm it loads
      instead of 404ing.
- [ ] **Mobile drawer:** at a mobile-width viewport, tap the hamburger →
      confirm a real drawer slides in with a dark overlay behind it → tap
      a nav item → confirm it navigates AND closes the drawer → reopen
      and tap the overlay → confirm it closes without navigating.
- [ ] **Sticky sidebar:** open the Admin Dashboard (tall enough to
      scroll) → scroll down → confirm the sidebar stays visible the
      whole time.
- [ ] **Back buttons:** confirm at least 3 of the 9 listed screens now
      show a working "← Back" that returns to wherever you came from.

---

## Fix batch: leaked copy, patron applications, sidebar clutter, dropdowns

(Chairperson's "not assigned to this hostel" recurrence — deferred per
request, not addressed in this batch.)

### 1. Leaked developer language — every string changed

| File | Before | After |
|---|---|---|
| `admin/UserManagement.jsx` | "Change roles and hostel assignments — this replaces the manual SQL promotion process used in earlier phases." | "Manage user roles and hostel assignments for staff accounts." |
| `admin/AllComplaints.jsx` | "...still appends to the complaint's timeline (via `admin_override_complaint()`), so the audit trail stays complete even for admin actions." | "Admin actions are still recorded in the complaint's history, so nothing is lost." |
| `Profile.jsx` | "...matches you to the correct gender-designated hostel (KB §8a)." | "...matches you to the correct gender-designated hostel." |
| `SubmitComplaint.jsx` | "Goes to your hostel's chairperson first, per the escalation path (KB §11)." | "Goes to your hostel's chairperson first for review." |
| `ApplyForRoom.jsx` | "...see KB §4, this doesn't book the bed for you directly." | "...this doesn't book the bed for you directly." |
| `admin/EditUserModal.jsx` | "...see staff_hostel_assignments in the Phase 3 SQL for why this is a join table, not a single column." | "A chairperson/patron can be assigned to more than one hostel." |

Audited every page subtitle, empty state, tooltip, and helper string
against the pattern list (function/table names, "Phase N," "KB §," SQL,
migrations) — these 6 were the only actual matches. Everything else that
matched the search terms was in a `//` code comment, which is never
rendered to a user, so left as-is.

### 2. (Skipped per request)

### 3. Patron/Matron Applications — root cause found and fixed

The application data was **already correctly filtered by hostel** (Phase
6's RLS). The bug was one level deeper: `hostel_applications`' query
embeds the applicant's profile
(`profiles!hostel_applications_student_id_fkey(...)`), and PostgREST
enforces that embedded table's RLS independently of the parent row.
`profiles` only ever had `"Users can view own profile"` and `"Admins can
view all profiles"` — no policy let chairperson/patron_matron see an
applicant's profile at all, so the embed silently returned null instead
of erroring. Patron's Review Queue cards were rendering with blank name/
student ID/gender while the applications themselves were already there —
exactly matching "less detail than Admin's." One new policy
(`supabase/phase7_staff_visibility_fix.sql`) fixes this for Applications,
Payment Verification, and complaint cards simultaneously, since all three
embed profiles the same way. The component reuse itself was already
correct — `ReviewQueue.jsx` is the literal same component/file at both
`/admin/applications` and `/patron/applications`, confirmed unchanged.

### 4. Sidebar — student nav gated by role

```diff
  <NavGroup title="Main" items={MAIN_ITEMS} onNavigate={onNavigate} />
- <NavGroup title="Accommodation" items={ACCOMMODATION_ITEMS} onNavigate={onNavigate} />
+ {(!profile || profile.role === 'student') && (
+   <NavGroup title="Accommodation" items={ACCOMMODATION_ITEMS} onNavigate={onNavigate} />
+ )}
```

`!profile` (not just `role === 'student'`) keeps anonymous browsing
working — KB §7 allows exploring hostels without logging in, and an
anonymous visitor has no profile row at all.

### 5. Dropdown fixes

- New `src/hooks/useClickOutside.js` — one hook, used by both
  `NotificationBell.jsx` and `TopBar.jsx`'s avatar menu.
- Notification dropdown width changed from a fixed `w-80` (320px, could
  push past the left edge of a narrow phone since the bell isn't the
  rightmost element in the bar) to `w-[min(20rem,calc(100vw-2rem))]` —
  never wider than the viewport minus a small margin, capped at 320px on
  larger screens. Added `break-words` to the message text as well.

### Checklist

- [ ] **Patron applications:** as patron/matron, open **Applications** →
      confirm full applicant name/student ID/programme/gender now show,
      and Allocate/Waitlist/Reject all work exactly as they do for admin.
- [ ] **Student nav unaffected:** sign in as a student → confirm the full
      Accommodation group (Find a Room, Apply, My Applications, etc.)
      still shows.
- [ ] **Staff nav decluttered:** sign in as chairperson, patron/matron,
      and admin → confirm none of them see "Apply For A Room" or the
      rest of the student group.
- [ ] **Dropdowns:** open the notification bell and the avatar menu →
      confirm each closes when you click anywhere outside it → at a
      narrow mobile width, open the notification dropdown → confirm it
      stays fully on-screen with readable, wrapped text.

---

## Full validation + Student Directory + notification dropdown re-check

### Item 4 investigation (read this first)

Checked both hypotheses against the actual code before writing anything:
`App.jsx` imports `Layout` exactly once, wrapping the whole `<Routes>` —
every role shares the identical `TopBar`/`NotificationBell` instance,
confirmed architecturally, not assumed. The only role-conditional code
near these components is an unrelated "Admin" text label inside the
*avatar* dropdown's own content — nothing touches `NotificationBell`'s
structure or positioning. **I could not find a code-level bug specific
to Admin/Chairperson.** Most likely explanation: a stale cached build in
whichever session tested those accounts — try a hard refresh first. I did
harden one minor, real technical detail regardless: `100vw` includes the
scrollbar's width on some browsers, so a long scrolling page (Admin
Dashboard) can compute a very slightly larger safe-width than a short
page — bumped the margin from `2rem` to `3rem` defensively. If it's still
cut off after a hard refresh, that's a different bug and I'd want a fresh
screenshot rather than guess further.

### 1–2. New profile fields + full validation

Run `supabase/phase8_directory_and_validation.sql` — adds `id_document_type`
(`'nrc'`/`'passport'`), `id_document_number`, `phone_number` to `profiles`.
No new RLS needed: the existing staff-visibility policy already covers
these columns (RLS is row-level, not column-level) for any student who
has an application in the staff member's assigned hostel — verified this
before assuming a gap existed.

New `src/lib/validators.js` — one function per field (name, student
number, email, NRC, passport, phone), each returning `null` or an error
string. New shared `IdDocumentField.jsx` (NRC/Passport type toggle +
input) used by both `Signup.jsx` and `Profile.jsx`, so the two forms
can't drift out of sync. `Profile.jsx` now exports `isProfileComplete()`
as the single source of truth for what counts as a complete profile —
`ProtectedRoute.jsx`'s `RequireCompleteProfile` guard imports it directly
instead of duplicating the check, so adding the two new required fields
only needed to happen in one place.

### 3. Student Directory

New `src/pages/patron/StudentDirectory.jsx` at `/patron/directory`,
using a new `fetchStudentDirectory()` in `roster.js` — scoped to the
caller's assigned hostel(s) entirely through existing RLS (Phase 6's
allocations policy + Phase 7's staff-visibility policy), no new SQL.
Admin's existing roster extended in place with NRC/Passport and Phone
columns rather than a separate screen, per the brief.

**Judgment call, flagged:** "confirmed allocation" — interpreted as "an
active, unreleased allocation exists," not "payment confirmed," for
consistency with the same phrase being explicitly corrected to mean this
elsewhere in the build (roommate visibility, several fixes back). Happy
to change if you meant payment-confirmed specifically.

### Checklist

- [ ] **Validation:** on Signup or Profile, try a 9-digit student ID, a
      malformed NRC (e.g. missing the slashes), and a bad phone number →
      confirm each shows its own inline error next to the right field,
      not a generic message.
- [ ] **Valid save:** fill in all fields correctly, including NRC/Passport
      and phone → confirm it saves without error.
- [ ] **Student Directory scoping:** as patron/matron, open **Student
      Directory** → confirm only your assigned hostel's allocated
      students appear, with NRC/Passport, phone, and full location.
- [ ] **Roster columns:** as admin, open **Allocated Roster** → confirm
      NRC/Passport and Phone columns now appear alongside the existing
      ones.
- [ ] **Notification dropdown:** hard-refresh an Admin and a Chairperson
      session → confirm the dropdown now displays correctly. If not,
      send a fresh screenshot — per the investigation above, this isn't
      explained by anything findable in the code.

