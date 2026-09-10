export function validateFullName(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'Full name is required.'
  if (!/^[A-Za-z\s'-]+$/.test(trimmed)) {
    return 'Only letters, spaces, hyphens, and apostrophes are allowed.'
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return 'Please enter both a first and last name.'
  return null
}

export function validateStudentNumber(value) {
  if (!/^\d{10}$/.test(value || '')) return 'Student ID must be exactly 10 digits.'
  return null
}

export function validateEmail(value) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '')) return 'Enter a valid email address.'
  return null
}

export function validateNRC(value) {
  if (!/^\d{6}\/\d{2}\/\d$/.test(value || '')) {
    return 'NRC must be in the format 123456/78/1.'
  }
  return null
}

export function validatePassport(value) {
  const trimmed = (value || '').trim()
  if (!/^[A-Za-z0-9]{5,20}$/.test(trimmed)) {
    return 'Enter a valid passport number (5–20 letters/numbers).'
  }
  return null
}

export function validateIdDocument(idType, idNumber) {
  if (!idType) return 'Please choose NRC or Passport.'
  return idType === 'nrc' ? validateNRC(idNumber) : validatePassport(idNumber)
}

export function validatePhone(value) {
  if (!/^(0\d{9}|\+260\d{9})$/.test(value || '')) {
    return 'Enter a Zambian mobile number, e.g. 0977123456 or +260977123456.'
  }
  return null
}
