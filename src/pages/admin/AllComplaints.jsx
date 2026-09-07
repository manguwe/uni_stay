import { useCallback, useEffect, useState } from 'react'
import {
  fetchAllComplaintsAdmin,
  adminOverrideComplaint,
  COMPLAINT_CATEGORIES,
  getComplaintPhotoSignedUrl,
} from '../../lib/complaints'
import ComplaintStatusBadge from '../../components/ComplaintStatusBadge'
import ComplaintTimeline from '../../components/ComplaintTimeline'

const CATEGORY_LABEL = Object.fromEntries(COMPLAINT_CATEGORIES.map((c) => [c.value, c.label]))

const STATUS_OPTIONS = [
  'submitted', 'under_review', 'escalated', 'assigned', 'in_progress', 'resolved', 'rejected', 'closed',
]

export default function AllComplaints() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchAllComplaintsAdmin()
      .then(setComplaints)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1">All Complaints</h1>
        <p className="text-body/70 text-sm">
          Full visibility across every hostel. Overriding status or reassigning here still appends
          to the complaint's timeline (via <code>admin_override_complaint()</code>), so the audit
          trail stays complete even for admin actions.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-body/60">Loading…</p>}

      {!loading && complaints.length === 0 && (
        <p className="text-sm text-body/60">No complaints have been submitted yet.</p>
      )}

      <div className="space-y-3">
        {complaints.map((c) => (
          <AdminComplaintCard
            key={c.id}
            complaint={c}
            expanded={expandedId === c.id}
            onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
            onChanged={load}
          />
        ))}
      </div>
    </div>
  )
}

function AdminComplaintCard({ complaint: c, expanded, onToggle, onChanged }) {
  const [photoUrl, setPhotoUrl] = useState(null)
  const [statusOverride, setStatusOverride] = useState(c.status)
  const [assignedToOverride, setAssignedToOverride] = useState(c.assigned_to || '')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [overrideError, setOverrideError] = useState(null)

  useEffect(() => {
    if (expanded && c.photo_path) {
      getComplaintPhotoSignedUrl(c.photo_path).then(setPhotoUrl).catch(() => setPhotoUrl(null))
    }
  }, [expanded, c.photo_path])

  async function handleOverride() {
    setSubmitting(true)
    setOverrideError(null)
    try {
      await adminOverrideComplaint({
        complaintId: c.id,
        status: statusOverride !== c.status ? statusOverride : null,
        assignedTo: assignedToOverride !== (c.assigned_to || '') ? assignedToOverride : null,
        comment: comment.trim() || null,
      })
      setComment('')
      onChanged()
    } catch (err) {
      setOverrideError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card p-4">
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="font-semibold text-heading">
              {CATEGORY_LABEL[c.category] || c.category} — {c.profiles?.full_name}
            </p>
            <p className="text-xs text-body/60">
              {c.profiles?.student_number} · {c.hostels?.name}
              {c.rooms?.room_number && ` · Room ${c.rooms.room_number}`}
            </p>
          </div>
          <ComplaintStatusBadge status={c.status} size="sm" />
        </div>
        <p className="text-sm text-body/80 mt-2 line-clamp-2">{c.description}</p>
        <p className="text-xs text-body/40 mt-2">
          {new Date(c.created_at).toLocaleDateString()} · {expanded ? 'Hide' : 'Show'} details
        </p>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          {photoUrl && (
            <a href={photoUrl} target="_blank" rel="noreferrer" className="text-sm text-link hover:underline block">
              View attached photo →
            </a>
          )}
          {c.assigned_to && (
            <p className="text-sm text-body/70">
              Assigned to: <span className="font-medium text-heading">{c.assigned_to}</span>
            </p>
          )}

          <div>
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wide mb-2">Timeline</h3>
            <ComplaintTimeline updates={c.complaint_updates} />
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wide">Admin override</h3>
            <div className="grid grid-cols-2 gap-2">
              <select value={statusOverride} onChange={(e) => setStatusOverride(e.target.value)} className="input">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <input
                value={assignedToOverride}
                onChange={(e) => setAssignedToOverride(e.target.value)}
                placeholder="Assigned to"
                className="input"
              />
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Reason for this change (recorded in the timeline)"
              className="input"
            />
            {overrideError && <p className="text-sm text-red-600">{overrideError}</p>}
            <button
              onClick={handleOverride}
              disabled={submitting}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Apply Override'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
