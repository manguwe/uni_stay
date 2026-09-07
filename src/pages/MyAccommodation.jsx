import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMyActiveAllocation, fetchMyRoommates } from '../lib/payments'
import PaymentStatusBadge from '../components/PaymentStatusBadge'

export default function MyAccommodation() {
  const [allocation, setAllocation] = useState(null)
  const [roommates, setRoommates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchMyActiveAllocation()
      .then(async (alloc) => {
        if (cancelled) return
        setAllocation(alloc)
        // Roommates show as soon as the allocation exists — KB §9 — not
        // gated on payment status (fixed from an earlier, incorrect
        // 'confirmed'-only gate).
        if (alloc) {
          const mates = await fetchMyRoommates()
          if (!cancelled) setRoommates(mates)
        }
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
  }, [])

  if (loading) return <p className="text-sm text-body/60 max-w-2xl mx-auto mt-8">Loading…</p>

  if (!allocation) {
    return (
      <div className="max-w-md mx-auto mt-12 card p-6 text-center">
        <h1 className="text-lg mb-2">My Accommodation</h1>
        <p className="text-sm text-body/70 mb-4">
          You don't have an active accommodation allocation yet.
        </p>
        <Link to="/accommodation/apply" className="btn-primary inline-flex">
          Apply For A Room
        </Link>
      </div>
    )
  }

  const room = allocation.beds?.rooms
  const paymentStatus = allocation.paymentRecord?.status || 'unpaid'

  return (
    <div className="max-w-xl mx-auto">
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="mb-6">
        <h1 className="text-2xl mb-1">My Accommodation</h1>
        <p className="text-body/70 text-sm">Your current hostel assignment.</p>
      </div>

      <div className="card p-5 mb-5">
        <p className="font-semibold text-heading text-lg mb-1">{room?.hostels?.name}</p>
        <p className="text-sm text-body/70 mb-3">
          Room {room?.room_number} · {allocation.beds?.bed_label} · {allocation.term}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-body/60">Payment:</span>
          <PaymentStatusBadge status={paymentStatus} size="sm" />
          <Link to="/accommodation/finance" className="text-xs text-link hover:underline ml-auto">
            View Finance →
          </Link>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-heading mb-3">Roommates</h2>

        {roommates.length === 0 && (
          <p className="text-sm text-body/60">No other students allocated to your room yet.</p>
        )}

        {roommates.length > 0 && (
          <ul className="space-y-2">
            {roommates.map((mate) => (
              <li key={mate.id} className="flex items-center gap-3 border border-border rounded-btn px-3 py-2">
                <span className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center text-sm font-semibold">
                  {(mate.full_name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="text-sm text-body">{mate.full_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
