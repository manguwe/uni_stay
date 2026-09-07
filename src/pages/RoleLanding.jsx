import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Rendered at "/". Dispatches immediately by role — this is the concrete
// implementation of KB §8a's "route by role immediately after login/
// profile load, before showing any onboarding gate":
//   - not logged in: the public Explorer (KB §7 — browsing needs no login)
//   - student, profile incomplete: the profile-completion gate — never a
//     hostel field, only full name / student ID / gender (KB §8a)
//   - student, profile complete: the student home (Explorer)
//   - chairperson / patron_matron: straight to their own dashboard, no
//     student gate of any kind — they never need student ID or gender
//   - admin: straight to the admin area, no gate
export default function RoleLanding() {
  const { user, profile, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center text-sm text-body/60">Loading…</div>
    )
  }

  if (!user) {
    return <Navigate to="/accommodation/explore" replace />
  }

  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />
  }
  if (profile?.role === 'chairperson') {
    return <Navigate to="/chairperson/complaints" replace />
  }
  if (profile?.role === 'patron_matron') {
    return <Navigate to="/patron/dashboard" replace />
  }

  // Default: student (or a profile still loading its role — treat the
  // same as student rather than gating on an assumption).
  const isComplete = !!(profile?.full_name && profile?.student_number && profile?.gender)
  if (!isComplete) {
    return <Navigate to="/profile" state={{ from: location, profileRequired: true }} replace />
  }
  return <Navigate to="/accommodation/explore" replace />
}
