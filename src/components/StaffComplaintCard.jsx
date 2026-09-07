import { useEffect, useState } from 'react'
import { addComplaintUpdate, getComplaintPhotoSignedUrl } from '../lib/complaints'
import ComplaintStatusBadge from './ComplaintStatusBadge'
import ComplaintTimeline from './ComplaintTimeline'

export default function StaffComplaintCard({ complaint: c, expanded, onToggle, actions, onActionDone }) {
  const [photoUrl, setPhotoUrl] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [assignedToText, setAssignedToText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (expanded && c.photo_path) {
      getComplaintPhotoSignedUrl(c.photo_path).then(setPhotoUrl).catch(() => setPhotoUrl(null))
    }
  }, [expanded, c.photo_path])

  function openAction(action) {
    setPendingAction(action)
    setCommentText('')
    setAssignedToText('')
    setError(null)
  }

  async function confirmAction() {
    if (pendingAction.needsComment && !commentText.trim()) {
      setError('A comment is required for this action.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await addComplaintUpdate({
        complaintId: c.id,
        action: pendingAction.action,
        comment: commentText.trim() || null,
        assignedTo: assignedToText.trim() || null,
      })
      setPendingAction(null)
      onActionDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card p-4">
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="font-semibold text-heading">{c.profiles?.full_name}</p>
            <p className="text-xs text-body/60">
              {c.profiles?.student_number} · {c.hostels?.name}
              {c.rooms?.room_number && ` · Room ${c.rooms.room_number}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs uppercase tracking-wide text-body/50">{c.priority}</span>
            <ComplaintStatusBadge status={c.status} size="sm" />
          </div>
        </div>
        <p className="text-sm text-body/80 mt-2 line-clamp-2">{c.description}</p>
        <p className="text-xs text-body/40 mt-2">
          {new Date(c.created_at).toLocaleDateString()} · {expanded ? 'Hide' : 'Show'} details
        </p>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          <p className="text-sm text-body">{c.description}</p>

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

          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a.action}
                onClick={() => openAction(a)}
                className={`text-xs px-3 py-1.5 rounded-btn font-semibold ${a.className}`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {pendingAction && (
            <div className="border-t border-border pt-3 space-y-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
                placeholder={pendingAction.needsComment ? 'Comment (required)' : 'Comment (optional)'}
                className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
              />
              {pendingAction.needsAssignedTo && (
                <input
                  value={assignedToText}
                  onChange={(e) => setAssignedToText(e.target.value)}
                  placeholder="Assigned to (e.g. maintenance contact name)"
                  className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
                />
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setPendingAction(null)}
                  className="px-3 py-1.5 rounded-btn border border-border text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAction}
                  disabled={submitting}
                  className="btn-primary text-xs px-3 py-1.5 disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : `Confirm: ${pendingAction.label}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
