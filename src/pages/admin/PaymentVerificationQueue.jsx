import { useCallback, useEffect, useState } from 'react'
import { fetchPaymentQueue, confirmPayment, getReceiptSignedUrl } from '../../lib/payments'
import { releaseBed } from '../../lib/applications'
import RejectPaymentModal from '../../components/admin/RejectPaymentModal'
import WaitlistPromotionModal from '../../components/admin/WaitlistPromotionModal'

export default function PaymentVerificationQueue() {
  const [queue, setQueue] = useState({ awaitingVerification: [], overdue: [], deadlineDays: 7 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [rejectingPayment, setRejectingPayment] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const [releasingId, setReleasingId] = useState(null)
  const [promotionTarget, setPromotionTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setQueue(await fetchPaymentQueue())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleConfirm(paymentId) {
    setConfirmingId(paymentId)
    try {
      await confirmPayment(paymentId)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirmingId(null)
    }
  }

  async function handleReleaseBed(payment) {
    const bedId = payment.allocations?.bed_id
    const room = payment.allocations?.beds?.rooms
    if (!bedId) return
    setReleasingId(payment.id)
    try {
      await releaseBed(bedId)
      await load()
      if (room) {
        setPromotionTarget({
          room: { id: room.id, hostel_id: room.hostel_id, room_number: room.room_number },
          freedBedId: bedId,
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setReleasingId(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Payment Verification</h1>
        <p className="text-body/70 text-sm">
          Confirm or reject submitted proof of payment. Balances unpaid or unverified more than{' '}
          {queue.deadlineDays} days after allocation are flagged overdue below.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-body/60">Loading…</p>}

      {!loading && (
        <>
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-heading mb-3">
              Awaiting verification ({queue.awaitingVerification.length})
            </h2>
            {queue.awaitingVerification.length === 0 && (
              <p className="text-sm text-body/60">Nothing pending review.</p>
            )}
            <div className="space-y-3">
              {queue.awaitingVerification.map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  actions={
                    <>
                      <button
                        onClick={() => handleConfirm(payment.id)}
                        disabled={confirmingId === payment.id}
                        className="text-xs btn-primary px-3 py-1.5 disabled:opacity-60"
                      >
                        {confirmingId === payment.id ? 'Confirming…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setRejectingPayment(payment)}
                        className="text-xs px-3 py-1.5 rounded-btn border border-red-300 text-red-700 font-semibold hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-heading mb-3">
              Overdue ({queue.overdue.length})
            </h2>
            {queue.overdue.length === 0 && (
              <p className="text-sm text-body/60">Nothing overdue right now.</p>
            )}
            <div className="space-y-3">
              {queue.overdue.map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  overdue
                  actions={
                    <button
                      onClick={() => handleReleaseBed(payment)}
                      disabled={releasingId === payment.id}
                      className="text-xs px-3 py-1.5 rounded-btn border border-amber-300 text-amber-700 font-semibold hover:bg-amber-50 disabled:opacity-60"
                    >
                      {releasingId === payment.id ? 'Releasing…' : 'Release bed'}
                    </button>
                  }
                />
              ))}
            </div>
          </section>
        </>
      )}

      {rejectingPayment && (
        <RejectPaymentModal
          payment={rejectingPayment}
          onClose={() => setRejectingPayment(null)}
          onRejected={() => {
            setRejectingPayment(null)
            load()
          }}
        />
      )}

      {promotionTarget && (
        <WaitlistPromotionModal
          room={promotionTarget.room}
          freedBedId={promotionTarget.freedBedId}
          onClose={() => setPromotionTarget(null)}
          onPromoted={() => {
            setPromotionTarget(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function PaymentCard({ payment, actions, overdue }) {
  const student = payment.allocations?.hostel_applications?.profiles
  const room = payment.allocations?.beds?.rooms
  const [receiptUrl, setReceiptUrl] = useState(null)

  useEffect(() => {
    if (payment.receipt_path) {
      getReceiptSignedUrl(payment.receipt_path).then(setReceiptUrl).catch(() => setReceiptUrl(null))
    }
  }, [payment.receipt_path])

  return (
    <div className={`card p-4 ${overdue ? 'border-l-4 border-status-reserved' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-heading">{student?.full_name}</p>
          <p className="text-xs text-body/60">
            {student?.student_number} · {room?.hostels?.name} · Room {room?.room_number}
          </p>
        </div>
        <p className="text-sm font-semibold text-heading">
          ZMW {Number(payment.amount_due).toFixed(2)}
        </p>
      </div>

      {payment.reference_number && (
        <p className="text-sm text-body mb-1">Reference: {payment.reference_number}</p>
      )}
      {receiptUrl && (
        <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-sm text-link hover:underline">
          View receipt →
        </a>
      )}

      <p className="text-xs text-body/40 mt-2">
        Allocated {new Date(payment.allocations.allocated_at).toLocaleDateString()}
      </p>

      <div className="flex flex-wrap gap-2 mt-3">{actions}</div>
    </div>
  )
}
