interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
}

export function PageHeader({ title, description, badge }: PageHeaderProps) {
  return (
    <div className="surface-card page-header-card relative mb-2 overflow-hidden p-6 md:p-8">
      <div className="relative">
        {badge && (
          <span className="mb-3 inline-flex items-center rounded-md bg-primary/12 px-2.5 py-1 text-xs font-semibold tracking-wide text-primary">
            {badge}
          </span>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-[2.75rem] md:leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
