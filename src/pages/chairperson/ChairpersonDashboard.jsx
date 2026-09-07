import { useCallback, useEffect, useState } from 'react'
import { fetchStaffComplaints, fetchMyAssignedHostels, COMPLAINT_CATEGORIES } from '../../lib/complaints'
import StaffComplaintCard from '../../components/StaffComplaintCard'

const STATUS_GROUPS = [
  { key: 'new', label: 'New', statuses: ['submitted'] },
  { key: 'under_review', label: 'Under Review', statuses: ['under_review'] },
  { key: 'escalated', label: 'Escalated', statuses: ['escalated', 'assigned', 'in_progress'] },
  { key: 'resolved', label: 'Resolved', statuses: ['resolved', 'rejected', 'closed'] },
]

function actionsFor(complaint) {
  const actions = [{ action: 'commented', label: 'Add Comment', needsComment: true, className: 'border border-border text-body hover:bg-gray-50' }]

  if (complaint.status === 'submitted') {
    actions.push({
      action: 'reviewed',
      label: 'Mark Under Review',
      needsComment: false,
      className: 'border border-border text-body hover:bg-gray-50',
    })
  }
  if (!['resolved', 'rejected', 'closed'].includes(complaint.status)) {
    actions.push({
      action: 'escalated',
      label: 'Escalate to Patron/Matron',
      needsComment: false,
      className: 'border border-amber-300 text-amber-700 hover:bg-amber-50',
    })
    actions.push({
      action: 'resolved',
      label: 'Resolve',
      needsComment: true,
      className: 'bg-brand-primary text-white hover:bg-brand-primary-dark',
    })
  }
  return actions
}

export default function ChairpersonDashboard() {
  const [complaints, setComplaints] = useState([])
  const [assignedHostels, setAssignedHostels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('new')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [complaintsData, hostelsData] = await Promise.all([
        fetchStaffComplaints(),
        fetchMyAssignedHostels(),
      ])
      setComplaints(complaintsData)
      setAssignedHostels(hostelsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = Object.fromEntries(
    STATUS_GROUPS.map((g) => [g.key, complaints.filter((c) => g.statuses.includes(c.status)).length])
  )
  const visible = complaints
    .filter((c) => STATUS_GROUPS.find((g) => g.key === statusFilter)?.statuses.includes(c.status))
    .filter((c) => categoryFilter === 'all' || c.category === categoryFilter)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Chairperson — Complaints</h1>
        <p className="text-body/70 text-sm">
          {assignedHostels.length > 0
            ? `Assigned to: ${assignedHostels.map((h) => h.name).join(', ')}`
            : 'No hostel assignment yet — contact admin.'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {STATUS_GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setStatusFilter(g.key)}
            className={`card p-3 text-left ${statusFilter === g.key ? 'ring-2 ring-brand-primary-light' : ''}`}
          >
            <p className="text-2xl font-bold text-heading">{counts[g.key]}</p>
            <p className="text-xs text-body/70">{g.label}</p>
          </button>
        ))}
      </div>

      <div className="mb-6">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input w-auto">
          <option value="all">All categories</option>
          {COMPLAINT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-body/60">Loading…</p>}

      {!loading && visible.length === 0 && (
        <div className="card p-6 text-center text-sm text-body/60">
          Nothing in this category right now.
        </div>
      )}

      <div className="space-y-3">
        {visible.map((c) => (
          <StaffComplaintCard
            key={c.id}
            complaint={c}
            expanded={expandedId === c.id}
            onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
            actions={actionsFor(c)}
            onActionDone={load}
          />
        ))}
      </div>
    </div>
  )
}
