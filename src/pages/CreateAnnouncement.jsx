import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  scopeLabel,
} from '../lib/announcements'
import { fetchMyAssignedHostels } from '../lib/complaints'
import { fetchHostels, fetchBlocksForHostel, fetchFloorsForParent, fetchFlatsForParent, fetchRoomsForParent } from '../lib/hierarchy'

export default function CreateAnnouncement() {
  const { isAdmin } = useAuth()
  const [hostelOptions, setHostelOptions] = useState([])

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [hostelId, setHostelId] = useState('')
  const [blockId, setBlockId] = useState('')
  const [flatId, setFlatId] = useState('')
  const [floorId, setFloorId] = useState('') // needed to scope flats/rooms, not sent itself
  const [roomId, setRoomId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const [blocks, setBlocks] = useState([])
  const [floors, setFloors] = useState([])
  const [flats, setFlats] = useState([])
  const [rooms, setRooms] = useState([])

  const [announcements, setAnnouncements] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [loadingList, setLoadingList] = useState(true)

  useEffect(() => {
    if (isAdmin) {
      fetchHostels().then(setHostelOptions).catch((err) => setError(err.message))
    } else {
      fetchMyAssignedHostels()
        .then((hostels) => setHostelOptions(hostels.map((h) => ({ id: h.id, name: h.name }))))
        .catch((err) => setError(err.message))
    }
  }, [isAdmin])

  useEffect(() => {
    if (!hostelId) {
      setBlocks([])
      return
    }
    fetchBlocksForHostel(hostelId).then(setBlocks).catch((err) => setError(err.message))
  }, [hostelId])

  useEffect(() => {
    if (!hostelId) {
      setFloors([])
      return
    }
    fetchFloorsForParent(hostelId, blockId || null).then(setFloors).catch((err) => setError(err.message))
  }, [hostelId, blockId])

  useEffect(() => {
    if (!hostelId || !floorId) {
      setFlats([])
      return
    }
    fetchFlatsForParent(hostelId, floorId).then(setFlats).catch((err) => setError(err.message))
  }, [hostelId, floorId])

  useEffect(() => {
    if (!hostelId) {
      setRooms([])
      return
    }
    fetchRoomsForParent(hostelId, { blockId, floorId, flatId }).then(setRooms).catch((err) => setError(err.message))
  }, [hostelId, blockId, floorId, flatId])

  function loadList() {
    setLoadingList(true)
    fetchAnnouncements()
      .then(setAnnouncements)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingList(false))
  }

  useEffect(() => {
    loadList()
  }, [])

  function resetBelow(level) {
    if (level === 'hostel') {
      setBlockId('')
      setFloorId('')
      setFlatId('')
      setRoomId('')
    } else if (level === 'block') {
      setFloorId('')
      setFlatId('')
      setRoomId('')
    } else if (level === 'floor') {
      setFlatId('')
      setRoomId('')
    } else if (level === 'flat') {
      setRoomId('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isAdmin && !hostelId) {
      setError('Please choose which of your assigned hostels this is for.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await createAnnouncement({
        title,
        body,
        targetHostelId: hostelId || null,
        targetBlockId: blockId || null,
        targetFlatId: flatId || null,
        targetRoomId: roomId || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      setTitle('')
      setBody('')
      setHostelId('')
      setExpiresAt('')
      loadList()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this announcement?')) return
    try {
      await deleteAnnouncement(id)
      loadList()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Announcements</h1>
        <p className="text-body/70 text-sm">
          {isAdmin
            ? 'Post to all students, or scope to a hostel/block/flat/room.'
            : "Scoped to your assigned hostel(s) — you can't post an all-students announcement."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-3 mb-8">
        <Field label="Title">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
        </Field>
        <Field label="Body">
          <textarea required rows={4} value={body} onChange={(e) => setBody(e.target.value)} className="input" />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label={isAdmin ? 'Hostel (blank = all students)' : 'Hostel'}>
            <select
              required={!isAdmin}
              value={hostelId}
              onChange={(e) => {
                setHostelId(e.target.value)
                resetBelow('hostel')
              }}
              className="input"
            >
              <option value="">{isAdmin ? 'All students' : 'Select…'}</option>
              {hostelOptions.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Block (optional)">
            <select
              value={blockId}
              onChange={(e) => { setBlockId(e.target.value); resetBelow('block') }}
              disabled={!hostelId || blocks.length === 0}
              className="input"
            >
              <option value="">Any</option>
              {blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Floor (optional, for narrowing flat/room)">
            <select
              value={floorId}
              onChange={(e) => { setFloorId(e.target.value); resetBelow('floor') }}
              disabled={!hostelId || floors.length === 0}
              className="input"
            >
              <option value="">Any</option>
              {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="Flat (optional)">
            <select
              value={flatId}
              onChange={(e) => { setFlatId(e.target.value); resetBelow('flat') }}
              disabled={!floorId || flats.length === 0}
              className="input"
            >
              <option value="">Any</option>
              {flats.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Room (optional)">
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={!hostelId || rooms.length === 0} className="input">
            <option value="">Any</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
          </select>
        </Field>

        <Field label="Expires (optional)">
          <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="input" />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full justify-center disabled:opacity-60">
          {submitting ? 'Posting…' : 'Post Announcement →'}
        </button>
      </form>

      <h2 className="text-sm font-semibold text-heading mb-3">Recent announcements</h2>
      {loadingList && <p className="text-sm text-body/60">Loading…</p>}
      <div className="space-y-2">
        {announcements.map((a) => (
          <div key={a.id} className="card p-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-heading">{a.title}</p>
              <p className="text-xs text-body/60">{scopeLabel(a)} · {new Date(a.created_at).toLocaleDateString()}</p>
            </div>
            <button onClick={() => handleDelete(a.id)} className="text-xs text-red-600 hover:underline shrink-0">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm font-medium text-body block mb-1">{label}</label>
      {children}
    </div>
  )
}
