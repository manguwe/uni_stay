import { supabase } from './supabaseClient'

export async function submitApplication(studentId, payload) {
  const { data, error } = await supabase
    .from('hostel_applications')
    .insert({
      student_id: studentId,
      hostel_id: payload.hostelId,
      block_id: payload.blockId || null,
      floor_id: payload.floorId || null,
      flat_id: payload.flatId || null,
      room_id: payload.roomId || null,
      preferred_bed_id: payload.bedId || null,
      year_of_study: payload.yearOfStudy || null,
      new_intake: !!payload.newIntake,
      medical_needs: payload.medicalNeeds || null,
      notes: payload.notes || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function fetchMyApplications(studentId) {
  const { data, error } = await supabase
    .from('hostel_applications')
    .select(
      `*,
      hostels(name),
      rooms(room_number),
      allocations(id, bed_id, term, allocated_at, released_at, beds(bed_label))`
    )
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Pending = still awaiting a decision. 'under_review' is an optional
// intermediate state admin can set while looking at an application; the
// queue treats submitted + under_review the same way for display.
export async function fetchAllApplicationsAdmin(statusFilter = null) {
  let query = supabase
    .from('hostel_applications')
    .select(
      `*,
      profiles!hostel_applications_student_id_fkey(full_name, student_number, programme, gender),
      hostels(name, gender),
      blocks(name), floors(name), flats(name), rooms(room_number, bed_capacity),
      beds!hostel_applications_preferred_bed_id_fkey(bed_label, status)`
    )
    .order('submitted_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function fetchPendingApplications() {
  const { data, error } = await supabase
    .from('hostel_applications')
    .select(
      `*,
      profiles!hostel_applications_student_id_fkey(full_name, student_number, programme, gender),
      hostels(name, gender),
      blocks(name), floors(name), flats(name), rooms(room_number, bed_capacity),
      beds!hostel_applications_preferred_bed_id_fkey(bed_label, status)`
    )
    .in('status', ['submitted', 'under_review'])
    .order('submitted_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function markUnderReview(applicationId) {
  const { error } = await supabase
    .from('hostel_applications')
    .update({ status: 'under_review' })
    .eq('id', applicationId)
  if (error) throw error
}

export async function waitlistApplication(applicationId, priorityRank = null) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('hostel_applications')
    .update({
      status: 'waitlisted',
      priority_rank: priorityRank,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id,
    })
    .eq('id', applicationId)
  if (error) throw error
}

export async function rejectApplication(applicationId, reason) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('hostel_applications')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id,
    })
    .eq('id', applicationId)
  if (error) throw error
}

// Atomic on the server: locks the bed row, re-checks availability, checks
// gender match, inserts the allocation, flips the bed, approves the
// application — see allocate_bed() in the Phase 2 SQL for why this has to
// be one RPC rather than several client-side calls (race + enforcement).
export async function allocateBed({ applicationId, bedId, term = 'Current Term' }) {
  const { data, error } = await supabase.rpc('allocate_bed', {
    p_application_id: applicationId,
    p_bed_id: bedId,
    p_term: term,
  })
  if (error) throw error
  return data
}

export async function releaseBed(bedId) {
  const { error } = await supabase.rpc('release_bed', { p_bed_id: bedId })
  if (error) throw error
}

// Bed picker for the Allocate modal: available beds in the student's
// requested room/flat/floor/block/hostel, falling back up the hierarchy
// if their exact request has nothing free.
export async function fetchAvailableBedsForApplication(application) {
  // Ordered from most specific to least — the first scope with any vacant
  // bed wins, so an exact room match is preferred but a floor/hostel-wide
  // fallback is available if the student's original pick is now taken.
  const scopes = []
  if (application.room_id) {
    scopes.push({ label: 'room', roomFilters: { id: application.room_id } })
  }
  if (application.flat_id) {
    scopes.push({
      label: 'flat',
      roomFilters: { hostel_id: application.hostel_id, flat_id: application.flat_id },
    })
  }
  if (application.floor_id) {
    scopes.push({
      label: 'floor',
      roomFilters: { hostel_id: application.hostel_id, floor_id: application.floor_id },
    })
  }
  if (application.block_id) {
    scopes.push({
      label: 'block',
      roomFilters: { hostel_id: application.hostel_id, block_id: application.block_id },
    })
  }
  scopes.push({ label: 'hostel', roomFilters: { hostel_id: application.hostel_id } })

  for (const scope of scopes) {
    let roomsQuery = supabase.from('rooms').select('id, room_number, bed_capacity')
    for (const [column, value] of Object.entries(scope.roomFilters)) {
      roomsQuery = roomsQuery.eq(column, value)
    }

    const { data: rooms, error: roomsError } = await roomsQuery
    if (roomsError) throw roomsError
    if (!rooms || rooms.length === 0) continue

    const { data: beds, error: bedsError } = await supabase
      .from('beds')
      .select('*, rooms(room_number)')
      .in(
        'room_id',
        rooms.map((r) => r.id)
      )
      .eq('status', 'vacant')
      .order('bed_label')

    if (bedsError) throw bedsError
    if (beds && beds.length > 0) {
      return { beds, matchedScope: scope.label }
    }
  }

  return { beds: [], matchedScope: null }
}

// Waitlisted applications that could plausibly take a bed just freed in
// `room`. Prototype-simple: match by hostel + (no specific room requested,
// or this exact room), most specific/oldest first. Admin makes the final
// call — this is a candidate list, not an automatic assignment.
export async function fetchWaitlistCandidatesForRoom(room) {
  const { data, error } = await supabase
    .from('hostel_applications')
    .select(
      `*, profiles!hostel_applications_student_id_fkey(full_name, student_number, gender)`
    )
    .eq('status', 'waitlisted')
    .eq('hostel_id', room.hostel_id)
    .or(`room_id.eq.${room.id},room_id.is.null`)
    .order('priority_rank', { ascending: true, nullsFirst: false })
    .order('submitted_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function fetchAdminStats() {
  const [{ count: occupiedBeds }, { count: pendingApplications }] = await Promise.all([
    supabase.from('beds').select('id', { count: 'exact', head: true }).eq('status', 'occupied'),
    supabase
      .from('hostel_applications')
      .select('id', { count: 'exact', head: true })
      .in('status', ['submitted', 'under_review']),
  ])
  return { occupiedBeds: occupiedBeds || 0, pendingApplications: pendingApplications || 0 }
}
