import { supabase } from './supabaseClient'

function groupCount(rows, key) {
  const out = {}
  for (const row of rows || []) {
    const k = row[key] || 'unknown'
    out[k] = (out[k] || 0) + 1
  }
  return out
}

function monthKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function fetchDashboardStats() {
  const [
    { data: profiles, error: profilesError },
    { data: hostels, error: hostelsError },
    { data: rooms, error: roomsError },
    { data: beds, error: bedsError },
    { data: applications, error: applicationsError },
    { data: complaints, error: complaintsError },
    { data: payments, error: paymentsError },
    { data: allocationsWithGender, error: allocError },
  ] = await Promise.all([
    supabase.from('profiles').select('id, role'),
    supabase.from('hostels').select('id, name, gender, total_bed_capacity'),
    supabase.from('rooms').select('id, hostel_id'),
    supabase.from('beds').select('id, status, room_id, rooms ( hostel_id, hostels ( name ) )'),
    supabase.from('hostel_applications').select('id, status, submitted_at'),
    supabase.from('complaints').select('id, status, category, created_at'),
    supabase.from('payment_records').select('id, status'),
    supabase
      .from('allocations')
      .select(
        `id,
        hostel_applications!inner ( student_id, profiles!hostel_applications_student_id_fkey ( gender ) ),
        beds ( rooms ( hostel_id, hostels ( name ) ) )`
      )
      .is('released_at', null),
  ])

  const firstError =
    profilesError ||
    hostelsError ||
    roomsError ||
    bedsError ||
    applicationsError ||
    complaintsError ||
    paymentsError ||
    allocError
  if (firstError) throw firstError

  const bedsByStatus = groupCount(beds, 'status')

  const occupancyByHostel = {}
  for (const bed of beds || []) {
    const hid = bed.rooms?.hostel_id
    if (!hid) continue
    occupancyByHostel[hid] = occupancyByHostel[hid] || {
      hostelId: hid,
      hostelName: bed.rooms.hostels?.name || 'Unknown',
      total: 0,
      occupied: 0,
    }
    occupancyByHostel[hid].total += 1
    if (bed.status === 'occupied') occupancyByHostel[hid].occupied += 1
  }

  const genderBalanceByHostel = {}
  for (const alloc of allocationsWithGender || []) {
    const hid = alloc.beds?.rooms?.hostel_id
    const hostelName = alloc.beds?.rooms?.hostels?.name
    const gender = alloc.hostel_applications?.profiles?.gender || 'unspecified'
    if (!hid) continue
    genderBalanceByHostel[hid] = genderBalanceByHostel[hid] || { hostelId: hid, hostelName, male: 0, female: 0, unspecified: 0 }
    genderBalanceByHostel[hid][gender] = (genderBalanceByHostel[hid][gender] || 0) + 1
  }

  const applicationsByMonth = {}
  for (const app of applications || []) {
    const k = monthKey(app.submitted_at)
    applicationsByMonth[k] = (applicationsByMonth[k] || 0) + 1
  }
  const applicationsOverTime = Object.entries(applicationsByMonth)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, count]) => ({ month, count }))

  return {
    headline: {
      totalStudents: (profiles || []).filter((p) => p.role === 'student').length,
      totalHostels: (hostels || []).length,
      totalRooms: (rooms || []).length,
      totalBeds: (beds || []).length,
      bedsOccupied: bedsByStatus.occupied || 0,
      bedsAvailable: bedsByStatus.vacant || 0,
      bedsReserved: bedsByStatus.reserved || 0,
      bedsUnavailable: bedsByStatus.maintenance || 0,
      pendingApplications: (applications || []).filter((a) =>
        ['submitted', 'under_review'].includes(a.status)
      ).length,
      activeComplaints: (complaints || []).filter(
        (c) => !['resolved', 'rejected', 'closed'].includes(c.status)
      ).length,
      paymentsAwaitingVerification: (payments || []).filter((p) => p.status === 'awaiting_verification')
        .length,
    },
    occupancyByHostel: Object.values(occupancyByHostel),
    genderBalanceByHostel: Object.values(genderBalanceByHostel),
    applicationsOverTime,
    complaintsByCategory: groupCount(complaints, 'category'),
    complaintsByStatus: groupCount(complaints, 'status'),
    paymentsByStatus: groupCount(payments, 'status'),
  }
}
