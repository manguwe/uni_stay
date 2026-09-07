import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    studentNumber: '',
    programme: '',
    yearOfStudy: '',
    gender: '',
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { hasSession } = await signUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        studentNumber: form.studentNumber,
        programme: form.programme,
        yearOfStudy: form.yearOfStudy ? Number(form.yearOfStudy) : null,
        gender: form.gender,
      })
      if (hasSession) {
        navigate('/', { replace: true })
      } else {
        setNeedsConfirmation(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (needsConfirmation) {
    return (
      <div className="max-w-sm mx-auto mt-12 card p-6 text-center">
        <div className="text-4xl mb-3">📬</div>
        <h1 className="text-lg mb-2">Check your email</h1>
        <p className="text-sm text-body/70 mb-5">
          Your account was created, but this project requires email confirmation before you can
          sign in. Click the link we sent to <strong>{form.email}</strong>, then sign in — you'll
          be asked to finish your profile on first login.
        </p>
        <Link to="/login" className="btn-primary inline-flex">
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-8 mb-12">
      <div className="card p-6">
        <h1 className="text-xl mb-1">Create your account</h1>
        <p className="text-sm text-body/70 mb-6">
          This information is used to pre-fill your accommodation application and to enforce
          hostel gender-designation rules — it's never shown to other students.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-body block mb-1">Full name</label>
            <input
              required
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-body block mb-1">Student number</label>
              <input
                required
                value={form.studentNumber}
                onChange={(e) => update('studentNumber', e.target.value)}
                className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-body block mb-1">Year of study</label>
              <input
                type="number"
                min="1"
                max="7"
                required
                value={form.yearOfStudy}
                onChange={(e) => update('yearOfStudy', e.target.value)}
                className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-body block mb-1">Programme</label>
            <input
              required
              value={form.programme}
              onChange={(e) => update('programme', e.target.value)}
              className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-body block mb-1">Gender</label>
            <select
              required
              value={form.gender}
              onChange={(e) => update('gender', e.target.value)}
              className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
            >
              <option value="" disabled>
                Select…
              </option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <p className="text-xs text-body/50 mt-1">
              Used only to match you to a male/female-designated hostel per university policy.
            </p>
          </div>

          <hr className="border-border" />

          <div>
            <label className="text-sm font-medium text-body block mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-body block mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center disabled:opacity-60">
            {submitting ? 'Creating account…' : 'Create account →'}
          </button>
        </form>

        <p className="text-sm text-body/70 mt-5 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-link hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
