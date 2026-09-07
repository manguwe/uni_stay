import { supabase } from './supabaseClient'

// Every currently-active (unreleased) allocation, with the student's
// profile, full physical location, and payment status. RLS already grants
// admin full access to allocations/hostel_applications/profiles/
// payment_records, and blocks/floors/flats/rooms/hostels are public-select
// from Phase 1 — no new policies needed for this query.
export async function fetchAllocatedRoster() {
  const { data, error } = await supabase
    .from('allocations')
    .select(
      `id, term, allocated_at,
      hostel_applications!inner (
        student_id,
        profiles!hostel_applications_student_id_fkey ( full_name, student_number, programme )
      ),
      beds (
        bed_label, room_id,
        rooms (
          room_number, hostel_id, block_id, floor_id, flat_id,
          hostels ( name ),
          blocks ( name ),
          floors ( name ),
          flats ( name )
        )
      ),
      payment_records ( status )`
    )
    .is('released_at', null)
    .order('allocated_at', { ascending: true })

  if (error) throw error

  return (data || []).map((row) => {
    const paymentRecord = Array.isArray(row.payment_records)
      ? row.payment_records[0]
      : row.payment_records
    const room = row.beds?.rooms

    return {
      allocationId: row.id,
      term: row.term,
      allocatedAt: row.allocated_at,
      studentName: row.hostel_applications?.profiles?.full_name || '—',
      studentNumber: row.hostel_applications?.profiles?.student_number || '—',
      programme: row.hostel_applications?.profiles?.programme || '—',
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
  })
}
