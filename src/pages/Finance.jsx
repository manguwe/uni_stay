import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchMyActiveAllocation, uploadReceipt, submitPaymentProof, getReceiptSignedUrl } from '../lib/payments'
import PaymentStatusBadge from '../components/PaymentStatusBadge'
import BackButton from '../components/BackButton'

export default function Finance() {
  const { user } = useAuth()
  const [allocation, setAllocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [referenceNumber, setReferenceNumber] = useState('')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState(null)

  function load() {
    setLoading(true)
    fetchMyActiveAllocation()
      .then(setAllocation)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const path = allocation?.paymentRecord?.receipt_path
    if (path && allocation.paymentRecord.status !== 'unpaid') {
      getReceiptSignedUrl(path).then(setReceiptUrl).catch(() => setReceiptUrl(null))
    } else {
      setReceiptUrl(null)
    }
  }, [allocation])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!referenceNumber.trim()) {
      setError('Please enter the reference number from your bank/mobile money transaction.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      let receiptPath = null
      if (file) {
        receiptPath = await uploadReceipt(user.id, allocation.paymentRecord.id, file)
      }
      await submitPaymentProof(allocation.paymentRecord.id, {
        referenceNumber: referenceNumber.trim(),
        receiptPath,
      })
      setReferenceNumber('')
      setFile(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-sm text-body/60 max-w-2xl mx-auto mt-8">Loading…</p>

  if (!allocation) {
    return (
      <div className="max-w-md mx-auto mt-12 card p-6 text-center">
        <h1 className="text-lg mb-2">Finance</h1>
        <p className="text-sm text-body/70">
          Payment status will appear here once you have an active accommodation allocation.
        </p>
      </div>
    )
  }

  const pr = allocation.paymentRecord
  const room = allocation.beds?.rooms
  const status = pr?.status || 'unpaid'

  return (
    <div className="max-w-xl mx-auto">
      <BackButton />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl mb-1">Finance</h1>
          <p className="text-body/70 text-sm">
            {room?.hostels?.name} · Room {room?.room_number} · {allocation.beds?.bed_label}
          </p>
        </div>
        <PaymentStatusBadge status={status} />
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="card p-5 mb-5">
        <p className="text-sm text-body/70 mb-1">Amount due</p>
        <p className="text-3xl font-bold text-heading">ZMW {Number(pr.amount_due).toFixed(2)}</p>
      </div>

      {(status === 'unpaid' || status === 'rejected') && (
        <>
          {status === 'rejected' && (
            <div className="bg-red-50 text-red-700 text-sm rounded-btn px-4 py-3 mb-4">
              Your last submission was rejected: {pr.rejection_reason || 'No reason given.'} Please
              check the details and resubmit.
            </div>
          )}

          <div className="info-callout mb-5">
            <p className="font-semibold mb-1">Payment instructions (pay externally, not in-app)</p>
            <p>Eden University — Hostel Fees</p>
            <p>Bank: Placeholder Bank plc · Account: 0000-0000-0000 · Branch: Lusaka Main</p>
            <p>Mobile Money: Dial *123# → Pay Bill → Business No. 000000</p>
            <p>Reference: use your student number as the payment reference.</p>
          </div>

          <form onSubmit={handleSubmit} className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-heading">Submit proof of payment</h2>
            <div>
              <label className="text-sm font-medium text-body block mb-1">
                Reference number
              </label>
              <input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. mobile money transaction ID"
                className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-body block mb-1">
                Receipt image (optional)
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center disabled:opacity-60">
              {submitting ? 'Submitting…' : 'Submit for Verification →'}
            </button>
          </form>
        </>
      )}

      {status === 'awaiting_verification' && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-heading mb-2">Submitted — awaiting staff review</p>
          <p className="text-sm text-body/70 mb-1">Reference: {pr.reference_number}</p>
          <p className="text-xs text-body/50 mb-3">
            Submitted {new Date(pr.submitted_at).toLocaleString()}
          </p>
          {receiptUrl && (
            <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-sm text-link hover:underline">
              View submitted receipt →
            </a>
          )}
        </div>
      )}

      {status === 'confirmed' && (
        <div className="card p-5">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-sm font-semibold text-heading mb-1">Payment confirmed</p>
          <p className="text-sm text-body/70 mb-1">Reference: {pr.reference_number}</p>
          <p className="text-xs text-body/50 mb-3">
            Verified {pr.verified_at && new Date(pr.verified_at).toLocaleString()}
          </p>
          {receiptUrl && (
            <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-sm text-link hover:underline">
              View receipt →
            </a>
          )}
          <p className="text-xs text-body/50 mt-3">This is your record — matches the Finance section on AcademiX.</p>
        </div>
      )}
    </div>
  )
}
