import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

export default function TopBar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const initial = (profile?.full_name || user?.email || '?').charAt(0).toUpperCase()

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
    navigate('/login')
  }

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          className="p-2 rounded-btn hover:bg-gray-100 md:hidden"
          aria-label="Toggle menu"
        >
          <GridIcon />
        </button>
        <div className="flex items-center gap-2">
          {/* Eden crest placeholder — swap for the real crest asset */}
          <div className="w-9 h-9 rounded-full bg-info-bg flex items-center justify-center text-heading font-bold">
            🎓
          </div>
          <span className="font-semibold text-heading text-lg tracking-tight">AcademiX</span>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {user && <NotificationBell />}
        <button className="p-2 rounded-btn hover:bg-gray-100" aria-label="Settings">
          <GearIcon />
        </button>

        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full hover:bg-gray-100"
            >
              <span className="relative w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center text-sm font-semibold">
                {initial}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-avatar-green border-2 border-white" />
              </span>
              <ChevronIcon />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-btn shadow-lg py-1 z-30">
                <div className="px-3 py-2 text-xs text-body/60 border-b border-border">
                  {profile?.full_name || user.email}
                  {profile?.role === 'admin' && (
                    <span className="block text-[10px] uppercase tracking-wide text-brand-primary mt-0.5">
                      Admin
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => navigate('/login')} className="btn-primary text-sm px-3 py-1.5">
            Sign in
          </button>
        )}
      </div>
    </header>
  )
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
    </svg>
  )
}
