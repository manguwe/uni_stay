import { useCallback, useEffect, useState } from 'react'
import {
  fetchPendingApplications,
  fetchAdminStats,
  markUnderReview,
  waitlistApplication,
} from '../../lib/applications'
import ApplicationCard from '../../components/admin/ApplicationCard'
import AllocateBedModal from '../../components/admin/AllocateBedModal'
import RejectModal from '../../components/admin/RejectModal'

export default function ReviewQueue() {
  const [applications, setApplications] = useState([])
  const [stats, setStats] = useState({ occupiedBeds: 0, pendingApplications: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [allocatingApp, setAllocatingApp] = useState(null)
  const [rejectingApp, setRejectingApp] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [apps, statsData] = await Promise.all([fetchPendingApplications(), fetchAdminStats()])
      setApplications(apps)
      setStats(statsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleMarkUnderReview(id) {
    try {
      await markUnderReview(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleWaitlist(id) {
    try {
      await waitlistApplication(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Application Review Queue</h1>
        <p className="text-body/70 text-sm">Allocate, waitlist, or reject pending applications.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-2xl font-bold text-heading">{stats.occupiedBeds}</p>
          <p className="text-xs text-body/70">Occupied beds</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-heading">{stats.pendingApplications}</p>
          <p className="text-xs text-body/70">Pending applications</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-body/60">Loading queue…</p>}

      {!loading && applications.length === 0 && (
        <div className="card p-6 text-center text-sm text-body/60">
          No pending applications right now.
        </div>
      )}

      <div className="space-y-3">
        {applications.map((app) => (
          <ApplicationCard
            key={app.id}
            application={app}
            onMarkUnderReview={handleMarkUnderReview}
            onAllocate={setAllocatingApp}
            onWaitlist={handleWaitlist}
            onReject={setRejectingApp}
          />
        ))}
      </div>

      {allocatingApp && (
        <AllocateBedModal
          application={allocatingApp}
          onClose={() => setAllocatingApp(null)}
          onAllocated={() => {
            setAllocatingApp(null)
            load()
          }}
        />
      )}

      {rejectingApp && (
        <RejectModal
          application={rejectingApp}
          onClose={() => setRejectingApp(null)}
          onRejected={() => {
            setRejectingApp(null)
            load()
          }}
        />
      )}
    </div>
  )
}
