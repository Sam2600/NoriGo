function SectionPanel({ title, description, icon: Icon, actions, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {(title || actions) ? (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            {Icon ? (
              <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            ) : null}
            <div>
              {title ? <h2 className="text-base font-semibold text-slate-950">{title}</h2> : null}
              {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  )
}

export default SectionPanel
