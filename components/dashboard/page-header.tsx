import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
  compact?: boolean
  actions?: ReactNode
}

export function PageHeader({
  title,
  description,
  badge,
  compact = false,
  actions,
}: PageHeaderProps) {
  if (compact) {
    return (
      <header className="mb-1">
        {badge && (
          <span className="mb-1.5 inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {badge}
          </span>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </header>
    )
  }

  return (
    <header className="page-header mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {badge && <p className="label-eyebrow label-eyebrow-accent">{badge}</p>}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
