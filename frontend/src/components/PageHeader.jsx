function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-600">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-base font-medium leading-relaxed text-slate-500/90">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export default PageHeader
