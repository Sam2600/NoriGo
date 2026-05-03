function Field({ label, error, children }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold tracking-tight text-slate-700">
        {label}
      </label>
      <div className="relative">
        {children}
      </div>
      {error ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600" role="alert">
          <span className="h-1 w-1 rounded-full bg-rose-600" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default Field
