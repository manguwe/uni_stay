import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

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
  }, [profile?.id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fullName.trim() || !studentNumber.trim()) {
      setError('Full name and student number are required.')
      return
    }
    if (!genderLocked && !gender) {
      setError('Please select a gender.')
      return
    }
    setError(null)
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

  const isComplete = !!(profile?.full_name && profile?.student_number && profile?.gender)

  return (
    <div className="max-w-md mx-auto mt-8 mb-12">
      {profileRequired && !isComplete && (
        <div className="info-callout mb-4">
          Please complete your profile before applying for a room — this fills in your student ID
          and matches you to the correct gender-designated hostel (KB §8a).
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
          <div>
            <label className="text-sm font-medium text-body block mb-1">Full name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-body block mb-1">Student number</label>
              <input
                required
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-body block mb-1">Year of study</label>
              <input
                type="number"
                min="1"
                max="7"
                value={yearOfStudy}
                onChange={(e) => setYearOfStudy(e.target.value)}
                className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-body block mb-1">
              Programme <span className="text-body/40 font-normal">(optional)</span>
            </label>
            <input
              value={programme}
              onChange={(e) => setProgramme(e.target.value)}
              className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-body block mb-1">Gender</label>
            {genderLocked ? (
              <>
                <p className="w-full border border-border rounded-btn px-3 py-2 text-sm bg-gray-50 text-body/70 capitalize">
                  {profile.gender}
                </p>
                <p className="text-xs text-body/50 mt-1">
                  Locked after first save — contact admin to correct this.
                </p>
              </>
            ) : (
              <select
                required
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-light"
              >
                <option value="" disabled>
                  Select…
                </option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            )}
          </div>

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
