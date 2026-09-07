import ApplicationStatusBadge from '../ApplicationStatusBadge'

function locationLabel(app) {
  const parts = [app.hostels?.name]
  if (app.blocks?.name) parts.push(app.blocks.name)
  if (app.floors?.name) parts.push(app.floors.name)
  if (app.flats?.name) parts.push(app.flats.name)
  if (app.rooms?.room_number) parts.push(`Room ${app.rooms.room_number}`)
  return parts.filter(Boolean).join(' / ')
}

export default function ApplicationCard({ application, onMarkUnderReview, onAllocate, onWaitlist, onReject }) {
  const app = application
  const priorityNotes = [
    app.new_intake ? 'New intake' : null,
    app.medical_needs ? `Medical/disability: ${app.medical_needs}` : null,
  ].filter(Boolean)

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-heading">{app.profiles?.full_name}</p>
          <p className="text-xs text-body/60">
            {app.profiles?.student_number} · {app.profiles?.programme} · Year {app.year_of_study} ·{' '}
            {app.profiles?.gender}
          </p>
        </div>
        <ApplicationStatusBadge status={app.status} size="sm" />
      </div>

      <p className="text-sm text-body mb-1">{locationLabel(app)}</p>
      {app.beds?.bed_label && (
        <p className="text-xs text-body/60 mb-1">Preferred bed: {app.beds.bed_label}</p>
      )}

      {priorityNotes.length > 0 && (
        <ul className="text-xs text-body/70 list-disc list-inside mt-2 space-y-0.5">
          {priorityNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {app.notes && <p className="text-xs text-body/60 mt-2 italic">"{app.notes}"</p>}

      <p className="text-xs text-body/40 mt-3">
        Submitted {new Date(app.submitted_at).toLocaleDateString()}
      </p>

      <div className="flex flex-wrap gap-2 mt-4">
        {app.status === 'submitted' && (
          <button
            onClick={() => onMarkUnderReview(app.id)}
            className="text-xs px-3 py-1.5 rounded-btn border border-border font-semibold hover:bg-gray-50"
          >
            Mark Under Review
          </button>
        )}
        <button onClick={() => onAllocate(app)} className="text-xs btn-primary px-3 py-1.5">
          Allocate bed
        </button>
        <button
          onClick={() => onWaitlist(app.id)}
          className="text-xs px-3 py-1.5 rounded-btn border border-amber-300 text-amber-700 font-semibold hover:bg-amber-50"
        >
          Waitlist
        </button>
        <button
          onClick={() => onReject(app)}
          className="text-xs px-3 py-1.5 rounded-btn border border-red-300 text-red-700 font-semibold hover:bg-red-50"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
