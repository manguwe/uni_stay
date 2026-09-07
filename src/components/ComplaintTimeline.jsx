const ACTION_LABEL = {
  submitted: 'Submitted',
  reviewed: 'Marked under review',
  commented: 'Commented',
  escalated: 'Escalated to Patron/Matron',
  escalated_further: 'Escalated further to administration',
  assigned: 'Assigned',
  resolved: 'Resolved',
  rejected: 'Rejected',
  closed: 'Closed',
  admin_override: 'Admin override',
}

export default function ComplaintTimeline({ updates }) {
  if (!updates || updates.length === 0) {
    return <p className="text-sm text-body/60">No activity yet.</p>
  }

  return (
    <ol className="space-y-3">
      {updates.map((u) => (
        <li key={u.id} className="flex gap-3">
          <div className="w-2 h-2 rounded-full bg-brand-primary mt-1.5 shrink-0" />
          <div>
            <p className="text-sm text-body">
              <span className="font-semibold text-heading">{ACTION_LABEL[u.action] || u.action}</span>
              {u.profiles?.full_name && <span className="text-body/60"> · {u.profiles.full_name}</span>}
            </p>
            {u.comment && <p className="text-sm text-body/80 mt-0.5">{u.comment}</p>}
            <p className="text-xs text-body/40 mt-0.5">{new Date(u.created_at).toLocaleString()}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
