import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { fetchDashboardStats } from '../../lib/adminStats'
import { COMPLAINT_CATEGORIES } from '../../lib/complaints'

const CATEGORY_LABEL = Object.fromEntries(COMPLAINT_CATEGORIES.map((c) => [c.value, c.label]))

const QUICK_LINKS = [
  { label: 'Review Queue', to: '/admin/applications', hint: 'Allocate, waitlist, reject' },
  { label: 'Payment Verification', to: '/admin/payments', hint: 'Confirm/reject proof of payment' },
  { label: 'All Applications', to: '/admin/all-applications', hint: 'Every application, any status' },
  { label: 'All Complaints', to: '/admin/complaints', hint: 'Override status, reassign' },
  { label: 'Inventory', to: '/admin/inventory', hint: 'Hostels, rooms, beds' },
  { label: 'User Management', to: '/admin/users', hint: 'Roles & hostel assignments' },
  { label: 'Allocated Roster', to: '/admin/roster', hint: 'Printable handover list' },
]

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-body/60 max-w-5xl mx-auto mt-8">Loading dashboard…</p>
  if (error) return <p className="text-sm text-red-600 max-w-5xl mx-auto mt-8">{error}</p>

  const h = stats.headline

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Admin Dashboard</h1>
        <p className="text-body/70 text-sm">Live snapshot across the whole system.</p>
      </div>

      {/* Headline stats — KB §13 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <Stat label="Students" value={h.totalStudents} />
        <Stat label="Hostels" value={h.totalHostels} />
        <Stat label="Rooms" value={h.totalRooms} />
        <Stat label="Beds" value={h.totalBeds} />
        <Stat label="Occupied beds" value={h.bedsOccupied} accent="text-red-600" />
        <Stat label="Available beds" value={h.bedsAvailable} accent="text-emerald-600" />
        <Stat label="Reserved beds" value={h.bedsReserved} accent="text-amber-600" />
        <Stat label="Unavailable beds" value={h.bedsUnavailable} accent="text-gray-500" />
        <Stat label="Pending applications" value={h.pendingApplications} link="/admin/applications" />
        <Stat label="Active complaints" value={h.activeComplaints} link="/admin/complaints" />
        <Stat
          label="Payments awaiting verification"
          value={h.paymentsAwaitingVerification}
          link="/admin/payments"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ChartCard title="Occupancy per hostel">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.occupancyByHostel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="hostelName" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="occupied" name="Occupied" fill="#EF4444" />
              <Bar dataKey="total" name="Total beds" fill="#34D399" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Gender balance across hostels">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.genderBalanceByHostel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="hostelName" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="male" name="Male" fill="#1C7C8C" />
              <Bar dataKey="female" name="Female" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Applications over time">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.applicationsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Applications" fill="#0E5E68" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Complaints by category">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={Object.entries(stats.complaintsByCategory).map(([k, v]) => ({
                category: CATEGORY_LABEL[k] || k,
                count: v,
              }))}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis dataKey="category" type="category" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#17A2B8" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Complaints by status">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={Object.entries(stats.complaintsByStatus).map(([k, v]) => ({ status: k, count: v }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Payment status breakdown">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={Object.entries(stats.paymentsByStatus).map(([k, v]) => ({ status: k, count: v }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#34D399" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <h2 className="text-sm font-semibold text-heading mb-3">Quick links</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {QUICK_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="card p-4 hover:shadow-md transition-shadow">
            <p className="font-semibold text-heading text-sm">{l.label}</p>
            <p className="text-xs text-body/60 mt-1">{l.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, accent, link }) {
  const content = (
    <div className="card p-3">
      <p className={`text-2xl font-bold ${accent || 'text-heading'}`}>{value}</p>
      <p className="text-xs text-body/70">{label}</p>
    </div>
  )
  return link ? <Link to={link}>{content}</Link> : content
}

function ChartCard({ title, children }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-heading mb-2">{title}</h3>
      {children}
    </div>
  )
}
