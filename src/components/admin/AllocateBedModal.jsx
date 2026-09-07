import { useEffect, useState } from 'react'
import { fetchAvailableBedsForApplication, allocateBed } from '../../lib/applications'

const SCOPE_LABEL = {
  room: 'their requested room',
  flat: 'their requested flat',
  floor: 'their requested floor',
  block: 'their requested block',
  hostel: 'the hostel (no closer match available)',
}

export default function AllocateBedModal({ application, onClose, onAllocated }) {
  const [beds, setBeds] = useState([])
  const [matchedScope, setMatchedScope] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedBedId, setSelectedBedId] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchAvailableBedsForApplication(application)
      .then(({ beds, matchedScope }) => {
        if (cancelled) return
        setBeds(beds)
        setMatchedScope(matchedScope)
        if (beds.length > 0) setSelectedBedId(beds[0].id)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [application])

  async function handleConfirm() {
    if (!selectedBedId) return
    setSubmitting(true)
    setError(null)
    try {
      await allocateBed({ applicationId: application.id, bedId: selectedBedId })
      onAllocated()
    } catch (err) {
      // Surfaces both the gender-mismatch message and the
      // "bed no longer available" race-condition message raised by the
      // allocate_bed() RPC, verbatim — this is the "block the action with
      // a clear message" requirement from the brief.
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Allocate a bed">
      <p className="text-sm text-body/70 mb-4">
        Applicant: <strong>{application.profiles?.full_name}</strong> ·{' '}
        {application.hostels?.name}
      </p>

      {loading && <p className="text-sm text-body/60">Finding available beds…</p>}

      {!loading && beds.length === 0 && (
        <p className="text-sm text-red-600">
          No available beds found anywhere in {application.hostels?.name}. Try waitlisting this
          application instead.
        </p>
      )}

      {!loading && beds.length > 0 && (
        <>
          {matchedScope && matchedScope !== 'room' && (
            <div className="info-callout mb-3">
              Their exact request wasn't available — showing beds from {SCOPE_LABEL[matchedScope]}.
            </div>
          )}
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {beds.map((bed) => (
              <label
                key={bed.id}
                className={`flex items-center justify-between border rounded-btn px-3 py-2 cursor-pointer ${
                  selectedBedId === bed.id ? 'border-brand-primary bg-info-bg/40' : 'border-border'
                }`}
              >
                <span className="text-sm">
                  Room {bed.rooms?.room_number} — {bed.bed_label}
                </span>
                <input
                  type="radio"
                  name="bed"
                  checked={selectedBedId === bed.id}
                  onChange={() => setSelectedBedId(bed.id)}
                />
              </label>
            ))}
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-btn border border-border text-sm font-semibold hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!selectedBedId || submitting}
          className="btn-primary disabled:opacity-60"
        >
          {submitting ? 'Allocating…' : 'Confirm Allocation'}
        </button>
      </div>
    </Modal>
  )
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-card shadow-lg w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-heading">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-btn hover:bg-gray-100" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
