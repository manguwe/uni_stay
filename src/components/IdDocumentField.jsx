export default function IdDocumentField({ idType, idNumber, onIdTypeChange, onIdNumberChange, error }) {
  return (
    <div>
      <label className="text-sm font-medium text-body block mb-1">NRC or Passport</label>
      <div className="flex gap-2 mb-2">
        {['nrc', 'passport'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onIdTypeChange(t)}
            className={`flex-1 text-sm py-2 rounded-btn border capitalize ${
              idType === t
                ? 'border-brand-primary bg-info-bg/40 font-semibold text-heading'
                : 'border-border text-body/70'
            }`}
          >
            {t === 'nrc' ? 'NRC' : 'Passport'}
          </button>
        ))}
      </div>
      <input
        value={idNumber}
        onChange={(e) => onIdNumberChange(e.target.value)}
        placeholder={idType === 'nrc' ? '123456/78/1' : 'Passport number'}
        className="input"
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
