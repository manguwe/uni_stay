import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <CenteredNote text="Loading…" />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

// Gates the Apply For A Room flow specifically (KB §8a): a student can't
// reach the application form until full_name, student_number, and gender
// are all set on their profile. Redirects to /profile with enough state
// for the Profile page to explain why, and to bounce back here on save.
export function RequireCompleteProfile({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <CenteredNote text="Loading…" />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  const isComplete = !!(profile?.full_name && profile?.student_number && profile?.gender)
  if (!isComplete) {
    return <Navigate to="/profile" state={{ from: location, profileRequired: true }} replace />
  }
  return children
}

export function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) return <CenteredNote text="Loading…" />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isAdmin) {
    return (
      <CenteredNote text="This page is only available to hostel admin accounts." isWarning />
    )
  }
  return children
}

export function ChairpersonRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <CenteredNote text="Loading…" />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (profile?.role !== 'chairperson') {
    return (
      <CenteredNote text="This page is only available to hostel chairperson accounts." isWarning />
    )
  }
  return children
}

export function PatronRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <CenteredNote text="Loading…" />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (profile?.role !== 'patron_matron') {
    return (
      <CenteredNote text="This page is only available to patron/matron accounts." isWarning />
    )
  }
  return children
}

export function StaffOrAdminRoute({ children }) {
  const { user, profile, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) return <CenteredNote text="Loading…" />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  const allowed = isAdmin || profile?.role === 'chairperson' || profile?.role === 'patron_matron'
  if (!allowed) {
    return (
      <CenteredNote text="This page is only available to hostel staff and admin accounts." isWarning />
    )
  }
  return children
}

function CenteredNote({ text, isWarning }) {
  return (
    <div className="max-w-md mx-auto card p-6 text-center mt-12">
      <p className={`text-sm ${isWarning ? 'text-red-600' : 'text-body/70'}`}>{text}</p>
    </div>
  )
}
