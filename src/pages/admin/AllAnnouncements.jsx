import { useEffect, useState } from 'react'
import { fetchAnnouncements, deleteAnnouncement, scopeLabel } from '../../lib/announcements'

export default function AllAnnouncements() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function load() {
    setLoading(true)
    fetchAnnouncements()
      .then(setAnnouncements)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDelete(id) {
    if (!confirm('Delete this announcement?')) return
    try {
      await deleteAnnouncement(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1">All Announcements</h1>
        <p className="text-body/70 text-sm">
          Every announcement across every hostel, regardless of scope — including ones created by
          chairperson/patron_matron accounts. No dependency on admin having an allocation (admin
          never has one), same read-everything pattern as All Complaints.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-body/60">Loading…</p>}

      {!loading && announcements.length === 0 && (
        <p className="text-sm text-body/60">No announcements have been posted yet.</p>
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
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-body/40">
                {a.profiles?.full_name && `${a.profiles.full_name} · `}
                {new Date(a.created_at).toLocaleString()}
                {a.expires_at && ` · Expires ${new Date(a.expires_at).toLocaleString()}`}
              </p>
              <button onClick={() => handleDelete(a.id)} className="text-xs text-red-600 hover:underline shrink-0">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
