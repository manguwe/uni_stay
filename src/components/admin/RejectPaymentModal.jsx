import { useState } from 'react'
import { rejectPayment } from '../../lib/payments'
import { Modal } from './AllocateBedModal'

export default function RejectPaymentModal({ payment, onClose, onRejected }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    if (!reason.trim()) {
      setError('Please give a short reason — the student will see this.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await rejectPayment(payment.id, reason.trim())
      onRejected()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const student = payment.allocations?.hostel_applications?.profiles

  return (
    <Modal title="Reject payment proof" onClose={onClose}>
      <p className="text-sm text-body/70 mb-4">
        Applicant: <strong>{student?.full_name}</strong> · Ref: {payment.reference_number}
      </p>

      <label className="text-sm font-medium text-body block mb-1">Reason</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="e.g. Reference number doesn't match any transaction on record"
        className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light mb-3"
      />

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
          disabled={submitting}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-btn px-4 py-2 text-sm disabled:opacity-60"
        >
          {submitting ? 'Rejecting…' : 'Confirm Rejection'}
        </button>
      </div>
    </Modal>
  )
}
