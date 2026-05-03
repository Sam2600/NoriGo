const toneMap = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dot-emerald-500',
  scheduled: 'bg-sky-50 text-sky-700 ring-sky-600/20 dot-sky-500',
  confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dot-emerald-500',
  completed: 'bg-slate-50 text-slate-600 ring-slate-600/10 dot-slate-400',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20 dot-amber-500',
  started: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dot-indigo-500',
  on_the_way: 'bg-blue-50 text-blue-700 ring-blue-600/20 dot-blue-500',
  delayed: 'bg-rose-50 text-rose-700 ring-rose-600/20 dot-rose-500',
  arrived_at_pickup: 'bg-teal-50 text-teal-700 ring-teal-600/20 dot-teal-500',
  cancelled: 'bg-red-50 text-red-700 ring-red-600/20 dot-red-500',
  inactive: 'bg-slate-100 text-slate-500 ring-slate-600/10 dot-slate-400',
  maintenance: 'bg-orange-50 text-orange-700 ring-orange-600/20 dot-orange-500',
  waiting: 'bg-amber-50 text-amber-700 ring-amber-600/20 dot-amber-500',
  picked_up: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dot-indigo-500',
  absent: 'bg-red-50 text-red-700 ring-red-600/20 dot-red-500',
  dropped_off: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dot-emerald-500',
  missed: 'bg-red-50 text-red-700 ring-red-600/20 dot-red-500',
  high: 'bg-orange-50 text-orange-700 ring-orange-600/20 dot-orange-500',
  urgent: 'bg-rose-50 text-rose-700 ring-rose-600/20 dot-rose-500',
  critical: 'bg-red-100 text-red-800 ring-red-600/30 dot-red-600',
  emergency: 'bg-red-100 text-red-800 ring-red-600/30 dot-red-600',
  delay: 'bg-amber-50 text-amber-700 ring-amber-600/20 dot-amber-500',
  schedule_change: 'bg-sky-50 text-sky-700 ring-sky-600/20 dot-sky-500',
  trip_reminder: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dot-emerald-500',
  issue: 'bg-orange-50 text-orange-700 ring-orange-600/20 dot-orange-500',
}

function StatusBadge({ value }) {
  const normalized = value || 'unknown'
  const classes = toneMap[normalized] || 'bg-slate-100 text-slate-600 ring-slate-600/10 dot-slate-400'
  const dotColor = classes.split(' ').find(c => c.startsWith('dot-'))?.replace('dot-', 'bg-') || 'bg-slate-400'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset ${classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
      {normalized.replaceAll('_', ' ')}
    </span>
  )
}

export default StatusBadge
