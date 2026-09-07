import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchBedsForRoom } from '../lib/hierarchy'
import { releaseBed } from '../lib/applications'
import { useAuth } from '../context/AuthContext'
import BedStatusBadge from './BedStatusBadge'

export default function RoomDetailPanel({ room, hostel, onClose, onBedReleased }) {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [beds, setBeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [releasingBedId, setReleasingBedId] = useState(null)

  function loadBeds() {
    setLoading(true)
    fetchBedsForRoom(room.id)
      .then(setBeds)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchBedsForRoom(room.id)
      .then((data) => {
        if (!cancelled) setBeds(data)
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
  }, [room.id])

  const occupied = beds.filter((b) => b.status === 'occupied').length
  const available = beds.filter((b) => b.status === 'vacant').length

  function goApply(bed) {
    navigate('/accommodation/apply', {
      state: {
        hostelId: room.hostel_id,
        blockId: room.block_id,
        floorId: room.floor_id,
        flatId: room.flat_id,
        roomId: room.id,
        bedId: bed?.id || null,
        bedLabel: bed ? `Room ${room.room_number} — ${bed.bed_label}` : null,
      },
    })
  }

  async function handleFreeBed(bed) {
    setReleasingBedId(bed.id)
    setError(null)
    try {
      await releaseBed(bed.id)
      loadBeds()
      onBedReleased?.(room, bed.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setReleasingBedId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center z-30 p-0 md:p-6"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full md:max-w-lg md:rounded-card rounded-t-card shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-heading">Room {room.room_number}</h2>
            <p className="text-sm text-body/70">{hostel?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-btn hover:bg-gray-100"
            aria-label="Close room detail"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="card p-3">
              <p className="text-2xl font-bold text-heading">{room.bed_capacity}</p>
              <p className="text-xs text-body/70">Capacity</p>
            </div>
            <div className="card p-3">
              <p className="text-2xl font-bold text-heading">{occupied}</p>
              <p className="text-xs text-body/70">Occupied</p>
            </div>
            <div className="card p-3">
              <p className="text-2xl font-bold text-accent">{available}</p>
              <p className="text-xs text-body/70">Available</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-heading mb-2">Beds</h3>
            {loading ? (
              <p className="text-sm text-body/60">Loading beds…</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {beds.map((bed) => (
                  <div
                    key={bed.id}
                    className="flex items-center justify-between border border-border rounded-btn px-3 py-2 gap-2"
                  >
                    <span className="text-sm font-medium text-body">{bed.bed_label}</span>
                    <div className="flex items-center gap-2">
                      <BedStatusBadge status={bed.status} size="sm" />
                      {bed.status === 'vacant' && !isAdmin && (
                        <button
                          onClick={() => goApply(bed)}
                          className="text-xs font-semibold text-link hover:underline"
                        >
                          Apply
                        </button>
                      )}
                      {isAdmin && bed.status === 'occupied' && (
                        <button
                          onClick={() => handleFreeBed(bed)}
                          disabled={releasingBedId === bed.id}
                          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                        >
                          {releasingBedId === bed.id ? 'Freeing…' : 'Free bed'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-heading mb-2">Facilities</h3>
            {room.facilities && room.facilities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {room.facilities.map((f) => (
                  <span
                    key={f}
                    className="text-xs bg-info-bg text-info-text rounded-full px-3 py-1"
                  >
                    {f}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-body/60">No facilities listed.</p>
            )}
          </div>

          {!isAdmin && (
            <div className="flex flex-col gap-2">
              {!user && (
                <div className="info-callout">
                  <button onClick={() => navigate('/login')} className="font-semibold underline">
                    Sign in
                  </button>{' '}
                  to apply for a bed in this room.
                </div>
              )}
              {user && (
                <button onClick={() => goApply(null)} className="btn-primary w-full justify-center">
                  Apply for this room →
                </button>
              )}
            </div>
          )}

          {isAdmin && (
            <div className="info-callout">
              Admin view: freeing a bed here immediately checks the waitlist for a match.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
