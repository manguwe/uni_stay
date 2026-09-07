import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchMyComplaints, COMPLAINT_CATEGORIES, getComplaintPhotoSignedUrl } from '../lib/complaints'
import ComplaintStatusBadge from '../components/ComplaintStatusBadge'
import ComplaintTimeline from '../components/ComplaintTimeline'

const CATEGORY_LABEL = Object.fromEntries(COMPLAINT_CATEGORIES.map((c) => [c.value, c.label]))

export default function MyComplaints() {
  const { user } = useAuth()
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    fetchMyComplaints(user.id)
      .then((data) => {
        if (!cancelled) setComplaints(data)
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
          <h1 className="text-2xl mb-1">My Complaints</h1>
          <p className="text-body/70 text-sm">Track the status of issues you've reported.</p>
        </div>
        <Link to="/accommodation/complaints/new" className="btn-primary">
          New Complaint
        </Link>
      </div>

      {loading && <p className="text-sm text-body/60">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && complaints.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-sm text-body/70 mb-3">You haven't reported anything yet.</p>
          <Link to="/accommodation/complaints/new" className="btn-primary inline-flex">
            Submit a Complaint
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {complaints.map((c) => (
          <ComplaintCard
            key={c.id}
            complaint={c}
            expanded={expandedId === c.id}
            onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ComplaintCard({ complaint: c, expanded, onToggle }) {
  const [photoUrl, setPhotoUrl] = useState(null)

  useEffect(() => {
    if (expanded && c.photo_path) {
      getComplaintPhotoSignedUrl(c.photo_path).then(setPhotoUrl).catch(() => setPhotoUrl(null))
    }
  }, [expanded, c.photo_path])

  return (
    <div className="card p-4">
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="font-semibold text-heading">{CATEGORY_LABEL[c.category] || c.category}</p>
            <p className="text-xs text-body/60">
              {c.hostels?.name}
              {c.rooms?.room_number && ` · Room ${c.rooms.room_number}`}
            </p>
          </div>
          <ComplaintStatusBadge status={c.status} />
        </div>
        <p className="text-sm text-body/80 mt-2 line-clamp-2">{c.description}</p>
        <p className="text-xs text-body/40 mt-2">
          Submitted {new Date(c.created_at).toLocaleDateString()} · {expanded ? 'Hide' : 'Show'} timeline
        </p>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border">
          {photoUrl && (
            <a href={photoUrl} target="_blank" rel="noreferrer" className="text-sm text-link hover:underline block mb-3">
              View attached photo →
            </a>
          )}
          <ComplaintTimeline updates={c.complaint_updates} />
        </div>
      )}
    </div>
  )
}
