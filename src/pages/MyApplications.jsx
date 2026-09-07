import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchMyApplications } from '../lib/applications'
import ApplicationStatusBadge from '../components/ApplicationStatusBadge'

export default function MyApplications() {
  const { user } = useAuth()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    fetchMyApplications(user.id)
      .then((data) => {
        if (!cancelled) setApplications(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl mb-1">My Applications</h1>
          <p className="text-body/70 text-sm">Track the status of your accommodation requests.</p>
        </div>
        <Link to="/accommodation/apply" className="btn-primary">
          New Application
        </Link>
      </div>

      {loading && <p className="text-sm text-body/60">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && applications.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-sm text-body/70 mb-3">You haven't submitted an application yet.</p>
          <Link to="/accommodation/apply" className="btn-primary inline-flex">
            Apply For A Room
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {applications.map((app) => {
          const activeAllocation = (app.allocations || []).find((a) => !a.released_at)
          return (
            <div key={app.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-heading">{app.hostels?.name}</p>
                  {app.rooms?.room_number && (
                    <p className="text-sm text-body/70">Room {app.rooms.room_number}</p>
                  )}
                </div>
                <ApplicationStatusBadge status={app.status} />
              </div>

              {activeAllocation && (
                <div className="info-callout mt-2 flex items-center justify-between gap-3">
                  <span>
                    Allocated: {activeAllocation.beds?.bed_label} · {activeAllocation.term}.
                  </span>
                  <Link to="/accommodation/finance" className="font-semibold underline shrink-0">
                    View payment status →
                  </Link>
                </div>
              )}

              {app.status === 'rejected' && app.rejection_reason && (
                <p className="text-sm text-red-600 mt-2">Reason: {app.rejection_reason}</p>
              )}
              {app.status === 'waitlisted' && (
                <p className="text-sm text-amber-700 mt-2">
                  You're on the waitlist — you'll be notified if a matching bed opens up.
                </p>
              )}

              <p className="text-xs text-body/50 mt-3">
                Submitted {new Date(app.submitted_at).toLocaleDateString()}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
