function FormAlert({ children, type = 'error', className = '' }) {
  if (!children) return null

  const classes = type === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : type === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-rose-200 bg-rose-50 text-rose-700'

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${classes} ${className}`}>
      {children}
    </div>
  )
}

export default FormAlert
