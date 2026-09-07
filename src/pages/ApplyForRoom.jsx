import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { submitApplication } from '../lib/applications'
import {
  fetchHostels,
  fetchBlocksForHostel,
  fetchFloorsForParent,
  fetchFlatsForParent,
  fetchRoomsForParent,
} from '../lib/hierarchy'

export default function ApplyForRoom() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = location.state || {}

  const [hostels, setHostels] = useState([])
  const [blocks, setBlocks] = useState([])
  const [floors, setFloors] = useState([])
  const [flats, setFlats] = useState([])
  const [rooms, setRooms] = useState([])

  const [hostelId, setHostelId] = useState(prefill.hostelId || '')
  const [blockId, setBlockId] = useState(prefill.blockId || '')
  const [floorId, setFloorId] = useState(prefill.floorId || '')
  const [flatId, setFlatId] = useState(prefill.flatId || '')
  const [roomId, setRoomId] = useState(prefill.roomId || '')
  const [bedLabel] = useState(prefill.bedLabel || null)
  const [bedId] = useState(prefill.bedId || null)

  const [yearOfStudy, setYearOfStudy] = useState(profile?.year_of_study || '')
  const [newIntake, setNewIntake] = useState(false)
  const [medicalNeeds, setMedicalNeeds] = useState('')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

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
    if (!hostelId) {
      setError('Please choose a hostel.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await submitApplication(user.id, {
        hostelId,
        blockId: blockId || null,
        floorId: floorId || null,
        flatId: flatId || null,
        roomId: roomId || null,
        bedId: bedId || null,
        yearOfStudy: yearOfStudy ? Number(yearOfStudy) : null,
        newIntake,
        medicalNeeds: medicalNeeds || null,
        notes: notes || null,
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
        <h1 className="text-lg mb-2">Application submitted</h1>
        <p className="text-sm text-body/70 mb-5">
          Hostel staff will review your application.You can track its status any time from My
          Applications.
        </p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => navigate('/accommodation/applications')} className="btn-primary">
            View My Applications
          </button>
          <button
            onClick={() => navigate('/accommodation/explore')}
            className="px-4 py-2 rounded-btn border border-border text-sm font-semibold hover:bg-gray-50"
          >
            Back to Explorer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Apply For A Room</h1>
        <p className="text-body/70 text-sm">
          Choose where you'd like to stay. Staff will review and allocate — see KB §4, this
          doesn't book the bed for you directly.
        </p>
      </div>

      {bedLabel && (
        <div className="info-callout mb-5">
          Applying for <strong>{bedLabel}</strong>. You can change the location below, or clear it
          to just request the room in general.
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
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

        <Select
          label="Room (optional)"
          value={roomId}
          onChange={setRoomId}
          options={rooms.map((r) => ({ value: r.id, label: `Room ${r.room_number}` }))}
          disabled={!hostelId || rooms.length === 0}
        />

        <div>
          <label className="text-sm font-medium text-body block mb-1">Year of study</label>
          <input
            type="number"
            min="1"
            max="7"
            value={yearOfStudy}
            onChange={(e) => setYearOfStudy(e.target.value)}
            className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={newIntake}
            onChange={(e) => setNewIntake(e.target.checked)}
            className="rounded border-border text-brand-primary focus:ring-brand-primary-light"
          />
          I'm a new intake student (not returning)
        </label>

        <div>
          <label className="text-sm font-medium text-body block mb-1">
            Medical / disability needs (optional)
          </label>
          <textarea
            value={medicalNeeds}
            onChange={(e) => setMedicalNeeds(e.target.value)}
            rows={2}
            className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-body block mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full justify-center disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Submit Application →'}
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
