import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import IdDocumentField from '../components/IdDocumentField'
import {
  validateFullName,
  validateStudentNumber,
  validateEmail,
  validateIdDocument,
  validatePhone,
} from '../lib/validators'

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
    idType: 'nrc',
    idNumber: '',
    phone: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function validateAll() {
    const errors = {
      fullName: validateFullName(form.fullName),
      studentNumber: validateStudentNumber(form.studentNumber),
      email: validateEmail(form.email),
      idNumber: validateIdDocument(form.idType, form.idNumber),
      phone: validatePhone(form.phone),
    }
    if (!form.gender) errors.gender = 'Please select a gender.'
    if (!form.programme.trim()) errors.programme = 'Programme is required.'
    if (!form.yearOfStudy) errors.yearOfStudy = 'Year of study is required.'

    const cleaned = Object.fromEntries(Object.entries(errors).filter(([, v]) => v))
    setFieldErrors(cleaned)
    return Object.keys(cleaned).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!validateAll()) return
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
        idType: form.idType,
        idNumber: form.idNumber,
        phone: form.phone,
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
          <Field label="Full name" error={fieldErrors.fullName}>
            <input value={form.fullName} onChange={(e) => update('fullName', e.target.value)} className="input" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Student number" error={fieldErrors.studentNumber}>
              <input
                value={form.studentNumber}
                onChange={(e) => update('studentNumber', e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Year of study" error={fieldErrors.yearOfStudy}>
              <input
                type="number"
                min="1"
                max="7"
                value={form.yearOfStudy}
                onChange={(e) => update('yearOfStudy', e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <Field label="Programme" error={fieldErrors.programme}>
            <input value={form.programme} onChange={(e) => update('programme', e.target.value)} className="input" />
          </Field>

          <Field label="Gender" error={fieldErrors.gender}>
            <select value={form.gender} onChange={(e) => update('gender', e.target.value)} className="input">
              <option value="" disabled>
                Select…
              </option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <p className="text-xs text-body/50 mt-1">
              Used only to match you to a male/female-designated hostel per university policy.
            </p>
          </Field>

          <IdDocumentField
            idType={form.idType}
            idNumber={form.idNumber}
            onIdTypeChange={(t) => update('idType', t)}
            onIdNumberChange={(v) => update('idNumber', v)}
            error={fieldErrors.idNumber}
          />

          <Field label="Phone number" error={fieldErrors.phone}>
            <input
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="0977123456"
              className="input"
            />
            <p className="text-xs text-body/50 mt-1">For calls/WhatsApp — used as your emergency contact once allocated.</p>
          </Field>

          <hr className="border-border" />

          <Field label="Email" error={fieldErrors.email}>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="input" />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              className="input"
            />
          </Field>

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

function Field({ label, error, children }) {
  return (
    <div>
      <label className="text-sm font-medium text-body block mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
