import { useEffect, useState } from 'react'
import { fetchStudentDirectory } from '../../lib/roster'
import { fetchMyAssignedHostels } from '../../lib/complaints'
import BackButton from '../../components/BackButton'

export default function StudentDirectory() {
  const [students, setStudents] = useState([])
  const [assignedHostels, setAssignedHostels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([fetchStudentDirectory(), fetchMyAssignedHostels()])
      .then(([directory, hostels]) => {
        setStudents(directory)
        setAssignedHostels(hostels)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl mx-auto">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Student Directory</h1>
        <p className="text-body/70 text-sm">
          {assignedHostels.length > 0
            ? `Allocated students in: ${assignedHostels.map((h) => h.name).join(', ')}`
            : 'No hostel assignment yet — contact admin.'}
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-body/60">Loading…</p>}

      {!loading && students.length === 0 && (
        <p className="text-sm text-body/60">No allocated students in your hostel(s) yet.</p>
      )}

      <div className="space-y-2">
        {students.map((s) => (
          <div key={s.allocationId} className="card p-4">
            <div className="flex items-start justify-between mb-1">
              <p className="font-semibold text-heading">{s.studentName}</p>
              <span className="text-xs text-body/60">Year {s.yearOfStudy}</span>
            </div>
            <p className="text-xs text-body/60">
              {s.studentNumber} · {s.programme}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-body mt-2">
              <p>
                <span className="text-body/50">
                  {s.idDocumentType === 'passport' ? 'Passport' : 'NRC'}:
                </span>{' '}
                {s.idDocumentNumber}
              </p>
              <p>
                <span className="text-body/50">Phone:</span> {s.phoneNumber}
              </p>
              <p className="col-span-2">
                <span className="text-body/50">Location:</span> {s.hostelName}
                {s.blockName && ` / ${s.blockName}`}
                {s.floorName && ` / ${s.floorName}`}
                {s.flatName && ` / ${s.flatName}`} · Room {s.roomNumber} · {s.bedLabel}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
