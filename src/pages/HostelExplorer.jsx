import { useEffect, useState } from 'react'
import Breadcrumb from '../components/Breadcrumb'
import RoomCard, { getRoomAggregateStatus } from '../components/RoomCard'
import RoomDetailPanel from '../components/RoomDetailPanel'
import WaitlistPromotionModal from '../components/admin/WaitlistPromotionModal'
import {
  fetchHostels,
  findNextLevel,
  fetchBedsForRooms,
  searchRoomsByNumber,
} from '../lib/hierarchy'

const LEVEL_LABEL = { block: 'Block', floor: 'Floor', flat: 'Flat', room: 'Room' }

export default function HostelExplorer() {
  const [hostels, setHostels] = useState([])
  const [loadingHostels, setLoadingHostels] = useState(true)

  const [selectedHostel, setSelectedHostel] = useState(null)
  const [path, setPath] = useState({ block: null, floor: null, flat: null })
  const [levelData, setLevelData] = useState(null) // { level, items }
  const [loadingLevel, setLoadingLevel] = useState(false)
  const [error, setError] = useState(null)

  const [roomBeds, setRoomBeds] = useState({}) // room_id -> beds[]
  const [selectedRoom, setSelectedRoom] = useState(null)

  const [availableOnly, setAvailableOnly] = useState(false)
  const [roomTypeFilter, setRoomTypeFilter] = useState('all')

  const [globalQuery, setGlobalQuery] = useState('')
  const [globalResults, setGlobalResults] = useState(null)
  const [globalSearching, setGlobalSearching] = useState(false)

  const [promotionTarget, setPromotionTarget] = useState(null) // { room, freedBedId }

  async function refreshRoomBeds(roomIds) {
    if (!roomIds || roomIds.length === 0) return
    const beds = await fetchBedsForRooms(roomIds)
    const grouped = {}
    for (const bed of beds) {
      grouped[bed.room_id] = grouped[bed.room_id] || []
      grouped[bed.room_id].push(bed)
    }
    setRoomBeds((prev) => ({ ...prev, ...grouped }))
  }

  function handleBedReleased(room, freedBedId) {
    // Keep the room grid's aggregate status in sync immediately, then offer
    // to promote a matching waitlisted applicant into the freed bed.
    if (levelData?.level === 'room') {
      refreshRoomBeds(levelData.items.map((r) => r.id))
    }
    setPromotionTarget({ room, freedBedId })
  }

  useEffect(() => {
    fetchHostels()
      .then(setHostels)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingHostels(false))
  }, [])

  useEffect(() => {
    // Guard: don't fire a query until a real hostel id exists — prevents
    // an undefined id from ever reaching findNextLevel().
    if (!selectedHostel?.id) {
      setLevelData(null)
      return
    }

    let cancelled = false
    setLoadingLevel(true)
    setError(null) // clear any stale error from a prior level before refetching

    findNextLevel(selectedHostel.id, path)
      .then(async (result) => {
        if (cancelled) return
        setLevelData(result)
        if (result.level === 'room' && result.items.length > 0) {
          const beds = await fetchBedsForRooms(result.items.map((r) => r.id))
          if (cancelled) return
          const grouped = {}
          for (const bed of beds) {
            grouped[bed.room_id] = grouped[bed.room_id] || []
            grouped[bed.room_id].push(bed)
          }
          setRoomBeds(grouped)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoadingLevel(false)
      })

    // If the user navigates again before this resolves, ignore this
    // fetch's outcome entirely so a stale error/result can't land after
    // a newer navigation has already moved the screen on.
    return () => {
      cancelled = true
    }
  }, [selectedHostel, path])

  function selectHostel(hostel) {
    setSelectedHostel(hostel)
    setPath({ block: null, floor: null, flat: null })
    setLevelData(null)
    setGlobalResults(null)
  }

  function selectLevelItem(levelKey, item) {
    setPath((prev) => ({ ...prev, [levelKey]: item }))
  }

  function goToCrumb(index) {
    // index 0 = hostel root, 1 = block, 2 = floor, 3 = flat
    if (index === 0) {
      setPath({ block: null, floor: null, flat: null })
      return
    }
    const order = ['block', 'floor', 'flat']
    const next = { block: null, floor: null, flat: null }
    for (let i = 0; i < index; i++) {
      next[order[i]] = path[order[i]]
    }
    setPath(next)
  }

  async function runGlobalSearch(query) {
    setGlobalQuery(query)
    if (!query.trim()) {
      setGlobalResults(null)
      return
    }
    setGlobalSearching(true)
    try {
      const results = await searchRoomsByNumber(query.trim())
      setGlobalResults(results)
    } catch (err) {
      setError(err.message)
    } finally {
      setGlobalSearching(false)
    }
  }

  const crumbs = selectedHostel
    ? [
        { label: selectedHostel.name },
        ...['block', 'floor', 'flat']
          .filter((k) => path[k])
          .map((k) => ({ label: path[k].name })),
      ]
    : []

  const roomTypes =
    levelData?.level === 'room'
      ? [...new Set(levelData.items.map((r) => r.room_type).filter(Boolean))]
      : []

  const visibleRooms =
    levelData?.level === 'room'
      ? levelData.items.filter((room) => {
          if (roomTypeFilter !== 'all' && room.room_type !== roomTypeFilter) return false
          if (availableOnly) {
            const beds = roomBeds[room.id] || []
            if (getRoomAggregateStatus(beds) !== 'available') return false
          }
          return true
        })
      : []

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Find a Room</h1>
        <p className="text-body/70 text-sm">
          Browse hostel structure, see bed-level availability, and apply for a bed.
        </p>
      </div>

      <div className="card p-4 mb-6">
        <label className="text-xs font-semibold text-heading uppercase tracking-wide mb-1 block">
          Search by room number (all hostels)
        </label>
        <input
          type="text"
          value={globalQuery}
          onChange={(e) => runGlobalSearch(e.target.value)}
          placeholder="e.g. 204"
          className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
        />
      </div>

      {globalResults && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-heading mb-3">
            {globalSearching
              ? 'Searching…'
              : `${globalResults.length} room${globalResults.length === 1 ? '' : 's'} found`}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {globalResults.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className="card p-3 text-left hover:shadow-md transition-shadow"
              >
                <p className="font-semibold text-heading">Room {room.room_number}</p>
                <p className="text-xs text-body/70">{room.hostels?.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 text-red-700 text-sm rounded-btn px-4 py-3">{error}</div>
      )}

      {!selectedHostel && (
        <>
          <h2 className="text-sm font-semibold text-heading mb-3">Hostels</h2>
          {loadingHostels ? (
            <p className="text-sm text-body/60">Loading hostels…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {hostels.map((hostel) => (
                <button
                  key={hostel.id}
                  onClick={() => selectHostel(hostel)}
                  className="card p-5 text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-heading text-lg">{hostel.name}</h3>
                    <span className="text-xs uppercase tracking-wide bg-info-bg text-info-text rounded-full px-2 py-1">
                      {hostel.gender}
                    </span>
                  </div>
                  <p className="text-sm text-body/70">{hostel.campus_location}</p>
                  <p className="text-sm text-body/70 mt-1">
                    {hostel.total_bed_capacity} beds total
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selectedHostel && (
        <>
          <Breadcrumb crumbs={crumbs} onNavigate={goToCrumb} />
          <button
            onClick={() => {
              setSelectedHostel(null)
              setLevelData(null)
            }}
            className="text-xs text-link hover:underline mb-4 inline-block"
          >
            ← All hostels
          </button>

          {loadingLevel && <p className="text-sm text-body/60">Loading…</p>}

          {!loadingLevel && levelData && levelData.level !== 'room' && (
            <div>
              <h2 className="text-sm font-semibold text-heading mb-3">
                {LEVEL_LABEL[levelData.level]}s
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {levelData.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectLevelItem(levelData.level, item)}
                    className="card p-4 text-center hover:shadow-md transition-shadow font-medium text-heading"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loadingLevel && levelData && levelData.level === 'room' && (
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h2 className="text-sm font-semibold text-heading mr-auto">Rooms</h2>

                {roomTypes.length > 0 && (
                  <select
                    value={roomTypeFilter}
                    onChange={(e) => setRoomTypeFilter(e.target.value)}
                    className="text-sm border border-border rounded-btn px-2 py-1.5"
                  >
                    <option value="all">All room types</option>
                    {roomTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}

                <label className="flex items-center gap-2 text-sm text-body">
                  <input
                    type="checkbox"
                    checked={availableOnly}
                    onChange={(e) => setAvailableOnly(e.target.checked)}
                    className="rounded border-border text-brand-primary focus:ring-brand-primary-light"
                  />
                  Show available rooms only
                </label>
              </div>

              {visibleRooms.length === 0 ? (
                <p className="text-sm text-body/60">No rooms match the current filters.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {visibleRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      beds={roomBeds[room.id] || []}
                      onClick={() => setSelectedRoom(room)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {selectedRoom && (
        <RoomDetailPanel
          room={selectedRoom}
          hostel={selectedHostel || hostels.find((h) => h.id === selectedRoom.hostel_id)}
          onClose={() => setSelectedRoom(null)}
          onBedReleased={handleBedReleased}
        />
      )}

      {promotionTarget && (
        <WaitlistPromotionModal
          room={promotionTarget.room}
          freedBedId={promotionTarget.freedBedId}
          onClose={() => setPromotionTarget(null)}
          onPromoted={() => {
            setPromotionTarget(null)
            if (levelData?.level === 'room') {
              refreshRoomBeds(levelData.items.map((r) => r.id))
            }
          }}
        />
      )}
    </div>
  )
}
