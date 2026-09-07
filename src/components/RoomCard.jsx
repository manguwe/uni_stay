const AGGREGATE_STYLES = {
  available: { border: 'border-status-available', dot: '🟢', label: 'Available' },
  full: { border: 'border-status-occupied', dot: '🔴', label: 'Full' },
  reserved: { border: 'border-status-reserved', dot: '🟡', label: 'Reserved' },
  unavailable: { border: 'border-status-unavailable', dot: '⚫', label: 'Unavailable' },
}

export function getRoomAggregateStatus(beds) {
  if (!beds || beds.length === 0) return 'unavailable'
  if (beds.some((b) => b.status === 'vacant')) return 'available'
  if (beds.some((b) => b.status === 'reserved')) return 'reserved'
  if (beds.every((b) => b.status === 'occupied')) return 'full'
  return 'unavailable'
}

export default function RoomCard({ room, beds, onClick }) {
  const aggregate = getRoomAggregateStatus(beds)
  const style = AGGREGATE_STYLES[aggregate]
  const occupied = beds.filter((b) => b.status === 'occupied').length
  const available = beds.filter((b) => b.status === 'vacant').length

  return (
    <button
      onClick={onClick}
      className={`card border-l-4 ${style.border} p-4 text-left w-full hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-heading">Room {room.room_number}</h3>
        <span className="text-lg" aria-hidden="true">
          {style.dot}
        </span>
      </div>
      <p className="text-xs text-body/70 mb-3">{room.room_type || 'Standard'}</p>
      <div className="flex items-center justify-between text-sm">
        <span className="text-body">
          {occupied} / {room.bed_capacity} occupied
        </span>
        <span className="font-medium text-heading">{available} available</span>
      </div>
    </button>
  )
}
