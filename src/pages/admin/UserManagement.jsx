import { useEffect, useState } from 'react'
import {
  fetchAllUsers,
  fetchAllStaffAssignments,
  fetchActiveAllocationsByStudent,
} from '../../lib/userManagement'
import EditUserModal from '../../components/admin/EditUserModal'
import BackButton from '../../components/BackButton'

const ROLE_LABEL = {
  student: 'Student',
  chairperson: 'Chairperson',
  patron_matron: 'Patron/Matron',
  admin: 'Admin',
}

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [allocationsByStudent, setAllocationsByStudent] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [roleFilter, setRoleFilter] = useState('all')

  function load() {
    setLoading(true)
    setError(null)
    Promise.all([fetchAllUsers(), fetchAllStaffAssignments(), fetchActiveAllocationsByStudent()])
      .then(([u, a, alloc]) => {
        setUsers(u)
        setAssignments(a)
        setAllocationsByStudent(alloc)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const assignmentsByProfile = {}
  for (const a of assignments) {
    assignmentsByProfile[a.profile_id] = assignmentsByProfile[a.profile_id] || []
    assignmentsByProfile[a.profile_id].push(a.hostels?.name)
  }

  const visibleUsers = users.filter((u) => roleFilter === 'all' || u.role === roleFilter)

  return (
    <div className="max-w-5xl mx-auto">
      <BackButton />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl mb-1">User Management</h1>
          <p className="text-body/70 text-sm">
            Change roles and hostel assignments — this replaces the manual SQL promotion process
            used in earlier phases.
          </p>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="all">All roles</option>
          <option value="student">Students</option>
          <option value="chairperson">Chairpersons</option>
          <option value="patron_matron">Patron/Matron</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-body/60">Loading…</p>}

      {!loading && (
        <div className="space-y-2">
          {visibleUsers.map((u) => {
            const isComplete = !!(u.full_name && u.student_number && u.gender)
            const allocation = allocationsByStudent[u.id]
            const hostelNames = assignmentsByProfile[u.id] || []

            return (
              <div key={u.id} className="card p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-heading truncate">{u.full_name || u.email || 'Unnamed'}</p>
                  <p className="text-xs text-body/60 truncate">
                    {u.email} {u.student_number && `· ${u.student_number}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-xs bg-info-bg text-info-text rounded-full px-2 py-0.5">
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                    {u.role === 'student' && (
                      <span className={`text-xs rounded-full px-2 py-0.5 ${isComplete ? 'bg-status-available/10 text-emerald-700' : 'bg-status-reserved/10 text-amber-700'}`}>
                        {isComplete ? 'Profile complete' : 'Profile incomplete'}
                      </span>
                    )}
                    {allocation && (
                      <span className="text-xs text-body/60">
                        {allocation.hostelName} · Room {allocation.roomNumber} · {allocation.bedLabel}
                      </span>
                    )}
                    {hostelNames.length > 0 && (
                      <span className="text-xs text-body/60">Assigned: {hostelNames.join(', ')}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setEditingUser(u)}
                  className="text-xs px-3 py-1.5 rounded-btn border border-border font-semibold hover:bg-gray-50 shrink-0"
                >
                  Edit Role
                </button>
              </div>
            )
          })}
          {visibleUsers.length === 0 && (
            <p className="text-sm text-body/60">No users match this filter.</p>
          )}
        </div>
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          currentHostelIds={assignments.filter((a) => a.profile_id === editingUser.id).map((a) => a.hostel_id)}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null)
            load()
          }}
        />
      )}
    </div>
  )
}
