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
  { label: 'Student Directory', to: '/patron/directory', disabled: false },
  { label: 'Post Announcement', to: '/announcements/new', disabled: false },
]

function NavGroup({ title, items, onNavigate }) {
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
                onClick={onNavigate}
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

export default function Sidebar({ open, onClose }) {
  const { isAdmin, profile } = useAuth()

  function renderGroups(onNavigate) {
    return (
      <>
        <NavGroup title="Main" items={MAIN_ITEMS} onNavigate={onNavigate} />
        {(!profile || profile.role === 'student') && (
          <NavGroup title="Accommodation" items={ACCOMMODATION_ITEMS} onNavigate={onNavigate} />
        )}
        {profile?.role === 'chairperson' && (
          <NavGroup title="Chairperson" items={CHAIRPERSON_ITEMS} onNavigate={onNavigate} />
        )}
        {profile?.role === 'patron_matron' && (
          <NavGroup title="Patron/Matron" items={PATRON_ITEMS} onNavigate={onNavigate} />
        )}
        {isAdmin && <NavGroup title="Admin" items={ADMIN_ITEMS} onNavigate={onNavigate} />}
      </>
    )
  }

  return (
    <>
      {/* Desktop: always visible, sticky under the top bar so it stays in
          view while the page content scrolls (previously scrolled away on
          any page taller than the viewport, e.g. the admin dashboard). */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-brand-primary sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto pt-6">
        {renderGroups()}
      </aside>

      {/* Mobile: real off-canvas drawer, only in the DOM while open — the
          hamburger button previously had no handler and there was no
          drawer variant at all below the md breakpoint. */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 w-64 bg-brand-primary pt-6 overflow-y-auto flex flex-col">
            {renderGroups(onClose)}
          </aside>
        </div>
      )}
    </>
  )
}
