import { supabase } from './supabaseClient'

export async function fetchAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchAllStaffAssignments() {
  const { data, error } = await supabase
    .from('staff_hostel_assignments')
    .select('id, profile_id, hostel_id, hostels ( name )')
  if (error) throw error
  return data || []
}

// Keyed by student_id — used to show each student's current allocation in
// the user list without a separate query per row.
export async function fetchActiveAllocationsByStudent() {
  const { data, error } = await supabase
    .from('allocations')
    .select(
      `id, hostel_applications!inner ( student_id ),
      beds ( bed_label, rooms ( room_number, hostels ( name ) ) )`
    )
    .is('released_at', null)
  if (error) throw error

  const map = {}
  for (const row of data || []) {
    const studentId = row.hostel_applications?.student_id
    if (!studentId) continue
    map[studentId] = {
      hostelName: row.beds?.rooms?.hostels?.name,
      roomNumber: row.beds?.rooms?.room_number,
      bedLabel: row.beds?.bed_label,
    }
  }
  return map
}

export async function updateUserRole(profileId, newRole) {
  const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profileId)
  if (error) throw error
}

// Diffs against the current assignment rows and only inserts/deletes what
// changed, rather than clearing and re-inserting everything.
export async function setStaffHostelAssignments(profileId, hostelIds) {
  const { data: current, error: fetchError } = await supabase
    .from('staff_hostel_assignments')
    .select('id, hostel_id')
    .eq('profile_id', profileId)
  if (fetchError) throw fetchError

  const currentIds = new Set((current || []).map((r) => r.hostel_id))
  const desiredIds = new Set(hostelIds)

  const toAdd = hostelIds.filter((id) => !currentIds.has(id))
  const toRemove = (current || []).filter((r) => !desiredIds.has(r.hostel_id))

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('staff_hostel_assignments')
      .insert(toAdd.map((hostel_id) => ({ profile_id: profileId, hostel_id })))
    if (error) throw error
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('staff_hostel_assignments')
      .delete()
      .in(
        'id',
        toRemove.map((r) => r.id)
      )
    if (error) throw error
  }
}
