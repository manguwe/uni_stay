import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAllApplicationsAdmin } from '../../lib/applications'
import ApplicationStatusBadge from '../../components/ApplicationStatusBadge'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'waitlisted', label: 'Waitlisted' },
  { value: 'rejected', label: 'Rejected' },
]

export default function AllApplications() {
  const [applications, setApplications] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function load(filter) {
    setLoading(true)
    fetchAllApplicationsAdmin(filter)
      .then(setApplications)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(statusFilter)
  }, [statusFilter])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl mb-1">All Applications</h1>
          <p className="text-body/70 text-sm">
            Every application, any status.{' '}
            <Link to="/admin/applications" className="text-link hover:underline">
              Go to Review Queue
            </Link>{' '}
            to act on pending ones.
          </p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-body/60">Loading…</p>}

      <div className="space-y-2">
        {applications.map((app) => (
          <div key={app.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-heading">{app.profiles?.full_name}</p>
                <p className="text-xs text-body/60">
                  {app.profiles?.student_number} · {app.hostels?.name}
                  {app.rooms?.room_number && ` · Room ${app.rooms.room_number}`}
                </p>
              </div>
              <ApplicationStatusBadge status={app.status} size="sm" />
            </div>
            <p className="text-xs text-body/40 mt-2">
              Submitted {new Date(app.submitted_at).toLocaleDateString()}
              {app.reviewed_at && ` · Reviewed ${new Date(app.reviewed_at).toLocaleDateString()}`}
            </p>
            {app.status === 'rejected' && app.rejection_reason && (
              <p className="text-xs text-red-600 mt-1">Reason: {app.rejection_reason}</p>
            )}
          </div>
        ))}
        {!loading && applications.length === 0 && (
          <p className="text-sm text-body/60">No applications match this filter.</p>
        )}
      </div>
    </div>
  )
}
