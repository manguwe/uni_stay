const STATUS_MAP = {
  submitted: { label: 'Submitted', className: 'bg-gray-100 text-gray-700' },
  under_review: { label: 'Under Review', className: 'bg-info-bg text-info-text' },
  approved: { label: 'Approved', className: 'bg-status-available/10 text-emerald-700' },
  waitlisted: { label: 'Waitlisted', className: 'bg-status-reserved/10 text-amber-700' },
  rejected: { label: 'Rejected', className: 'bg-status-occupied/10 text-red-700' },
}

export default function ApplicationStatusBadge({ status, size = 'md' }) {
  const meta = STATUS_MAP[status] || STATUS_MAP.submitted
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${meta.className}`}>
      {meta.label}
    </span>
  )
}
