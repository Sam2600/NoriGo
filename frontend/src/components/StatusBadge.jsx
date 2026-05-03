const toneMap = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  scheduled: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  completed: 'bg-slate-50 text-slate-600 ring-slate-600/10',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  started: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  cancelled: 'bg-red-50 text-red-700 ring-red-600/20',
  inactive: 'bg-slate-100 text-slate-500 ring-slate-600/10',
  maintenance: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  waiting: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  picked_up: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  absent: 'bg-red-50 text-red-700 ring-red-600/20',
  dropped_off: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  missed: 'bg-red-50 text-red-700 ring-red-600/20',
  high: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  urgent: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  schedule_change: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  trip_reminder: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  booking: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  system: 'bg-slate-100 text-slate-600 ring-slate-600/10',
}

function StatusBadge({ value }) {
  const normalized = value || 'unknown'
  const classes = toneMap[normalized] || 'bg-slate-100 text-slate-600 ring-slate-600/10'

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ring-1 ring-inset ${classes}`}>
      {String(normalized).replaceAll('_', ' ')}
    </span>
  )
}

export default StatusBadge
