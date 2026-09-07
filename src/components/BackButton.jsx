import { useNavigate } from 'react-router-dom'

export default function BackButton({ label = 'Back', className = '' }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(-1)}
      className={`inline-flex items-center gap-1 text-sm text-link hover:underline mb-4 print:hidden ${className}`}
    >
      <span aria-hidden="true">←</span> {label}
    </button>
  )
}
