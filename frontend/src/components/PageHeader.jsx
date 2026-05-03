function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-bold uppercase text-teal-600">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-bold text-slate-950">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}

export default PageHeader
