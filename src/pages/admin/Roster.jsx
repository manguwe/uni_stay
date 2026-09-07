import { useEffect, useMemo, useState } from 'react'
import { fetchAllocatedRoster } from '../../lib/roster'
import PaymentStatusBadge from '../../components/PaymentStatusBadge'
import BackButton from '../../components/BackButton'

export default function Roster() {
  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [hostelFilter, setHostelFilter] = useState('all')
  const [blockFilter, setBlockFilter] = useState('all')
  const [floorFilter, setFloorFilter] = useState('all')
  const [flatFilter, setFlatFilter] = useState('all')

  useEffect(() => {
    fetchAllocatedRoster()
      .then(setRoster)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const hostels = useMemo(() => uniqueBy(roster, 'hostelId', 'hostelName'), [roster])
  const blocks = useMemo(
    () => uniqueBy(roster.filter(matchesHostel), 'blockId', 'blockName'),
    [roster, hostelFilter]
  )
  const floors = useMemo(
    () => uniqueBy(roster.filter(matchesHostel).filter(matchesBlock), 'floorId', 'floorName'),
    [roster, hostelFilter, blockFilter]
  )
  const flats = useMemo(
    () =>
      uniqueBy(
        roster.filter(matchesHostel).filter(matchesBlock).filter(matchesFloor),
        'flatId',
        'flatName'
      ),
    [roster, hostelFilter, blockFilter, floorFilter]
  )

  function matchesHostel(row) {
    return hostelFilter === 'all' || row.hostelId === hostelFilter
  }
  function matchesBlock(row) {
    return blockFilter === 'all' || row.blockId === blockFilter
  }
  function matchesFloor(row) {
    return floorFilter === 'all' || row.floorId === floorFilter
  }
  function matchesFlat(row) {
    return flatFilter === 'all' || row.flatId === flatFilter
  }

  const filtered = roster
    .filter(matchesHostel)
    .filter(matchesBlock)
    .filter(matchesFloor)
    .filter(matchesFlat)

  function resetBelow(level) {
    if (level === 'hostel') {
      setBlockFilter('all')
      setFloorFilter('all')
      setFlatFilter('all')
    } else if (level === 'block') {
      setFloorFilter('all')
      setFlatFilter('all')
    } else if (level === 'floor') {
      setFlatFilter('all')
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <BackButton />
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl mb-1">Allocated Students Roster</h1>
          <p className="text-body/70 text-sm">
            Every student with a confirmed allocation — for hostel handover records.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-btn border border-border text-sm font-semibold hover:bg-gray-50 shrink-0"
        >
          Print →
        </button>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Eden Hostel Portal — Allocated Students Roster</h1>
        <p className="text-sm text-body/60">Printed {new Date().toLocaleString()}</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-5 print:hidden">
        <FilterSelect
          label="Hostel"
          value={hostelFilter}
          onChange={(v) => {
            setHostelFilter(v)
            resetBelow('hostel')
          }}
          options={hostels}
        />
        <FilterSelect
          label="Block"
          value={blockFilter}
          onChange={(v) => {
            setBlockFilter(v)
            resetBelow('block')
          }}
          options={blocks}
        />
        <FilterSelect
          label="Floor"
          value={floorFilter}
          onChange={(v) => {
            setFloorFilter(v)
            resetBelow('floor')
          }}
          options={floors}
        />
        <FilterSelect label="Flat" value={flatFilter} onChange={setFlatFilter} options={flats} />
      </div>

      {error && <p className="text-sm text-red-600 mb-4 print:hidden">{error}</p>}
      {loading && <p className="text-sm text-body/60 print:hidden">Loading…</p>}

      {!loading && (
        <>
          <p className="text-xs text-body/50 mb-2 print:hidden">
            {filtered.length} allocated student{filtered.length === 1 ? '' : 's'}
          </p>

          <table className="w-full text-sm border-collapse print:text-black">
            <thead>
              <tr className="text-left border-b border-border">
                <Th>Name</Th>
                <Th>Student ID</Th>
                <Th>Programme</Th>
                <Th>Hostel</Th>
                <Th>Block</Th>
                <Th>Floor</Th>
                <Th>Flat</Th>
                <Th>Room</Th>
                <Th>Bed</Th>
                <Th>Payment</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.allocationId} className="border-b border-border align-top break-inside-avoid">
                  <Td>{row.studentName}</Td>
                  <Td>{row.studentNumber}</Td>
                  <Td>{row.programme}</Td>
                  <Td>{row.hostelName}</Td>
                  <Td>{row.blockName || '—'}</Td>
                  <Td>{row.floorName || '—'}</Td>
                  <Td>{row.flatName || '—'}</Td>
                  <Td>{row.roomNumber}</Td>
                  <Td>{row.bedLabel}</Td>
                  <Td>
                    <span className="print:hidden">
                      <PaymentStatusBadge status={row.paymentStatus} size="sm" />
                    </span>
                    <span className="hidden print:inline capitalize">
                      {row.paymentStatus.replace('_', ' ')}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <p className="text-sm text-body/60 mt-4 print:hidden">
              No allocated students match the current filters.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function uniqueBy(rows, idKey, nameKey) {
  const seen = new Map()
  for (const row of rows) {
    if (row[idKey] && !seen.has(row[idKey])) {
      seen.set(row[idKey], row[nameKey])
    }
  }
  return Array.from(seen.entries()).map(([value, label]) => ({ value, label }))
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs font-medium text-body/60 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={options.length === 0}
        className="border border-border rounded-btn px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light disabled:bg-gray-50 disabled:text-body/40"
      >
        <option value="all">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function Th({ children }) {
  return <th className="py-2 pr-4 font-semibold text-heading">{children}</th>
}

function Td({ children }) {
  return <td className="py-2 pr-4 text-body">{children}</td>
}
