function SectionPanel({ title, description, icon: Icon, actions, children, className = '' }) {
  return (
    <section className={`app-panel overflow-hidden border border-slate-200/60 shadow-sm ${className}`}>
      {(title || actions) ? (
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/30 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {Icon ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md shadow-slate-200">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
            ) : null}
            <div>
              {title ? <h3 className="text-base font-bold tracking-tight text-slate-900">{title}</h3> : null}
              {description ? <p className="mt-0.5 text-sm font-medium text-slate-500">{description}</p> : null}
            </div>
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-3">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="px-6 py-6">
        {children}
      </div>
    </section>
  )
}

export default SectionPanel
