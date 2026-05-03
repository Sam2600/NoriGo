function MetricCard({ label, value, icon: Icon, tone = 'teal' }) {
  const tones = {
    teal: 'from-teal-500/10 to-teal-500/5 text-teal-700 ring-teal-500/20',
    sky: 'from-sky-500/10 to-sky-500/5 text-sky-700 ring-sky-500/20',
    violet: 'from-violet-500/10 to-violet-500/5 text-violet-700 ring-violet-500/20',
    amber: 'from-amber-500/10 to-amber-500/5 text-amber-700 ring-amber-500/20',
    rose: 'from-rose-500/10 to-rose-500/5 text-rose-700 ring-rose-500/20',
  }

  return (
    <div className="app-panel group relative overflow-hidden p-5 transition-all hover:translate-y-[-2px] hover:shadow-lg">
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500/80">{label}</p>
          {Icon ? (
            <div className={`rounded-xl bg-gradient-to-br p-2.5 shadow-sm ring-1 ${tones[tone] || tones.teal}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <p className="text-3xl font-bold tracking-tight text-slate-900">{value ?? 0}</p>
        </div>
      </div>
      
      {/* Decorative background element */}
      <div className="absolute -right-4 -bottom-4 h-24 w-24 opacity-[0.03] transition-transform duration-500 group-hover:scale-110">
        {Icon ? <Icon className="h-full w-full" /> : null}
      </div>
    </div>
  )
}

export default MetricCard
