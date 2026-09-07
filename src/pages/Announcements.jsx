import { useEffect, useState } from 'react'
import { fetchAnnouncements, scopeLabel } from '../lib/announcements'

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAnnouncements()
      .then(setAnnouncements)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Announcements</h1>
        <p className="text-body/70 text-sm">
          Notices relevant to you — hostel-wide, all-students, or specific to your room.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-body/60">Loading…</p>}

      {!loading && announcements.length === 0 && (
        <p className="text-sm text-body/60">No announcements right now.</p>
      )}

      <div className="space-y-3">
        {announcements.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-base">{a.title}</h2>
              <span className="text-xs bg-info-bg text-info-text rounded-full px-2 py-0.5 shrink-0 ml-2">
                {scopeLabel(a)}
              </span>
            </div>
            <p className="text-sm text-body/80 whitespace-pre-wrap">{a.body}</p>
            <p className="text-xs text-body/40 mt-2">
              {a.profiles?.full_name && `${a.profiles.full_name} · `}
              {new Date(a.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
