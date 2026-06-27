interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
}

export function PageHeader({ title, description, badge }: PageHeaderProps) {
  return (
    <div className="surface-card page-header-card relative mb-2 overflow-hidden p-6 md:p-8">
      <div className="surface-card-accent" />
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(212,166,46,0.22) 0%, transparent 70%)' }}
      />
      <div className="relative">
        {badge && (
          <span className="mb-3 inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-primary shadow-elevation-1">
            {badge}
          </span>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
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
