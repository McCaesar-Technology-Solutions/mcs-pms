interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
  /** Slim header for inner pages — no hero card. */
  compact?: boolean
}

export function PageHeader({ title, description, badge, compact = false }: PageHeaderProps) {
  if (compact) {
    return (
      <header className="mb-1">
        {badge && (
          <span className="mb-1.5 inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {badge}
          </span>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </header>
    )
  }

  return (
    <div className="surface-card page-header-card relative mb-2 overflow-hidden p-5 md:p-6">
      <div className="relative">
        {badge && (
          <span className="mb-2 inline-flex items-center rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {badge}
          </span>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
