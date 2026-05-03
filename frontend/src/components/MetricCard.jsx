function MetricCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        {Icon ? <Icon className="h-5 w-5 text-teal-600" aria-hidden="true" /> : null}
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value ?? 0}</p>
    </div>
  )
}

export default MetricCard
