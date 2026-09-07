import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAdminStats } from '../../lib/applications'
import { fetchPaymentQueue } from '../../lib/payments'
import { fetchStaffComplaints, fetchMyAssignedHostels } from '../../lib/complaints'

export default function PatronHub() {
  const [stats, setStats] = useState(null)
  const [assignedHostels, setAssignedHostels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Every one of these queries relies entirely on RLS to scope results
    // to this patron/matron's assigned hostel(s) — same functions the
    // admin screens use, unchanged.
    Promise.all([
      fetchAdminStats(),
      fetchPaymentQueue(),
      fetchStaffComplaints(),
      fetchMyAssignedHostels(),
    ])
      .then(([adminStats, paymentQueue, complaints, hostels]) => {
        setStats({
          pendingApplications: adminStats.pendingApplications,
          occupiedBeds: adminStats.occupiedBeds,
          paymentsAwaitingVerification: paymentQueue.awaitingVerification.length,
          activeComplaints: complaints.filter(
            (c) => !['resolved', 'rejected', 'closed'].includes(c.status)
          ).length,
        })
        setAssignedHostels(hostels)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Patron/Matron Dashboard</h1>
        <p className="text-body/70 text-sm">
          {assignedHostels.length > 0
            ? `Managing: ${assignedHostels.map((h) => h.name).join(', ')}`
            : 'No hostel assignment yet — contact admin.'}
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!loading && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Link to="/patron/applications" className="card p-3 hover:shadow-md transition-shadow">
            <p className="text-2xl font-bold text-heading">{stats.pendingApplications}</p>
            <p className="text-xs text-body/70">Pending applications</p>
          </Link>
          <div className="card p-3">
            <p className="text-2xl font-bold text-heading">{stats.occupiedBeds}</p>
            <p className="text-xs text-body/70">Occupied beds</p>
          </div>
          <Link to="/patron/payments" className="card p-3 hover:shadow-md transition-shadow">
            <p className="text-2xl font-bold text-heading">{stats.paymentsAwaitingVerification}</p>
            <p className="text-xs text-body/70">Payments awaiting verification</p>
          </Link>
          <Link to="/patron/complaints" className="card p-3 hover:shadow-md transition-shadow">
            <p className="text-2xl font-bold text-heading">{stats.activeComplaints}</p>
            <p className="text-xs text-body/70">Active complaints</p>
          </Link>
        </div>
      )}

      <h2 className="text-sm font-semibold text-heading mb-3">Manage</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/patron/applications" className="card p-4 hover:shadow-md transition-shadow">
          <p className="font-semibold text-heading text-sm">Applications</p>
          <p className="text-xs text-body/60 mt-1">Review, allocate, waitlist, reject</p>
        </Link>
        <Link to="/patron/payments" className="card p-4 hover:shadow-md transition-shadow">
          <p className="font-semibold text-heading text-sm">Payment Verification</p>
          <p className="text-xs text-body/60 mt-1">Confirm/reject proof of payment</p>
        </Link>
        <Link to="/patron/complaints" className="card p-4 hover:shadow-md transition-shadow">
          <p className="font-semibold text-heading text-sm">Complaints</p>
          <p className="text-xs text-body/60 mt-1">Escalated complaints for your hostel</p>
        </Link>
        <Link to="/announcements/new" className="card p-4 hover:shadow-md transition-shadow">
          <p className="font-semibold text-heading text-sm">Post Announcement</p>
          <p className="text-xs text-body/60 mt-1">Scoped to your assigned hostel</p>
        </Link>
      </div>

      <p className="text-xs text-body/40 mt-6">
        Admin can still act on any hostel as a fallback or override — this is now your primary
        path for your assigned hostel(s), not admin's.
      </p>
    </div>
  )
}
