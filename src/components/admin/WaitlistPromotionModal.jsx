import { useEffect, useState } from 'react'
import { fetchWaitlistCandidatesForRoom, allocateBed } from '../../lib/applications'
import { Modal } from './AllocateBedModal'

export default function WaitlistPromotionModal({ room, freedBedId, onClose, onPromoted }) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submittingId, setSubmittingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchWaitlistCandidatesForRoom(room)
      .then((data) => {
        if (!cancelled) setCandidates(data)
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
  }, [room])

  async function promote(applicationId) {
    setSubmittingId(applicationId)
    setError(null)
    try {
      await allocateBed({ applicationId, bedId: freedBedId })
      onPromoted()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <Modal title="Promote a waitlisted applicant?" onClose={onClose}>
      <p className="text-sm text-body/70 mb-4">
        Room {room.room_number} just freed up a bed. These waitlisted applications match — pick
        one to allocate now, or close this and leave the bed open.
      </p>

      {loading && <p className="text-sm text-body/60">Checking the waitlist…</p>}
      {!loading && candidates.length === 0 && (
        <p className="text-sm text-body/60">No waitlisted applications match this room right now.</p>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
        {candidates.map((app) => (
          <div
            key={app.id}
            className="flex items-center justify-between border border-border rounded-btn px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-heading">{app.profiles?.full_name}</p>
              <p className="text-xs text-body/60">
                {app.profiles?.student_number} · waitlisted{' '}
                {new Date(app.submitted_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => promote(app.id)}
              disabled={submittingId === app.id}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-60"
            >
              {submittingId === app.id ? 'Allocating…' : 'Promote & Allocate'}
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-btn border border-border text-sm font-semibold hover:bg-gray-50"
        >
          Leave bed open
        </button>
      </div>
    </Modal>
  )
}
