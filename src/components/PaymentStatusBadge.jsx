const STATUS_MAP = {
  unpaid: { label: 'Unpaid', className: 'bg-gray-100 text-gray-700' },
  awaiting_verification: { label: 'Awaiting Verification', className: 'bg-info-bg text-info-text' },
  confirmed: { label: 'Confirmed', className: 'bg-status-available/10 text-emerald-700' },
  rejected: { label: 'Rejected', className: 'bg-status-occupied/10 text-red-700' },
}

export default function PaymentStatusBadge({ status, size = 'md' }) {
  const meta = STATUS_MAP[status] || STATUS_MAP.unpaid
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${meta.className}`}>
      {meta.label}
    </span>
  )
}
