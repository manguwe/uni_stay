import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { COMPLAINT_CATEGORIES, submitComplaint } from '../lib/complaints'
import { fetchMyActiveAllocation } from '../lib/payments'
import { fetchHostels, fetchBlocksForHostel, fetchFloorsForParent, fetchFlatsForParent, fetchRoomsForParent } from '../lib/hierarchy'
import BackButton from '../components/BackButton'

export default function SubmitComplaint() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [hostels, setHostels] = useState([])
  const [blocks, setBlocks] = useState([])
  const [floors, setFloors] = useState([])
  const [flats, setFlats] = useState([])
  const [rooms, setRooms] = useState([])

  const [hostelId, setHostelId] = useState('')
  const [blockId, setBlockId] = useState('')
  const [floorId, setFloorId] = useState('')
  const [flatId, setFlatId] = useState('')
  const [roomId, setRoomId] = useState('')

  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('medium')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState(null)

  const [loadingDefaults, setLoadingDefaults] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  // Pre-fill from the student's active allocation, if any — still fully
  // editable afterward, per the brief.
  useEffect(() => {
    fetchMyActiveAllocation()
      .then((alloc) => {
        const room = alloc?.beds?.rooms
        if (room) {
          setHostelId(room.hostel_id || '')
          setBlockId(room.block_id || '')
          setFloorId(room.floor_id || '')
          setFlatId(room.flat_id || '')
          setRoomId(room.id || '')
        }
      })
      .catch(() => {
        /* no active allocation — leave the form blank, non-fatal */
      })
      .finally(() => setLoadingDefaults(false))
  }, [])

  useEffect(() => {
    fetchHostels().then(setHostels).catch((err) => setError(err.message))
  }, [])

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
    fetchFloorsForParent(hostelId, blockId || null)
      .then(setFloors)
      .catch((err) => setError(err.message))
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
    fetchRoomsForParent(hostelId, { blockId, floorId, flatId })
      .then(setRooms)
      .catch((err) => setError(err.message))
  }, [hostelId, blockId, floorId, flatId])

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
    if (!hostelId || !category || !description.trim()) {
      setError('Please choose a hostel, category, and describe the issue.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await submitComplaint(user.id, {
        hostelId,
        blockId: blockId || null,
        floorId: floorId || null,
        flatId: flatId || null,
        roomId: roomId || null,
        category,
        priority,
        description: description.trim(),
        photoFile,
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto mt-12 card p-6 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h1 className="text-lg mb-2">Complaint submitted</h1>
        <p className="text-sm text-body/70 mb-5">
          The hostel chairperson will review it. You can track progress any time from My
          Complaints.
        </p>
        <button onClick={() => navigate('/accommodation/complaints')} className="btn-primary">
          View My Complaints
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <BackButton label="Back to My Complaints" />
        <h1 className="text-2xl mb-1">Submit a Complaint</h1>
        <p className="text-body/70 text-sm">
          Goes to your hostel's chairperson first, per the escalation path (KB §11).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        {!loadingDefaults && (
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Hostel"
              value={hostelId}
              onChange={(v) => {
                setHostelId(v)
                resetBelow('hostel')
              }}
              options={hostels.map((h) => ({ value: h.id, label: h.name }))}
              required
            />
            <Select
              label="Block (optional)"
              value={blockId}
              onChange={(v) => {
                setBlockId(v)
                resetBelow('block')
              }}
              options={blocks.map((b) => ({ value: b.id, label: b.name }))}
              disabled={!hostelId || blocks.length === 0}
            />
            <Select
              label="Floor (optional)"
              value={floorId}
              onChange={(v) => {
                setFloorId(v)
                resetBelow('floor')
              }}
              options={floors.map((f) => ({ value: f.id, label: f.name }))}
              disabled={!hostelId || floors.length === 0}
            />
            <Select
              label="Flat (optional)"
              value={flatId}
              onChange={(v) => {
                setFlatId(v)
                resetBelow('flat')
              }}
              options={flats.map((f) => ({ value: f.id, label: f.name }))}
              disabled={!floorId || flats.length === 0}
            />
          </div>
        )}

        <Select
          label="Room (optional)"
          value={roomId}
          onChange={setRoomId}
          options={rooms.map((r) => ({ value: r.id, label: `Room ${r.room_number}` }))}
          disabled={!hostelId || rooms.length === 0}
        />

        <Select
          label="Category"
          value={category}
          onChange={setCategory}
          options={COMPLAINT_CATEGORIES}
          required
        />

        <div>
          <label className="text-sm font-medium text-body block mb-1">Priority</label>
          <div className="flex gap-2">
            {['low', 'medium', 'high'].map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 text-sm py-2 rounded-btn border capitalize ${
                  priority === p
                    ? 'border-brand-primary bg-info-bg/40 font-semibold text-heading'
                    : 'border-border text-body/70'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-body block mb-1">Description</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What's the issue?"
            className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-body block mb-1">
            Photo <span className="text-body/40 font-normal">(optional)</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full justify-center disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Submit Complaint →'}
        </button>
      </form>
    </div>
  )
}

function Select({ label, value, onChange, options, required, disabled }) {
  return (
    <div>
      <label className="text-sm font-medium text-body block mb-1">{label}</label>
      <select
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light disabled:bg-gray-50 disabled:text-body/40"
      >
        <option value="">{disabled ? 'N/A' : 'Select…'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
