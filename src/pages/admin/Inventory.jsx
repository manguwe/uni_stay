import { useEffect, useState } from 'react'
import { fetchHostels, fetchBlocksForHostel, fetchFloorsForParent, fetchFlatsForParent } from '../../lib/hierarchy'
import {
  createHostel,
  updateHostel,
  deleteHostel,
  createBlock,
  deleteBlock,
  createFloor,
  deleteFloor,
  createFlat,
  deleteFlat,
  fetchRoomsForHostelAdmin,
  createRoom,
  updateRoom,
  deleteRoom,
  createBed,
  updateBedStatus,
  deleteBed,
} from '../../lib/inventory'
import { Modal } from '../../components/admin/AllocateBedModal'
import BedStatusBadge from '../../components/BedStatusBadge'

export default function Inventory() {
  const [hostels, setHostels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedHostel, setSelectedHostel] = useState(null)
  const [tab, setTab] = useState('structure')

  const [hostelModal, setHostelModal] = useState(null) // null | 'new' | hostel object being edited

  function loadHostels() {
    setLoading(true)
    fetchHostels()
      .then(setHostels)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadHostels()
  }, [])

  async function handleDeleteHostel(hostel) {
    if (!confirm(`Delete "${hostel.name}"? This removes everything under it that has no occupied beds.`)) return
    try {
      await deleteHostel(hostel.id)
      if (selectedHostel?.id === hostel.id) setSelectedHostel(null)
      loadHostels()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl mb-1">Inventory Management</h1>
          <p className="text-body/70 text-sm">Hostels, blocks/floors/flats, rooms, and beds.</p>
        </div>
        {!selectedHostel && (
          <button onClick={() => setHostelModal('new')} className="btn-primary">
            + Add Hostel
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-body/60">Loading…</p>}

      {!loading && !selectedHostel && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {hostels.map((h) => (
            <div key={h.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-heading">{h.name}</h3>
                  <p className="text-xs text-body/60 capitalize">{h.gender} · {h.campus_location}</p>
                </div>
                <span className="text-xs bg-info-bg text-info-text rounded-full px-2 py-1">
                  cap. {h.total_bed_capacity}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setSelectedHostel(h)} className="btn-primary text-xs px-3 py-1.5">
                  Manage →
                </button>
                <button
                  onClick={() => setHostelModal(h)}
                  className="text-xs px-3 py-1.5 rounded-btn border border-border font-semibold hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteHostel(h)}
                  className="text-xs px-3 py-1.5 rounded-btn border border-red-300 text-red-700 font-semibold hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedHostel && (
        <>
          <button
            onClick={() => setSelectedHostel(null)}
            className="text-xs text-link hover:underline mb-4 inline-block"
          >
            ← All hostels
          </button>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-heading">{selectedHostel.name}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setHostelModal(selectedHostel)}
                className="text-xs px-3 py-1.5 rounded-btn border border-border font-semibold hover:bg-gray-50"
              >
                Edit Hostel
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-5">
            <TabButton active={tab === 'structure'} onClick={() => setTab('structure')}>
              Structure
            </TabButton>
            <TabButton active={tab === 'rooms'} onClick={() => setTab('rooms')}>
              Rooms &amp; Beds
            </TabButton>
          </div>

          {tab === 'structure' && <StructureTab hostel={selectedHostel} />}
          {tab === 'rooms' && <RoomsTab hostel={selectedHostel} />}
        </>
      )}

      {hostelModal && (
        <HostelFormModal
          hostel={hostelModal === 'new' ? null : hostelModal}
          onClose={() => setHostelModal(null)}
          onSaved={(saved) => {
            setHostelModal(null)
            loadHostels()
            if (selectedHostel && saved) setSelectedHostel(saved)
          }}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-btn text-sm font-semibold ${
        active ? 'bg-brand-primary text-white' : 'border border-border text-body hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Hostel form
// ---------------------------------------------------------------------------
function HostelFormModal({ hostel, onClose, onSaved }) {
  const [name, setName] = useState(hostel?.name || '')
  const [gender, setGender] = useState(hostel?.gender || 'mixed')
  const [campusLocation, setCampusLocation] = useState(hostel?.campus_location || '')
  const [totalBedCapacity, setTotalBedCapacity] = useState(hostel?.total_bed_capacity || 0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (hostel) {
        await updateHostel(hostel.id, { name, gender, campusLocation, totalBedCapacity: Number(totalBedCapacity) })
        onSaved({ ...hostel, name, gender })
      } else {
        const created = await createHostel({ name, gender, campusLocation, totalBedCapacity: Number(totalBedCapacity) })
        onSaved(created)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={hostel ? 'Edit Hostel' : 'Add Hostel'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Name">
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <Field label="Gender designation">
          <select value={gender} onChange={(e) => setGender(e.target.value)} className="input">
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="mixed">Mixed</option>
          </select>
        </Field>
        <Field label="Campus location">
          <input value={campusLocation} onChange={(e) => setCampusLocation(e.target.value)} className="input" />
        </Field>
        <Field label="Declared total bed capacity">
          <input
            type="number"
            min="0"
            value={totalBedCapacity}
            onChange={(e) => setTotalBedCapacity(e.target.value)}
            className="input"
          />
          <p className="text-xs text-body/50 mt-1">
            Planning figure — may exceed beds actually built yet. See "actual beds" in Rooms &amp;
            Beds.
          </p>
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-btn border border-border text-sm font-semibold hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Structure tab — flat lists for blocks/floors/flats (KB §6: purely
// organizational, optional at every level)
// ---------------------------------------------------------------------------
function StructureTab({ hostel }) {
  const [blocks, setBlocks] = useState([])
  const [floors, setFloors] = useState([])
  const [flats, setFlats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Floors and flats are per-parent in the schema (KB §6 flexible
  // hierarchy), so "every floor/flat in this hostel" needs a small fan-out
  // across blocks/floors rather than one query — fine at prototype scale.
  async function fetchAllFloorsForHostel(hostelId) {
    const noBlockFloors = await fetchFloorsForParent(hostelId, null)
    const blocksForHostel = await fetchBlocksForHostel(hostelId)
    const perBlock = await Promise.all(blocksForHostel.map((b) => fetchFloorsForParent(hostelId, b.id)))
    return [...noBlockFloors, ...perBlock.flat()]
  }

  async function fetchAllFlatsForHostel(hostelId, allFloors) {
    const results = await Promise.all(allFloors.map((fl) => fetchFlatsForParent(hostelId, fl.id)))
    return results.flat()
  }

  function load() {
    setLoading(true)
    fetchBlocksForHostel(hostel.id)
      .then(async (b) => {
        setBlocks(b)
        const allFloors = await fetchAllFloorsForHostel(hostel.id)
        setFloors(allFloors)
        const allFlats = await fetchAllFlatsForHostel(hostel.id, allFloors)
        setFlats(allFlats)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [hostel.id])

  if (loading) return <p className="text-sm text-body/60">Loading…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <NameListPanel
        title="Blocks"
        items={blocks}
        onAdd={(name) => createBlock({ hostelId: hostel.id, name }).then(load)}
        onDelete={(id) => deleteBlock(id).then(load).catch((err) => alert(err.message))}
      />
      <NameListPanel
        title="Floors"
        items={floors}
        onAdd={(name) => createFloor({ hostelId: hostel.id, blockId: null, name }).then(load)}
        onDelete={(id) => deleteFloor(id).then(load).catch((err) => alert(err.message))}
        hint="New floors here aren't tied to a block. Use the room form to place a room under a specific block's floor if needed."
      />
      <NameListPanel
        title="Flats"
        items={flats}
        onAdd={() => alert('Add a flat via the Room form when picking a floor — flats need a floor parent.')}
        onDelete={(id) => deleteFlat(id).then(load).catch((err) => alert(err.message))}
        addDisabled
      />
    </div>
  )
}

function NameListPanel({ title, items, onAdd, onDelete, hint, addDisabled }) {
  const [newName, setNewName] = useState('')
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-heading mb-2">{title}</h3>
      {hint && <p className="text-xs text-body/50 mb-2">{hint}</p>}
      <ul className="space-y-1 mb-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between text-sm border border-border rounded-btn px-2 py-1.5">
            {item.name}
            <button onClick={() => onDelete(item.id)} className="text-xs text-red-600 hover:underline">
              Delete
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-body/50">None yet.</li>}
      </ul>
      {!addDisabled && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            onAdd(newName.trim())
            setNewName('')
          }}
          className="flex gap-2"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            className="input flex-1"
          />
          <button type="submit" className="text-xs px-3 rounded-btn border border-border font-semibold hover:bg-gray-50">
            Add
          </button>
        </form>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rooms & Beds tab
// ---------------------------------------------------------------------------
function RoomsTab({ hostel }) {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [roomModal, setRoomModal] = useState(null) // null | 'new' | room
  const [expandedRoomId, setExpandedRoomId] = useState(null)

  function load() {
    setLoading(true)
    fetchRoomsForHostelAdmin(hostel.id)
      .then(setRooms)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [hostel.id])

  async function handleDeleteRoom(room) {
    if (!confirm(`Delete Room ${room.room_number}?`)) return
    try {
      await deleteRoom(room.id)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setRoomModal('new')} className="btn-primary text-sm">
          + Add Room
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading && <p className="text-sm text-body/60">Loading…</p>}

      <div className="space-y-3">
        {rooms.map((room) => {
          const occupied = (room.beds || []).filter((b) => b.status === 'occupied').length
          const location = [room.blocks?.name, room.floors?.name, room.flats?.name].filter(Boolean).join(' / ')
          const expanded = expandedRoomId === room.id
          return (
            <div key={room.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-heading">
                    Room {room.room_number} <span className="text-xs text-body/50 font-normal">{room.room_type}</span>
                  </p>
                  <p className="text-xs text-body/60">{location || 'Directly under hostel'}</p>
                  <p className="text-xs text-body/60 mt-0.5">
                    {occupied}/{room.bed_capacity} occupied · {(room.beds || []).length} beds built
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setExpandedRoomId(expanded ? null : room.id)}
                    className="text-xs px-3 py-1.5 rounded-btn border border-border font-semibold hover:bg-gray-50"
                  >
                    {expanded ? 'Hide beds' : 'Manage beds'}
                  </button>
                  <button
                    onClick={() => setRoomModal(room)}
                    className="text-xs px-3 py-1.5 rounded-btn border border-border font-semibold hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteRoom(room)}
                    className="text-xs px-3 py-1.5 rounded-btn border border-red-300 text-red-700 font-semibold hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expanded && <BedManager room={room} onChanged={load} />}
            </div>
          )
        })}
      </div>

      {roomModal && (
        <RoomFormModal
          hostel={hostel}
          room={roomModal === 'new' ? null : roomModal}
          onClose={() => setRoomModal(null)}
          onSaved={() => {
            setRoomModal(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function BedManager({ room, onChanged }) {
  const [newLabel, setNewLabel] = useState('')
  const [error, setError] = useState(null)

  async function handleAddBed(e) {
    e.preventDefault()
    if (!newLabel.trim()) return
    try {
      await createBed({ roomId: room.id, bedLabel: newLabel.trim(), status: 'vacant' })
      setNewLabel('')
      onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleStatusChange(bedId, status) {
    try {
      await updateBedStatus(bedId, status)
      onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteBed(bedId) {
    try {
      await deleteBed(bedId)
      onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        {(room.beds || []).map((bed) => (
          <div key={bed.id} className="flex items-center justify-between border border-border rounded-btn px-3 py-2">
            <span className="text-sm font-medium text-body">{bed.bed_label}</span>
            <div className="flex items-center gap-2">
              <BedStatusBadge status={bed.status} size="sm" />
              <select
                value={bed.status}
                onChange={(e) => handleStatusChange(bed.id, e.target.value)}
                className="text-xs border border-border rounded-btn px-1.5 py-1"
              >
                <option value="vacant">Vacant</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <button onClick={() => handleDeleteBed(bed.id)} className="text-xs text-red-600 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleAddBed} className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Bed label (e.g. Bed 3)"
          className="input flex-1"
        />
        <button type="submit" className="text-xs px-3 rounded-btn border border-border font-semibold hover:bg-gray-50">
          Add Bed
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Room form — cascading block/floor/flat, matching the same flexible
// hierarchy pattern as the student Apply form
// ---------------------------------------------------------------------------
function RoomFormModal({ hostel, room, onClose, onSaved }) {
  const [blocks, setBlocks] = useState([])
  const [floors, setFloors] = useState([])
  const [flats, setFlats] = useState([])

  const [blockId, setBlockId] = useState(room?.block_id || '')
  const [floorId, setFloorId] = useState(room?.floor_id || '')
  const [flatId, setFlatId] = useState(room?.flat_id || '')
  const [roomNumber, setRoomNumber] = useState(room?.room_number || '')
  const [roomType, setRoomType] = useState(room?.room_type || '')
  const [bedCapacity, setBedCapacity] = useState(room?.bed_capacity || 2)
  const [facilitiesText, setFacilitiesText] = useState((room?.facilities || []).join(', '))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchBlocksForHostel(hostel.id).then(setBlocks)
  }, [hostel.id])
  useEffect(() => {
    fetchFloorsForParent(hostel.id, blockId || null).then(setFloors)
  }, [hostel.id, blockId])
  useEffect(() => {
    if (!floorId) {
      setFlats([])
      return
    }
    fetchFlatsForParent(hostel.id, floorId).then(setFlats)
  }, [hostel.id, floorId])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const facilities = facilitiesText
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)
    try {
      if (room) {
        await updateRoom(room.id, { roomNumber, roomType, bedCapacity: Number(bedCapacity), facilities })
      } else {
        await createRoom({
          hostelId: hostel.id,
          blockId: blockId || null,
          floorId: floorId || null,
          flatId: flatId || null,
          roomNumber,
          roomType,
          bedCapacity: Number(bedCapacity),
          facilities,
        })
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={room ? 'Edit Room' : 'Add Room'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {!room && (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Block (optional)">
              <select value={blockId} onChange={(e) => { setBlockId(e.target.value); setFloorId(''); setFlatId('') }} className="input">
                <option value="">None</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Floor (optional)">
              <select value={floorId} onChange={(e) => { setFloorId(e.target.value); setFlatId('') }} className="input">
                <option value="">None</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Flat (optional)">
              <select value={flatId} onChange={(e) => setFlatId(e.target.value)} className="input" disabled={!floorId}>
                <option value="">None</option>
                {flats.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <Field label="Room number">
          <input required value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className="input" />
        </Field>
        <Field label="Room type">
          <input
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            placeholder="e.g. 2-bed, 4-bed"
            className="input"
          />
        </Field>
        <Field label="Bed capacity">
          <input
            type="number"
            min="1"
            required
            value={bedCapacity}
            onChange={(e) => setBedCapacity(e.target.value)}
            className="input"
          />
          {room && (
            <p className="text-xs text-body/50 mt-1">
              Reducing this below the number of currently-occupied beds will be rejected.
            </p>
          )}
        </Field>
        <Field label="Facilities (comma-separated)">
          <input
            value={facilitiesText}
            onChange={(e) => setFacilitiesText(e.target.value)}
            placeholder="Wardrobe, Study desk, Power outlet"
            className="input"
          />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-btn border border-border text-sm font-semibold hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
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
