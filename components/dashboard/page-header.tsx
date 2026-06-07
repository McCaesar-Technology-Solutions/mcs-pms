interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
}

export function PageHeader({ title, description, badge }: PageHeaderProps) {
  return (
    <div className="relative mb-2 overflow-hidden rounded-2xl bg-gradient-to-br from-white/90 via-white/75 to-emerald-50/40 p-6 shadow-elevation-2 backdrop-blur-sm md:p-8">
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-6 left-1/3 h-28 w-28 rounded-full bg-teal-500/8 blur-2xl" />

      <div className="relative">
        {badge && (
          <span className="mb-3 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary shadow-elevation-1">
            {badge}
          </span>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-gradient-brand md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
