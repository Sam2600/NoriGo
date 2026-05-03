function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error ? <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  )
}

export default Field
