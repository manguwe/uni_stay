import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const MAIN_ITEMS = [
  { label: 'Home', to: '/', disabled: false },
  { label: 'My Profile', to: '/profile', disabled: false },
]

const ACCOMMODATION_ITEMS = [
  { label: 'Find a Room', to: '/accommodation/explore', disabled: false },
  { label: 'Apply For A Room', to: '/accommodation/apply', disabled: false },
  { label: 'My Applications', to: '/accommodation/applications', disabled: false },
  { label: 'My Accommodation', to: '/accommodation/mine', disabled: false },
  { label: 'Finance', to: '/accommodation/finance', disabled: false },
  { label: 'Complaints', to: '/accommodation/complaints', disabled: false },
  { label: 'Announcements', to: '/accommodation/announcements', disabled: false },
]

const ADMIN_ITEMS = [
  { label: 'Dashboard', to: '/admin/dashboard', disabled: false },
  { label: 'Review Queue', to: '/admin/applications', disabled: false },
  { label: 'All Applications', to: '/admin/all-applications', disabled: false },
  { label: 'Payment Verification', to: '/admin/payments', disabled: false },
  { label: 'All Complaints', to: '/admin/complaints', disabled: false },
  { label: 'All Announcements', to: '/admin/announcements', disabled: false },
  { label: 'Inventory', to: '/admin/inventory', disabled: false },
  { label: 'User Management', to: '/admin/users', disabled: false },
  { label: 'Allocated Roster', to: '/admin/roster', disabled: false },
  { label: 'Post Announcement', to: '/announcements/new', disabled: false },
]

const CHAIRPERSON_ITEMS = [
  { label: 'Complaints Dashboard', to: '/chairperson/complaints', disabled: false },
  { label: 'Post Announcement', to: '/announcements/new', disabled: false },
]

const PATRON_ITEMS = [
  { label: 'Dashboard', to: '/patron/dashboard', disabled: false },
  { label: 'Applications', to: '/patron/applications', disabled: false },
  { label: 'Payment Verification', to: '/patron/payments', disabled: false },
  { label: 'Complaints', to: '/patron/complaints', disabled: false },
  { label: 'Post Announcement', to: '/announcements/new', disabled: false },
]

function NavGroup({ title, items }) {
  return (
    <div className="mb-6">
      <p className="px-4 mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.label}>
            {item.disabled ? (
              <span
                className="flex items-center justify-between px-4 py-2 mx-2 rounded-btn text-white/40 cursor-not-allowed text-sm"
                title="Coming in a later phase"
              >
                {item.label}
                <span className="text-[10px] uppercase tracking-wide border border-white/20 rounded-full px-1.5 py-0.5">
                  soon
                </span>
              </span>
            ) : (
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `block px-4 py-2 mx-2 rounded-btn text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-primary-light text-white'
                      : 'text-white/80 hover:bg-brand-primary-light/60 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Sidebar() {
  const { isAdmin, profile } = useAuth()
  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-brand-primary min-h-[calc(100vh-4rem)] pt-6">
      <NavGroup title="Main" items={MAIN_ITEMS} />
      <NavGroup title="Accommodation" items={ACCOMMODATION_ITEMS} />
      {profile?.role === 'chairperson' && <NavGroup title="Chairperson" items={CHAIRPERSON_ITEMS} />}
      {profile?.role === 'patron_matron' && <NavGroup title="Patron/Matron" items={PATRON_ITEMS} />}
      {isAdmin && <NavGroup title="Admin" items={ADMIN_ITEMS} />}
    </aside>
  )
}
