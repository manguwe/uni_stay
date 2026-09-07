const STATUS_MAP = {
  vacant: { label: 'Available', dot: '🟢', className: 'bg-status-available/10 text-emerald-700' },
  occupied: { label: 'Occupied', dot: '🔴', className: 'bg-status-occupied/10 text-red-700' },
  reserved: { label: 'Reserved', dot: '🟡', className: 'bg-status-reserved/10 text-amber-700' },
  maintenance: { label: 'Maintenance', dot: '⚫', className: 'bg-status-unavailable/10 text-gray-600' },
}

export default function BedStatusBadge({ status, size = 'md' }) {
  const meta = STATUS_MAP[status] || STATUS_MAP.maintenance
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass} ${meta.className}`}
    >
      <span aria-hidden="true">{meta.dot}</span>
      {meta.label}
    </span>
  )
}

export { STATUS_MAP }
