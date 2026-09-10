import { supabase } from './supabaseClient'

const DIRECTORY_PROFILE_FIELDS =
  'full_name, student_number, programme, year_of_study, id_document_type, id_document_number, phone_number'

function mapDirectoryRow(row) {
  const paymentRecord = Array.isArray(row.payment_records) ? row.payment_records[0] : row.payment_records
  const room = row.beds?.rooms
  const p = row.hostel_applications?.profiles

  return {
    allocationId: row.id,
    term: row.term,
    allocatedAt: row.allocated_at,
    studentName: p?.full_name || '—',
    studentNumber: p?.student_number || '—',
    programme: p?.programme || '—',
    yearOfStudy: p?.year_of_study ?? '—',
    idDocumentType: p?.id_document_type || null,
    idDocumentNumber: p?.id_document_number || '—',
    phoneNumber: p?.phone_number || '—',
    bedLabel: row.beds?.bed_label || '—',
    hostelId: room?.hostel_id || null,
    hostelName: room?.hostels?.name || '—',
    blockId: room?.block_id || null,
    blockName: room?.blocks?.name || null,
    floorId: room?.floor_id || null,
    floorName: room?.floors?.name || null,
    flatId: room?.flat_id || null,
    flatName: room?.flats?.name || null,
    roomNumber: room?.room_number || '—',
    paymentStatus: paymentRecord?.status || 'unpaid',
  }
}

// Every currently-active (unreleased) allocation, with the student's full
// profile, physical location, and payment status. RLS grants admin full
// access to every table involved — no new policies needed for this query.
export async function fetchAllocatedRoster() {
  const { data, error } = await supabase
    .from('allocations')
    .select(
      `id, term, allocated_at,
      hostel_applications!inner (
        student_id,
        profiles!hostel_applications_student_id_fkey ( ${DIRECTORY_PROFILE_FIELDS} )
      ),
      beds (
        bed_label, room_id,
        rooms (
          room_number, hostel_id, block_id, floor_id, flat_id,
          hostels ( name ), blocks ( name ), floors ( name ), flats ( name )
        )
      ),
      payment_records ( status )`
    )
    .is('released_at', null)
    .order('allocated_at', { ascending: true })

  if (error) throw error
  return (data || []).map(mapDirectoryRow)
}

// Patron/Matron's Student Directory (KB §8b) — same shape as the admin
// roster, but naturally scoped to the caller's assigned hostel(s) via the
// existing "Patrons can view own-hostel allocations" RLS policy (Phase 6)
// and the staff-visibility profiles policy (Phase 7) — no new SQL needed,
// verified before writing this.
export async function fetchStudentDirectory() {
  const { data, error } = await supabase
    .from('allocations')
    .select(
      `id, term, allocated_at,
      hostel_applications!inner (
        student_id,
        profiles!hostel_applications_student_id_fkey ( ${DIRECTORY_PROFILE_FIELDS} )
      ),
      beds (
        bed_label, room_id,
        rooms (
          room_number, hostel_id, block_id, floor_id, flat_id,
          hostels ( name ), blocks ( name ), floors ( name ), flats ( name )
        )
      ),
      payment_records ( status )`
    )
    .is('released_at', null)
    .order('allocated_at', { ascending: true })

  if (error) throw error
  return (data || []).map(mapDirectoryRow)
}
