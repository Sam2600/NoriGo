function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export default EmptyState
