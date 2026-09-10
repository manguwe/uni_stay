import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import IdDocumentField from '../components/IdDocumentField'
import {
  validateFullName,
  validateStudentNumber,
  validateIdDocument,
  validatePhone,
} from '../lib/validators'

// Exported so ProtectedRoute's RequireCompleteProfile guard uses the exact
// same definition of "complete" as this page — one source of truth.
export function isProfileComplete(profile) {
  return !!(
    profile?.full_name &&
    profile?.student_number &&
    profile?.gender &&
    profile?.id_document_type &&
    profile?.id_document_number &&
    profile?.phone_number
  )
}

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const profileRequired = location.state?.profileRequired
  const redirectTo = location.state?.from?.pathname

  const [fullName, setFullName] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [programme, setProgramme] = useState('')
  const [yearOfStudy, setYearOfStudy] = useState('')
  const [gender, setGender] = useState('')
  const [idType, setIdType] = useState('nrc')
  const [idNumber, setIdNumber] = useState('')
  const [phone, setPhone] = useState('')

  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const genderLocked = !!profile?.gender

  // Populate the form once the profile has loaded (or changes, e.g. after
  // an admin correction) — but don't clobber the student mid-edit.
  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name || '')
    setStudentNumber(profile.student_number || '')
    setProgramme(profile.programme || '')
    setYearOfStudy(profile.year_of_study || '')
    setGender(profile.gender || '')
    setIdType(profile.id_document_type || 'nrc')
    setIdNumber(profile.id_document_number || '')
    setPhone(profile.phone_number || '')
  }, [profile?.id])

  function validateAll() {
    const errors = {
      fullName: validateFullName(fullName),
      studentNumber: validateStudentNumber(studentNumber),
      idNumber: validateIdDocument(idType, idNumber),
      phone: validatePhone(phone),
    }
    if (!genderLocked && !gender) errors.gender = 'Please select a gender.'

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
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          student_number: studentNumber.trim(),
          programme: programme.trim() || null,
          year_of_study: yearOfStudy ? Number(yearOfStudy) : null,
          // If gender is already locked, send the existing value back
          // unchanged — the DB trigger would block a change anyway, but
          // there's no reason to even attempt one from a locked field.
          gender: genderLocked ? profile.gender : gender,
          id_document_type: idType,
          id_document_number: idNumber.trim(),
          phone_number: phone.trim(),
        })
        .eq('id', profile.id)

      if (updateError) throw updateError
      await refreshProfile()
      setSaved(true)

      if (redirectTo) {
        navigate(redirectTo, { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const isComplete = isProfileComplete(profile)

  return (
    <div className="max-w-md mx-auto mt-8 mb-12">
      {profileRequired && !isComplete && (
        <div className="info-callout mb-4">
          Please complete your profile before applying for a room — this fills in your student ID
          and matches you to the correct gender-designated hostel.
        </div>
      )}

      <div className="card p-6">
        <h1 className="text-xl mb-1">My Profile</h1>
        <p className="text-sm text-body/70 mb-6">
          Used to pre-fill your applications and enforce hostel gender-designation rules — never
          shown to other students except your allocated roommates' first/last name once you're
          allocated.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full name" error={fieldErrors.fullName}>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Student number" error={fieldErrors.studentNumber}>
              <input value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} className="input" />
            </Field>
            <Field label="Year of study">
              <input
                type="number"
                min="1"
                max="7"
                value={yearOfStudy}
                onChange={(e) => setYearOfStudy(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <Field label={<>Programme <span className="text-body/40 font-normal">(optional)</span></>}>
            <input value={programme} onChange={(e) => setProgramme(e.target.value)} className="input" />
          </Field>

          <Field label="Gender" error={fieldErrors.gender}>
            {genderLocked ? (
              <>
                <p className="input bg-gray-50 text-body/70 capitalize">{profile.gender}</p>
                <p className="text-xs text-body/50 mt-1">
                  Locked after first save — contact admin to correct this.
                </p>
              </>
            ) : (
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="input">
                <option value="" disabled>
                  Select…
                </option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            )}
          </Field>

          <IdDocumentField
            idType={idType}
            idNumber={idNumber}
            onIdTypeChange={setIdType}
            onIdNumberChange={setIdNumber}
            error={fieldErrors.idNumber}
          />

          <Field label="Phone number" error={fieldErrors.phone}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0977123456" className="input" />
            <p className="text-xs text-body/50 mt-1">For calls/WhatsApp — used as your emergency contact once allocated.</p>
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && !redirectTo && <p className="text-sm text-emerald-700">Profile saved.</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center disabled:opacity-60">
            {submitting ? 'Saving…' : 'Save Profile →'}
          </button>
        </form>
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
