import { useEffect, useState } from 'react'
import { updateUserRole, setStaffHostelAssignments } from '../../lib/userManagement'
import { fetchHostels } from '../../lib/hierarchy'
import { Modal } from './AllocateBedModal'

export default function EditUserModal({ user, currentHostelIds, onClose, onSaved }) {
  const [role, setRole] = useState(user.role)
  const [hostels, setHostels] = useState([])
  const [selectedHostelIds, setSelectedHostelIds] = useState(new Set(currentHostelIds))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const needsHostels = role === 'chairperson' || role === 'patron_matron'

  useEffect(() => {
    if (needsHostels) {
      fetchHostels().then(setHostels).catch((err) => setError(err.message))
    }
  }, [needsHostels])

  function toggleHostel(id) {
    setSelectedHostelIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (role !== user.role) {
        await updateUserRole(user.id, role)
      }
      if (needsHostels) {
        await setStaffHostelAssignments(user.id, Array.from(selectedHostelIds))
      } else {
        // Switching away from a staff role — clear any stale assignments
        // so they don't linger invisibly if the role changes back later.
        await setStaffHostelAssignments(user.id, [])
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Edit role — ${user.full_name || user.email}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-body block mb-1">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
            <option value="student">Student</option>
            <option value="chairperson">Chairperson</option>
            <option value="patron_matron">Patron/Matron</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {needsHostels && (
          <div>
            <label className="text-sm font-medium text-body block mb-1">Assigned hostel(s)</label>
            <div className="space-y-1 max-h-48 overflow-y-auto border border-border rounded-btn p-2">
              {hostels.map((h) => (
                <label key={h.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedHostelIds.has(h.id)}
                    onChange={() => toggleHostel(h.id)}
                    className="rounded border-border text-brand-primary focus:ring-brand-primary-light"
                  />
                  {h.name}
                </label>
              ))}
              {hostels.length === 0 && <p className="text-xs text-body/50">No hostels yet.</p>}
            </div>
            <p className="text-xs text-body/50 mt-1">
              A chairperson/patron can be assigned to more than one hostel.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
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
