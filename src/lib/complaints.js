import { supabase } from './supabaseClient'

export const COMPLAINT_CATEGORIES = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'water', label: 'Water' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'security', label: 'Security' },
  { value: 'noise', label: 'Noise' },
  { value: 'roommate_issue', label: 'Roommate issue' },
  { value: 'accommodation_issue', label: 'Accommodation issue' },
  { value: 'welfare', label: 'Welfare' },
  { value: 'other', label: 'Other' },
]

const COMPLAINT_SELECT = `*,
  hostels ( name ),
  rooms ( room_number ),
  complaint_updates ( id, actor_id, action, comment, resulting_status, created_at,
    profiles!complaint_updates_actor_id_fkey ( full_name ) )`

function sortTimeline(complaint) {
  return {
    ...complaint,
    complaint_updates: [...(complaint.complaint_updates || [])].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    ),
  }
}

// ---------------------------------------------------------------------------
// Student-facing
// ---------------------------------------------------------------------------

// Uploads the photo (if any) BEFORE inserting the complaint, using a
// client-generated id — avoids any chicken-and-egg problem with needing
// the complaint's id for the storage path, and means no student UPDATE
// policy on complaints is needed at all.
export async function submitComplaint(studentId, payload) {
  const complaintId = crypto.randomUUID()
  let photoPath = null

  if (payload.photoFile) {
    const ext = payload.photoFile.name.split('.').pop()
    const path = `${studentId}/${complaintId}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('complaint-photos')
      .upload(path, payload.photoFile)
    if (uploadError) throw uploadError
    photoPath = path
  }

  const { data, error } = await supabase
    .from('complaints')
    .insert({
      id: complaintId,
      student_id: studentId,
      hostel_id: payload.hostelId,
      block_id: payload.blockId || null,
      floor_id: payload.floorId || null,
      flat_id: payload.flatId || null,
      room_id: payload.roomId || null,
      category: payload.category,
      description: payload.description,
      priority: payload.priority || 'medium',
      photo_path: photoPath,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function fetchMyComplaints(studentId) {
  const { data, error } = await supabase
    .from('complaints')
    .select(COMPLAINT_SELECT)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(sortTimeline)
}

// ---------------------------------------------------------------------------
// Staff-facing (chairperson / patron_matron) — RLS scopes results to the
// caller's assigned hostel(s) and role automatically; no client-side
// hostel filter is needed or trustworthy on its own.
// ---------------------------------------------------------------------------

export async function fetchStaffComplaints() {
  const { data, error } = await supabase
    .from('complaints')
    .select(
      `${COMPLAINT_SELECT},
      profiles!complaints_student_id_fkey ( full_name, student_number )`
    )
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(sortTimeline)
}

export async function fetchMyAssignedHostels() {
  const { data, error } = await supabase
    .from('staff_hostel_assignments')
    .select('hostel_id, hostels ( name )')
  if (error) throw error
  return (data || []).map((row) => ({ id: row.hostel_id, name: row.hostels?.name }))
}

export async function addComplaintUpdate({ complaintId, action, comment, assignedTo }) {
  const { data, error } = await supabase.rpc('add_complaint_update', {
    p_complaint_id: complaintId,
    p_action: action,
    p_comment: comment || null,
    p_assigned_to: assignedTo || null,
  })
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Admin-facing — read-only this phase (full management is Phase 5)
// ---------------------------------------------------------------------------

export async function fetchAllComplaintsAdmin() {
  const { data, error } = await supabase
    .from('complaints')
    .select(
      `${COMPLAINT_SELECT},
      profiles!complaints_student_id_fkey ( full_name, student_number )`
    )
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(sortTimeline)
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export async function adminOverrideComplaint({ complaintId, status, comment, assignedTo }) {
  const { data, error } = await supabase.rpc('admin_override_complaint', {
    p_complaint_id: complaintId,
    p_status: status || null,
    p_comment: comment || null,
    p_assigned_to: assignedTo || null,
  })
  if (error) throw error
  return data
}

export async function getComplaintPhotoSignedUrl(path) {
  const { data, error } = await supabase.storage
    .from('complaint-photos')
    .createSignedUrl(path, 600) // 10 minutes
  if (error) throw error
  return data.signedUrl
}
