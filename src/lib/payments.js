import { supabase } from './supabaseClient'

// ---------------------------------------------------------------------------
// Student-facing
// ---------------------------------------------------------------------------

// Relies entirely on RLS to scope to the caller — payment_records has no
// student_id column of its own (reached via allocations -> hostel_applications),
// so there's nothing meaningful to .eq() client-side; the "Students can view
// own payment records" policy does the real work.
export async function fetchMyActiveAllocation() {
  const { data, error } = await supabase
    .from('allocations')
    .select(
      `id, term, allocated_at, bed_id,
      beds ( bed_label, room_id, rooms ( id, room_number, bed_capacity, hostel_id, block_id, floor_id, flat_id, hostels ( name ) ) ),
      payment_records ( id, status, amount_due, reference_number, receipt_path, submitted_at, verified_at, rejection_reason )`
    )
    .is('released_at', null)
    .order('allocated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  // payment_records is a to-one relationship (unique allocation_id) but
  // PostgREST may still hand it back as an array depending on how it
  // infers the constraint — normalize either shape.
  const paymentRecord = Array.isArray(data.payment_records)
    ? data.payment_records[0]
    : data.payment_records

  return { ...data, paymentRecord }
}

export async function uploadReceipt(userId, paymentRecordId, file) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${paymentRecordId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('payment-receipts').upload(path, file)
  if (error) throw error
  return path
}

export async function submitPaymentProof(paymentRecordId, { referenceNumber, receiptPath }) {
  const { error } = await supabase
    .from('payment_records')
    .update({
      reference_number: referenceNumber,
      receipt_path: receiptPath || null,
      status: 'awaiting_verification',
    })
    .eq('id', paymentRecordId)
  if (error) throw error
}

export async function getReceiptSignedUrl(path) {
  const { data, error } = await supabase.storage
    .from('payment-receipts')
    .createSignedUrl(path, 600) // 10 minutes
  if (error) throw error
  return data.signedUrl
}

// Only ever returns data for the caller's own confirmed, active room — see
// the DESIGN NOTE in phase2b_payments_and_roommates.sql for why this is
// safe as a SECURITY DEFINER RPC rather than a raw table/view.
export async function fetchMyRoommates() {
  const { data, error } = await supabase.rpc('get_my_roommates')
  if (error) throw error
  return data || []
}

// ---------------------------------------------------------------------------
// Admin-facing
// ---------------------------------------------------------------------------

const ADMIN_PAYMENT_SELECT = `*,
  allocations!inner (
    id, term, allocated_at, bed_id,
    hostel_applications!inner ( student_id, profiles!hostel_applications_student_id_fkey ( full_name, student_number ) ),
    beds ( bed_label, room_id, rooms ( id, room_number, hostel_id, hostels ( name ) ) )
  )`

export async function fetchPaymentQueue() {
  const [{ data: deadlineDays, error: deadlineError }, { data, error }] = await Promise.all([
    supabase.rpc('payment_deadline_days'),
    supabase
      .from('payment_records')
      .select(ADMIN_PAYMENT_SELECT)
      .in('status', ['unpaid', 'awaiting_verification'])
      .order('created_at', { ascending: true }),
  ])

  if (deadlineError) throw deadlineError
  if (error) throw error

  const deadlineMs = (deadlineDays || 7) * 24 * 60 * 60 * 1000
  const now = Date.now()

  const withOverdueFlag = (data || []).map((pr) => ({
    ...pr,
    isOverdue: new Date(pr.allocations.allocated_at).getTime() + deadlineMs < now,
  }))

  return {
    awaitingVerification: withOverdueFlag.filter((p) => p.status === 'awaiting_verification'),
    overdue: withOverdueFlag.filter((p) => p.isOverdue),
    deadlineDays: deadlineDays || 7,
  }
}

export async function confirmPayment(paymentRecordId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('payment_records')
    .update({
      status: 'confirmed',
      verified_by: user?.id,
      verified_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', paymentRecordId)
  if (error) throw error
}

export async function rejectPayment(paymentRecordId, reason) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('payment_records')
    .update({
      status: 'rejected',
      verified_by: user?.id,
      verified_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', paymentRecordId)
  if (error) throw error
}
