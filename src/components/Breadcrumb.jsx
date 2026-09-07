export default function Breadcrumb({ crumbs, onNavigate }) {
  // crumbs: [{ label, onClick? }] — last crumb is the current location (not clickable)
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-body mb-4" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-border">/</span>}
            {isLast ? (
              <span className="font-semibold text-heading">{crumb.label}</span>
            ) : (
              <button
                onClick={() => onNavigate(i)}
                className="text-link hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light rounded"
              >
                {crumb.label}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
