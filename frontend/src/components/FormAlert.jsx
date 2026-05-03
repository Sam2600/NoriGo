const toneStyles = {
  error: {
    wrapper: 'bg-rose-50 text-rose-600 ring-rose-100',
    dot: 'bg-rose-600',
    role: 'alert',
  },
  success: {
    wrapper: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    dot: 'bg-emerald-600',
    role: 'status',
  },
  warning: {
    wrapper: 'bg-amber-50 text-amber-800 ring-amber-100',
    dot: 'bg-amber-500',
    role: 'alert',
  },
}

function FormAlert({ children, className = '', type = 'error' }) {
  if (!children) {
    return null
  }

  const tone = toneStyles[type] || toneStyles.error

  return (
    <div
      className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-bold ring-1 animate-in fade-in zoom-in-95 duration-200 ${tone.wrapper} ${className}`}
      role={tone.role}
    >
      <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      <span>{children}</span>
    </div>
  )
}

export default FormAlert
